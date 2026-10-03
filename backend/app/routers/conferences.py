from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.conference import Conference


router = APIRouter(
    prefix="/api/conferences",
    tags=["Conferences"],
)

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

    categories = db.execute(
        text("""
            SELECT
                c.name,
                c.display_name
            FROM categories c
            JOIN conference_categories cc
                ON cc.category_id = c.id
            WHERE cc.conference_id = :conference_id
            ORDER BY c.display_name
        """),
        {
            "conference_id": conference_id
        },
    ).mappings().all()

    return {
        "id": conference.id,
        "event_id": conference.event_id,

        "title": conference.title,

        "start_date": conference.start_date,
        "end_date": conference.end_date,

        "paper_deadline": conference.paper_deadline,

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

        "categories": [
            dict(category)
            for category in categories
        ],
    }

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