from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import (
    Integer,
    Numeric,
    Uuid,
    and_,
    bindparam,
    cast,
    column,
    func,
    select,
    table,
    text,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth import get_current_user_id
from app.database import get_db
from app.models.conference import Conference


router = APIRouter(
    prefix="/api/conferences",
    tags=["Conferences"],
)

_user_interests = table(
    "user_interests",
    column("user_id", Uuid(as_uuid=True)),
    column("category_id", Integer),
)
_conference_category_links = table(
    "conference_categories",
    column("conference_id", Integer),
    column("category_id", Integer),
)
_categories = table(
    "categories",
    column("id", Integer),
    column("name"),
    column("display_name"),
)


def _conference_categories(db: Session, conference_ids: list[int]):
    if not conference_ids:
        return {}

    rows = db.execute(
        text("""
            SELECT
                cc.conference_id,
                c.name,
                c.display_name
            FROM categories c
            JOIN conference_categories cc
                ON cc.category_id = c.id
            WHERE cc.conference_id IN :conference_ids
            ORDER BY c.display_name
        """).bindparams(bindparam("conference_ids", expanding=True)),
        {"conference_ids": conference_ids},
    ).mappings().all()

    categories_by_conference = {conference_id: [] for conference_id in conference_ids}
    for row in rows:
        categories_by_conference[row["conference_id"]].append({
            "name": row["name"],
            "display_name": row["display_name"],
        })
    return categories_by_conference


def _conference_response(conference: Conference, categories: list[dict]):
    today = date.today()
    paper_deadline = conference.paper_deadline
    if paper_deadline is None:
        deadline_status = "no_deadline"
        days_until_deadline = None
    else:
        days_until_deadline = (paper_deadline - today).days
        if days_until_deadline < 0:
            deadline_status = "passed"
        elif days_until_deadline <= 7:
            deadline_status = "urgent"
        else:
            deadline_status = "upcoming"

    return {
        "id": conference.id,
        "event_id": conference.event_id,
        "title": conference.title,
        "start_date": conference.start_date,
        "end_date": conference.end_date,
        "paper_deadline": paper_deadline,
        "deadline_status": deadline_status,
        "days_until_deadline": days_until_deadline,
        "city": conference.city,
        "region": conference.region,
        "country": conference.country,
        "venue": conference.venue,
        "scope": conference.scope,
        "about": conference.about,
        "format": conference.format,
        "is_virtual": conference.is_virtual,
        "website": conference.website,
        "event_contact": conference.event_contact,
        "ieee_region": conference.ieee_region,
        "ieee_detail_url": conference.ieee_detail_url,
        "categories": categories,
    }


@router.get("/saved")
def get_saved_conferences(
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        conference_ids = db.execute(
            text("""
                SELECT conference_id
                FROM saved_conferences
                WHERE user_id = :user_id
            """).bindparams(bindparam("user_id", type_=Uuid(as_uuid=True))),
            {"user_id": user_id},
        ).scalars().all()
        conferences = (
            db.query(Conference)
            .filter(Conference.id.in_(conference_ids))
            .order_by(
                Conference.paper_deadline.is_(None),
                Conference.paper_deadline.asc(),
                Conference.start_date.asc(),
            )
            .all()
        )
        categories_by_conference = _conference_categories(
            db,
            [conference.id for conference in conferences],
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Saved conferences are temporarily unavailable.",
        ) from exc

    return {
        "conferences": [
            _conference_response(
                conference,
                categories_by_conference[conference.id],
            )
            for conference in conferences
        ]
    }


@router.get("/recommended")
def get_recommended_conferences(
    user_id: UUID = Depends(get_current_user_id),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    try:
        total_interest_count = db.query(func.count()).select_from(
            _user_interests,
        ).filter(
            _user_interests.c.user_id == user_id,
        ).scalar()

        if not total_interest_count:
            return {
                "page": page,
                "limit": limit,
                "total": 0,
                "personalization_configured": False,
                "results": [],
            }

        join_condition = and_(
            _conference_category_links.c.category_id == _user_interests.c.category_id,
            _user_interests.c.user_id == user_id,
        )
        match_count = func.count(
            func.distinct(_conference_category_links.c.category_id),
        )
        match_percentage = cast(
            func.round(
                cast(match_count * 100, Numeric) / total_interest_count,
            ),
            Integer,
        ).label("match_percentage")
        matching_conferences = (
            db.query(Conference)
            .join(
                _conference_category_links,
                Conference.id == _conference_category_links.c.conference_id,
            )
            .join(_user_interests, join_condition)
            .group_by(Conference.id)
        )
        total = (
            db.query(func.count(func.distinct(Conference.id)))
            .select_from(Conference)
            .join(
                _conference_category_links,
                Conference.id == _conference_category_links.c.conference_id,
            )
            .join(_user_interests, join_condition)
            .scalar()
        )
        rows = (
            matching_conferences
            .add_columns(match_count.label("match_count"), match_percentage)
            .order_by(
                match_percentage.desc(),
                match_count.desc(),
                Conference.paper_deadline.asc().nullslast(),
                Conference.id.asc(),
            )
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )

        conference_ids = [conference.id for conference, _, _ in rows]
        matched_categories_by_conference = {
            conference_id: [] for conference_id in conference_ids
        }
        if conference_ids:
            matched_categories = db.execute(
                select(
                    _conference_category_links.c.conference_id,
                    _categories.c.name,
                    _categories.c.display_name,
                )
                .select_from(
                    _conference_category_links
                    .join(
                        _categories,
                        _categories.c.id == _conference_category_links.c.category_id,
                    )
                    .join(
                        _user_interests,
                        and_(
                            _user_interests.c.category_id
                            == _conference_category_links.c.category_id,
                            _user_interests.c.user_id == user_id,
                        ),
                    )
                )
                .where(_conference_category_links.c.conference_id.in_(conference_ids))
                .order_by(
                    _conference_category_links.c.conference_id,
                    _categories.c.display_name,
                )
            ).mappings()
            for category in matched_categories:
                matched_categories_by_conference[category["conference_id"]].append({
                    "name": category["name"],
                    "display_name": category["display_name"],
                })
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Recommended conferences are temporarily unavailable.",
        ) from exc

    list_fields = (
        "id",
        "event_id",
        "title",
        "start_date",
        "end_date",
        "paper_deadline",
        "deadline_status",
        "days_until_deadline",
        "city",
        "country",
        "format",
        "is_virtual",
        "website",
    )
    results = []
    for conference, matched_count, percentage in rows:
        conference_data = _conference_response(conference, [])
        result = {field: conference_data[field] for field in list_fields}
        result.update({
            "match_count": matched_count,
            "match_percentage": percentage,
            "matched_categories": matched_categories_by_conference[conference.id],
        })
        results.append(result)

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "personalization_configured": True,
        "results": results,
    }


@router.post("/{conference_id}/save")
def save_conference(
    conference_id: int,
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        conference_exists = (
            db.query(Conference.id)
            .filter(Conference.id == conference_id)
            .first()
        )
        if conference_exists is None:
            raise HTTPException(status_code=404, detail="Conference not found.")

        result = db.execute(
            text("""
                INSERT INTO saved_conferences (user_id, conference_id)
                VALUES (:user_id, :conference_id)
                ON CONFLICT (user_id, conference_id) DO NOTHING
            """).bindparams(bindparam("user_id", type_=Uuid(as_uuid=True))),
            {"user_id": user_id, "conference_id": conference_id},
        )
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Unable to save this conference right now.",
        ) from exc

    return {
        "conference_id": conference_id,
        "saved": True,
        "already_saved": result.rowcount == 0,
    }


@router.delete("/{conference_id}/save")
def unsave_conference(
    conference_id: int,
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        conference_exists = (
            db.query(Conference.id)
            .filter(Conference.id == conference_id)
            .first()
        )
        if conference_exists is None:
            raise HTTPException(status_code=404, detail="Conference not found.")

        result = db.execute(
            text("""
                DELETE FROM saved_conferences
                WHERE user_id = :user_id
                  AND conference_id = :conference_id
            """).bindparams(bindparam("user_id", type_=Uuid(as_uuid=True))),
            {"user_id": user_id, "conference_id": conference_id},
        )
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Unable to remove this saved conference right now.",
        ) from exc

    return {
        "conference_id": conference_id,
        "saved": False,
        "already_unsaved": result.rowcount == 0,
    }


@router.get("/{conference_id}/saved")
def get_conference_saved_status(
    conference_id: int,
    user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    try:
        conference_exists = (
            db.query(Conference.id)
            .filter(Conference.id == conference_id)
            .first()
        )
        if conference_exists is None:
            raise HTTPException(status_code=404, detail="Conference not found.")

        is_saved = db.execute(
            text("""
                SELECT EXISTS (
                    SELECT 1
                    FROM saved_conferences
                    WHERE user_id = :user_id
                      AND conference_id = :conference_id
                )
            """).bindparams(bindparam("user_id", type_=Uuid(as_uuid=True))),
            {"user_id": user_id, "conference_id": conference_id},
        ).scalar_one()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Saved status is temporarily unavailable.",
        ) from exc

    return {"conference_id": conference_id, "saved": is_saved}


@router.get("/{conference_id}")
def get_conference(
    conference_id: int,
    db: Session = Depends(get_db),
):
    conference = (
        db.query(Conference)
        .filter(Conference.id == conference_id)
        .first()
    )

    if not conference:
        return {
            "error": "Conference not found"
        }

    categories = _conference_categories(db, [conference_id])[conference_id]
    response = _conference_response(conference, categories)
    response.pop("deadline_status")
    response.pop("days_until_deadline")
    return response

@router.get("/")
def get_conferences(
    search: str | None = Query(None),
    country: str | None = Query(None),
    category: str | None = Query(None),

    deadline: str | None = Query(
        None,
        description="upcoming, 7days, passed, or none"
    ),

    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),

    db: Session = Depends(get_db),
):
    query = db.query(Conference)

    # --------------------------------------------------
    # Search
    # --------------------------------------------------

    if search:
        search_term = f"%{search}%"

        query = query.filter(
            Conference.title.ilike(search_term)
            |
            Conference.scope.ilike(search_term)
            |
            Conference.about.ilike(search_term)
        )

    # --------------------------------------------------
    # Country
    # --------------------------------------------------

    if country:
        query = query.filter(
            Conference.country.ilike(f"%{country}%")
        )

    # --------------------------------------------------
    # Category
    # --------------------------------------------------

    if category:
        query = query.filter(
            Conference.id.in_(
                db.execute(
                    text("""
                        SELECT cc.conference_id
                        FROM conference_categories cc
                        JOIN categories c
                          ON c.id = cc.category_id
                        WHERE c.name = :category
                    """),
                    {"category": category},
                ).scalars().all()
            )
        )

    # --------------------------------------------------
    # Deadline filters
    # --------------------------------------------------

    today = date.today()

    if deadline == "upcoming":
        query = query.filter(
            Conference.paper_deadline >= today
        )

    elif deadline == "7days":
        query = query.filter(
            Conference.paper_deadline >= today,
            Conference.paper_deadline <= today + timedelta(days=7)
        )

    elif deadline == "passed":
        query = query.filter(
            Conference.paper_deadline < today
        )

    elif deadline == "none":
        query = query.filter(
            Conference.paper_deadline.is_(None)
        )

    # --------------------------------------------------
    # Total
    # --------------------------------------------------

    total = query.with_entities(
        func.count(Conference.id)
    ).scalar()

    # --------------------------------------------------
    # Pagination
    # --------------------------------------------------

    offset = (page - 1) * limit

    conferences = (
        query
        .order_by(
            Conference.paper_deadline.is_(None),
            Conference.paper_deadline.asc(),
            Conference.start_date.asc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    # --------------------------------------------------
    # Response formatting
    # --------------------------------------------------

    results = []

    for conference in conferences:

        paper_deadline = conference.paper_deadline

        if paper_deadline is None:
            deadline_status = "no_deadline"
            days_until_deadline = None

        else:
            days_until_deadline = (
                paper_deadline - today
            ).days

            if days_until_deadline < 0:
                deadline_status = "passed"

            elif days_until_deadline <= 7:
                deadline_status = "urgent"

            else:
                deadline_status = "upcoming"

        results.append({
            "id": conference.id,
            "event_id": conference.event_id,

            "title": conference.title,

            "start_date": conference.start_date,
            "end_date": conference.end_date,

            "paper_deadline": paper_deadline,
            "deadline_status": deadline_status,
            "days_until_deadline": days_until_deadline,

            "city": conference.city,
            "country": conference.country,

            "format": conference.format,
            "is_virtual": conference.is_virtual,

            "website": conference.website,
        })

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "results": results,
    }