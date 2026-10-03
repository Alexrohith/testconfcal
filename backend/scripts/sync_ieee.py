import argparse
import math
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock, local

import requests
from sqlalchemy import text
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = BACKEND_DIR.parent
SEARCH_URL = "https://conference-api.ieee.org/conf/searchfacet"
DETAIL_URL = "https://conference-api.ieee.org/conf/details"
REQUEST_DELAY_SECONDS = 0.15
DEFAULT_DETAIL_WORKERS = 5
MAX_DETAIL_WORKERS = 10
DEFAULT_DETAIL_DELAY_SECONDS = 0.2
SOURCE = "IEEE"
ADVISORY_LOCK_KEY = 0x434F4E4643414C

load_dotenv(BACKEND_DIR / ".env")

sys.path.insert(0, str(REPOSITORY_ROOT))
from scripts.import_conferences import sync
from scripts.normalize_ieee import normalize_conference

CATEGORIES = {
    "artificial_intelligence": "artificial intelligence",
    "machine_learning": "machine learning",
    "computer_vision": "computer vision",
    "natural_language_processing": "natural language processing",
    "generative_ai": "generative ai",
    "robotics": "robotics",
    "internet_of_things": "internet of things",
    "cybersecurity": "cybersecurity",
    "data_science": "data science",
    "software_engineering": "software engineering",
    "cloud_computing": "cloud computing",
    "computer_networks": "computer networks",
    "blockchain": "blockchain",
    "signal_processing": "signal processing",
    "embedded_systems": "embedded systems",
}

def api_key_from_env():
    return os.getenv("IEEE_API_KEY")


def request_headers():
    api_key = api_key_from_env()
    if not api_key:
        raise RuntimeError("IEEE_API_KEY is not set")

    return {
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://conferences.ieee.org",
        "Referer": "https://conferences.ieee.org/",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/154.0.0.0 Safari/537.36"
        ),
        "x-api-key": api_key,
    }


def search_page(session, query, page):
    payload = {
        "q": query,
        "subsequent_q": "",
        "date": "all",
        "from": "",
        "to": "",
        "region": "all",
        "country": "all",
        "pos": page,
        "sortorder": "desc",
        "sponsor": "",
        "sponsor_type": "all",
        "state": "all",
        "field_of_interest": "all",
        "sortfield": "relevance",
        "searchmode": "basic",
        "virtualConfReadOnly": "N",
        "eventformat": "",
    }
    response = session.post(
        SEARCH_URL,
        headers={
            **request_headers(),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data=payload,
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def fetch_details(session, event_id):
    response = session.get(
        DETAIL_URL,
        headers=request_headers(),
        params={"id": event_id},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def event_key(event_id):
    try:
        return int(event_id)
    except (TypeError, ValueError):
        return str(event_id)


def collect_search_records(session, limit):
    records_by_id = {}
    categories_searched = []
    raw_record_count = 0
    search_errors = []
    stop = False

    for category_name, query in CATEGORIES.items():
        if stop:
            break
        categories_searched.append(category_name)
        page = 0

        try:
            while True:
                result = search_page(session, query, page)
                entity = result["entity"]
                results = entity.get("results", [])
                raw_record_count += len(results)

                for record in results:
                    raw_id = record.get("eventId")
                    if raw_id is None:
                        continue

                    key = event_key(raw_id)
                    existing = records_by_id.get(key)
                    if existing is None:
                        record_copy = dict(record)
                        record_copy["matched_categories"] = [category_name]
                        records_by_id[key] = record_copy
                    elif category_name not in existing["matched_categories"]:
                        existing["matched_categories"].append(category_name)

                    if limit is not None and len(records_by_id) >= limit:
                        stop = True
                        break

                if stop:
                    break

                page_size = entity.get("pageSize", 0)
                total_results = entity.get("totalResults", 0)
                if not page_size or (page + 1) * page_size >= total_results:
                    break
                page += 1
                time.sleep(REQUEST_DELAY_SECONDS)
        except Exception as exc:
            search_errors.append(category_name)
            print(f"Search failed for {category_name}: {safe_error_message(exc)}")

    return records_by_id, categories_searched, raw_record_count, search_errors


def empty_stats():
    return {
        "categories_searched": 0,
        "raw_records": 0,
        "unique_event_ids": 0,
        "details_fetched": 0,
        "failed_details": 0,
        "inserted": 0,
        "updated": 0,
        "unchanged": 0,
        "category_links_added": 0,
        "errors": 0,
    }


def safe_error_message(error):
    message = f"{type(error).__name__}: {error}"
    api_key = api_key_from_env()
    if api_key:
        message = message.replace(api_key, "[REDACTED]")
    return message[:4000]


def detail_settings():
    try:
        workers = int(os.getenv("IEEE_DETAIL_WORKERS", str(DEFAULT_DETAIL_WORKERS)))
    except ValueError as exc:
        raise ValueError("IEEE_DETAIL_WORKERS must be an integer") from exc
    if workers < 1:
        raise ValueError("IEEE_DETAIL_WORKERS must be at least 1")
    if workers > MAX_DETAIL_WORKERS:
        print(f"IEEE_DETAIL_WORKERS capped at {MAX_DETAIL_WORKERS}")
        workers = MAX_DETAIL_WORKERS

    try:
        delay_seconds = float(
            os.getenv("IEEE_DETAIL_DELAY_SECONDS", str(DEFAULT_DETAIL_DELAY_SECONDS))
        )
    except ValueError as exc:
        raise ValueError("IEEE_DETAIL_DELAY_SECONDS must be a number") from exc
    if not math.isfinite(delay_seconds) or delay_seconds <= 0:
        raise ValueError("IEEE_DETAIL_DELAY_SECONDS must be a finite positive number")

    return workers, delay_seconds


def fetch_and_normalize_details(records, workers, delay_seconds):
    if not records:
        return [], 0, []

    thread_state = local()
    session_lock = Lock()
    sessions = []
    rate_lock = Lock()
    next_request_at = [0.0]
    normalized_by_index = {}
    failed_by_index = {}
    details_fetched = 0

    def fetch_record(search_record):
        if not hasattr(thread_state, "session"):
            thread_state.session = requests.Session()
            with session_lock:
                sessions.append(thread_state.session)

        with rate_lock:
            now = time.monotonic()
            request_at = max(now, next_request_at[0])
            next_request_at[0] = request_at + delay_seconds
        wait_seconds = request_at - now
        if wait_seconds > 0:
            time.sleep(wait_seconds)

        event_id = event_key(search_record["eventId"])
        return fetch_details(thread_state.session, event_id)

    try:
        with ThreadPoolExecutor(max_workers=min(workers, len(records))) as executor:
            future_indexes = {
                executor.submit(fetch_record, search_record): (index, search_record)
                for index, search_record in enumerate(records)
            }

            for future in as_completed(future_indexes):
                index, search_record = future_indexes[future]
                event_id = event_key(search_record["eventId"])
                try:
                    detail_response = future.result()
                    details_fetched += 1
                    conference = normalize_conference(search_record, detail_response)
                    if conference is None:
                        failed_by_index[index] = event_id
                    else:
                        conference["event_id"] = event_id
                        normalized_by_index[index] = conference
                except Exception as exc:
                    failed_by_index[index] = event_id
                    print(
                        f"Details failed for event_id {event_id}: "
                        f"{safe_error_message(exc)}"
                    )
    finally:
        for detail_session in sessions:
            detail_session.close()

    normalized_records = [
        normalized_by_index[index]
        for index in sorted(normalized_by_index)
    ]
    failed_event_ids = [
        failed_by_index[index]
        for index in sorted(failed_by_index)
    ]
    return normalized_records, details_fetched, failed_event_ids


def create_sync_run():
    from app.database import engine

    with engine.begin() as connection:
        return connection.execute(text("""
            INSERT INTO sync_runs (source, status)
            VALUES (:source, 'running')
            RETURNING id
        """), {"source": SOURCE}).scalar_one()


def finish_sync_run(run_id, status, stats, error_message=None):
    from app.database import engine

    with engine.begin() as connection:
        connection.execute(text("""
            UPDATE sync_runs
            SET finished_at = CURRENT_TIMESTAMP,
                status = :status,
                categories_searched = :categories_searched,
                raw_records = :raw_records,
                unique_event_ids = :unique_event_ids,
                details_fetched = :details_fetched,
                failed_details = :failed_details,
                inserted = :inserted,
                updated = :updated,
                unchanged = :unchanged,
                category_links_added = :category_links_added,
                errors = :errors,
                error_message = :error_message
            WHERE id = :run_id
        """), {**stats, "status": status, "error_message": error_message, "run_id": run_id})


def sync_once(limit=None, dry_run=False):
    from app.database import engine

    stats = empty_stats()
    run_id = None
    lock_connection = None
    lock_acquired = False
    run_status = "failed"
    error_message = None
    exit_code = 1

    try:
        lock_connection = engine.connect()
        lock_acquired = bool(lock_connection.execute(
            text("SELECT pg_try_advisory_lock(:lock_key)"),
            {"lock_key": ADVISORY_LOCK_KEY},
        ).scalar_one())
        lock_connection.commit()

        if not lock_acquired:
            print("IEEE sync is already running; this run was not started.")
            return 0

        if not dry_run:
            run_id = create_sync_run()

        try:
            request_headers()
            session = requests.Session()
            records_by_id, categories_searched, raw_record_count, search_errors = (
                collect_search_records(session, limit)
            )
            stats["categories_searched"] = len(categories_searched)
            stats["raw_records"] = raw_record_count
            stats["unique_event_ids"] = len(records_by_id)

            records = list(records_by_id.values())
            detail_workers, detail_delay_seconds = detail_settings()
            workers_used = min(detail_workers, len(records))
            print(f"Detail workers: {workers_used}")
            print(f"Detail request delay: {detail_delay_seconds} seconds")
            normalized_records, details_fetched, failed_event_ids = (
                fetch_and_normalize_details(
                    records,
                    detail_workers,
                    detail_delay_seconds,
                )
            )

            stats["details_fetched"] = details_fetched
            stats["failed_details"] = len(failed_event_ids)
            stats["errors"] = len(search_errors) + len(failed_event_ids)

            print("\nIEEE LIVE SYNC FETCH SUMMARY")
            print(f"Categories searched: {len(categories_searched)}")
            print(f"Category names: {', '.join(categories_searched)}")
            print(f"Raw records: {raw_record_count}")
            print(f"Unique event IDs: {len(records_by_id)}")
            print(f"Details successfully fetched: {details_fetched}")
            print(f"Failed event IDs: {failed_event_ids}")
            if search_errors:
                print(f"Search categories that failed: {', '.join(search_errors)}")

            if failed_event_ids or search_errors:
                run_status = "failed"
                failed_parts = []
                if search_errors:
                    failed_parts.append(f"Search failed for: {', '.join(search_errors)}")
                if failed_event_ids:
                    failed_parts.append(f"Detail fetch/normalization failed for: {failed_event_ids}")
                error_message = "; ".join(failed_parts)[:4000]
                if dry_run:
                    sync(normalized_records, dry_run=True)
                exit_code = 1
            else:
                importer_stats = {}
                sync_status = sync(
                    normalized_records,
                    dry_run=dry_run,
                    stats_out=importer_stats,
                )
                for key in (
                    "inserted",
                    "updated",
                    "unchanged",
                    "category_links_added",
                    "errors",
                ):
                    stats[key] = importer_stats.get(key, 0)
                if sync_status:
                    run_status = "failed"
                    stats["errors"] = max(stats["errors"], 1)
                    error_message = "Conference database sync failed; its transaction was rolled back."
                    exit_code = 1
                else:
                    run_status = "success"
                    exit_code = 0
        except Exception as exc:
            stats["errors"] = max(stats["errors"], 1)
            error_message = safe_error_message(exc)
            print(f"IEEE sync failed: {error_message}")
            run_status = "failed"
            exit_code = 1

        if run_id is not None:
            try:
                finish_sync_run(run_id, run_status, stats, error_message)
            except Exception as exc:
                run_status = "failed"
                stats["errors"] = max(stats["errors"], 1)
                error_message = safe_error_message(exc)
                print(f"Unable to finalize sync history: {error_message}")
                exit_code = 1

        print(f"Sync run status: {run_status}")
        print(f"Errors: {stats['errors']}")
        return exit_code
    except Exception as exc:
        print(f"Unable to start IEEE sync: {safe_error_message(exc)}")
        return 1
    finally:
        if lock_connection is not None:
            if lock_acquired:
                try:
                    lock_connection.execute(
                        text("SELECT pg_advisory_unlock(:lock_key)"),
                        {"lock_key": ADVISORY_LOCK_KEY},
                    )
                    lock_connection.commit()
                except Exception:
                    lock_connection.rollback()
            lock_connection.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description="Fetch and sync IEEE conferences.")
    parser.add_argument(
        "--limit",
        type=int,
        help="Stop after collecting this many unique conference event IDs.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and normalize records without modifying conference data.",
    )
    args = parser.parse_args(argv)
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be a positive integer")
    return sync_once(limit=args.limit, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
