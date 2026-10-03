import argparse
import json
from pathlib import Path

from sqlalchemy import text

from app.database import engine


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_FILE = BASE_DIR / "data" / "ieee_conferences.json"
SOURCE = "IEEE"

SOURCE_FIELDS = (
    "title",
    "start_date",
    "end_date",
    "paper_deadline",
    "city",
    "region",
    "country",
    "venue",
    "scope",
    "about",
    "format",
    "is_virtual",
    "website",
    "event_contact",
    "ieee_region",
    "ieee_detail_url",
    "last_verified",
)

UPSERT_CONFERENCE = text("""
    INSERT INTO conferences (
        source, event_id, title, start_date, end_date, paper_deadline,
        city, region, country, venue, scope, about, format, is_virtual,
        website, event_contact, ieee_region, ieee_detail_url, last_verified
    )
    VALUES (
        :source, :event_id, :title, :start_date, :end_date, :paper_deadline,
        :city, :region, :country, :venue, :scope, :about, :format,
        :is_virtual, :website, :event_contact, :ieee_region,
        :ieee_detail_url, :last_verified
    )
    ON CONFLICT (source, event_id) DO UPDATE SET
        title = EXCLUDED.title,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        paper_deadline = EXCLUDED.paper_deadline,
        city = EXCLUDED.city,
        region = EXCLUDED.region,
        country = EXCLUDED.country,
        venue = EXCLUDED.venue,
        scope = EXCLUDED.scope,
        about = EXCLUDED.about,
        format = EXCLUDED.format,
        is_virtual = EXCLUDED.is_virtual,
        website = EXCLUDED.website,
        event_contact = EXCLUDED.event_contact,
        ieee_region = EXCLUDED.ieee_region,
        ieee_detail_url = EXCLUDED.ieee_detail_url,
        last_verified = EXCLUDED.last_verified,
        updated_at = CURRENT_TIMESTAMP
    WHERE (
        conferences.title,
        conferences.start_date,
        conferences.end_date,
        conferences.paper_deadline,
        conferences.city,
        conferences.region,
        conferences.country,
        conferences.venue,
        conferences.scope,
        conferences.about,
        conferences.format,
        conferences.is_virtual,
        conferences.website,
        conferences.event_contact,
        conferences.ieee_region,
        conferences.ieee_detail_url,
        conferences.last_verified
    ) IS DISTINCT FROM (
        EXCLUDED.title,
        EXCLUDED.start_date,
        EXCLUDED.end_date,
        EXCLUDED.paper_deadline,
        EXCLUDED.city,
        EXCLUDED.region,
        EXCLUDED.country,
        EXCLUDED.venue,
        EXCLUDED.scope,
        EXCLUDED.about,
        EXCLUDED.format,
        EXCLUDED.is_virtual,
        EXCLUDED.website,
        EXCLUDED.event_contact,
        EXCLUDED.ieee_region,
        EXCLUDED.ieee_detail_url,
        EXCLUDED.last_verified
    )
    RETURNING id, (xmax = 0) AS inserted
""")


def record_values(conference):
    values = {
        field: conference.get(field)
        for field in SOURCE_FIELDS
    }
    values["is_virtual"] = conference.get("is_virtual", False)
    values["source"] = SOURCE
    values["event_id"] = conference["event_id"]
    return values


def load_categories(conn):
    result = conn.execute(text("SELECT id, name FROM categories"))
    return {row.name: row.id for row in result}


def load_existing(conn):
    columns = ", ".join(SOURCE_FIELDS)
    result = conn.execute(
        text(f"SELECT event_id, {columns} FROM conferences WHERE source = :source"),
        {"source": SOURCE},
    )
    conferences = {row.event_id: row._mapping for row in result}

    result = conn.execute(text("""
        SELECT c.event_id, cc.category_id
        FROM conference_categories AS cc
        JOIN conferences AS c ON c.id = cc.conference_id
        WHERE c.source = :source
    """), {"source": SOURCE})
    category_links = {}
    for row in result:
        category_links.setdefault(row.event_id, set()).add(row.category_id)

    return conferences, category_links


def values_differ(existing, values):
    for field in SOURCE_FIELDS:
        current = existing[field]
        expected = values[field]
        if hasattr(current, "isoformat") and isinstance(expected, str):
            current = current.isoformat()
        if current != expected:
            return True
    return False


def report(stats, source_count, dry_run, failed=False):
    if failed:
        heading = "SYNC FAILED"
    else:
        heading = "SYNC DRY RUN" if dry_run else "SYNC COMPLETE"
    print(f"\n{heading}")
    print(f"Source records: {source_count}")
    print(f"Inserted: {stats['inserted']}")
    print(f"Updated: {stats['updated']}")
    print(f"Unchanged: {stats['unchanged']}")
    print(f"Category links added: {stats['category_links_added']}")
    print(f"Errors: {stats['errors']}")
    if dry_run:
        print("No database changes were made.")


def sync(conferences, dry_run=False, stats_out=None):
    stats = {
        "inserted": 0,
        "updated": 0,
        "unchanged": 0,
        "category_links_added": 0,
        "errors": 0,
    }
    current_event_id = None

    try:
        connection = engine.connect() if dry_run else engine.begin()
        with connection as conn:
            category_map = load_categories(conn)
            existing = {}
            existing_links = {}
            if dry_run:
                existing, existing_links = load_existing(conn)

            for conference in conferences:
                current_event_id = conference.get("event_id")
                values = record_values(conference)

                if dry_run:
                    previous = existing.get(current_event_id)
                    if previous is None:
                        stats["inserted"] += 1
                    elif values_differ(previous, values):
                        stats["updated"] += 1
                    else:
                        stats["unchanged"] += 1
                    conference_id = None
                else:
                    result = conn.execute(UPSERT_CONFERENCE, values).first()
                    if result is None:
                        stats["unchanged"] += 1
                        conference_id = conn.execute(text("""
                            SELECT id FROM conferences
                            WHERE source = :source AND event_id = :event_id
                        """), values).scalar_one()
                    elif result.inserted:
                        stats["inserted"] += 1
                        conference_id = result.id
                    else:
                        stats["updated"] += 1
                        conference_id = result.id

                for category_name in dict.fromkeys(conference.get("categories", [])):
                    category_id = category_map.get(category_name)
                    if category_id is None:
                        print(
                            f"WARNING: Unknown category '{category_name}' "
                            f"for event {current_event_id}"
                        )
                        continue

                    if dry_run:
                        if category_id not in existing_links.get(current_event_id, set()):
                            stats["category_links_added"] += 1
                    else:
                        result = conn.execute(text("""
                            INSERT INTO conference_categories (conference_id, category_id)
                            VALUES (:conference_id, :category_id)
                            ON CONFLICT (conference_id, category_id) DO NOTHING
                        """), {
                            "conference_id": conference_id,
                            "category_id": category_id,
                        })
                        stats["category_links_added"] += result.rowcount

        report(stats, len(conferences), dry_run)
        if stats_out is not None:
            stats_out.update(stats)
        return 0
    except Exception as exc:
        for key in ("inserted", "updated", "unchanged", "category_links_added"):
            stats[key] = 0
        stats["errors"] = 1
        print("\nAll database writes were rolled back.")
        if current_event_id is not None:
            print(f"Failed near event_id: {current_event_id}")
        print(f"Error: {type(exc).__name__}: {exc}")
        report(stats, len(conferences), dry_run, failed=True)
        if stats_out is not None:
            stats_out.update(stats)
        return 1


def main():
    parser = argparse.ArgumentParser(description="Sync IEEE conferences into the database.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compare source data without modifying the database.",
    )
    args = parser.parse_args()

    print(f"Loading source data from {DATA_FILE}")
    try:
        with DATA_FILE.open("r", encoding="utf-8") as data_file:
            conferences = json.load(data_file)
        if not isinstance(conferences, list):
            raise ValueError("Source JSON must contain a list of conferences")
    except Exception as exc:
        print(f"Unable to load source data: {type(exc).__name__}: {exc}")
        print("Errors: 1")
        return 1

    print(f"Loaded {len(conferences)} conferences")
    return sync(conferences, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())