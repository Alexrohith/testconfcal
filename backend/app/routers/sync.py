from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.database import engine


router = APIRouter(
    prefix="/api/sync",
    tags=["Sync"],
)


def read_sync_status():
    try:
        with engine.connect() as connection:
            latest = connection.execute(text("""
                SELECT source, status, started_at, finished_at,
                       categories_searched, raw_records, unique_event_ids,
                       details_fetched, failed_details, inserted, updated,
                       unchanged, category_links_added, errors,
                       EXTRACT(EPOCH FROM (
                           COALESCE(finished_at, CURRENT_TIMESTAMP) - started_at
                       ))::double precision AS duration_seconds
                FROM sync_runs
                WHERE source = :source
                ORDER BY started_at DESC, id DESC
                LIMIT 1
            """), {"source": "IEEE"}).first()
            last_success = connection.execute(text("""
                SELECT finished_at
                FROM sync_runs
                WHERE source = :source AND status = 'success'
                ORDER BY finished_at DESC, id DESC
                LIMIT 1
            """), {"source": "IEEE"}).scalar_one_or_none()
            conference_count = connection.execute(text(
                "SELECT count(*) FROM conferences"
            )).scalar_one()

        latest_values = dict(latest._mapping) if latest else {}
        return {
            "source": "IEEE",
            "status": latest_values.get("status"),
            "started_at": latest_values.get("started_at"),
            "finished_at": latest_values.get("finished_at"),
            "categories_searched": latest_values.get("categories_searched", 0),
            "raw_records": latest_values.get("raw_records", 0),
            "unique_event_ids": latest_values.get("unique_event_ids", 0),
            "details_fetched": latest_values.get("details_fetched", 0),
            "failed_details": latest_values.get("failed_details", 0),
            "inserted": latest_values.get("inserted", 0),
            "updated": latest_values.get("updated", 0),
            "unchanged": latest_values.get("unchanged", 0),
            "category_links_added": latest_values.get("category_links_added", 0),
            "errors": latest_values.get("errors", 0),
            "last_successful_sync": last_success,
            "last_sync_status": latest_values.get("status"),
            "last_sync_duration_seconds": latest_values.get("duration_seconds"),
            "conferences_stored": conference_count,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Sync status is temporarily unavailable.",
        ) from exc


@router.get("/status")
def get_sync_status():
    return read_sync_status()


@router.get("/health")
def get_sync_health():
    status = read_sync_status()
    return {
        "source": status["source"],
        "last_successful_sync": status["last_successful_sync"],
        "last_sync_status": status["last_sync_status"],
        "last_sync_duration_seconds": status["last_sync_duration_seconds"],
        "conferences_stored": status["conferences_stored"],
    }