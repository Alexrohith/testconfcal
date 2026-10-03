import json
import os
import time
from pathlib import Path

import requests


DETAIL_URL = "https://conference-api.ieee.org/conf/details"

INPUT_FILE = Path("data/ieee_upcoming.json")
OUTPUT_DIR = Path("data/ieee_details")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def get_headers():
    api_key = os.getenv("IEEE_API_KEY")

    if not api_key:
        raise RuntimeError(
            "IEEE_API_KEY is not set."
        )

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


def get_details(event_id):

    response = requests.get(
        DETAIL_URL,
        headers=get_headers(),
        params={"id": event_id},
        timeout=30,
    )

    response.raise_for_status()

    return response.json()


def main():

    print("=" * 80)
    print("IEEE CONFERENCE DETAIL FETCHER")
    print("=" * 80)

    # --------------------------------------------------------
    # Load existing search results
    # --------------------------------------------------------

    with open(
        INPUT_FILE,
        "r",
        encoding="utf-8"
    ) as f:
        conferences = json.load(f)

    print(f"\nConferences found: {len(conferences)}")

    success = 0
    failed = 0
    skipped = 0

    # --------------------------------------------------------
    # Fetch each conference
    # --------------------------------------------------------

    for index, conference in enumerate(conferences, start=1):

        event_id = conference["eventId"]

        output_file = (
            OUTPUT_DIR /
            f"{event_id}.json"
        )

        # Don't download again if already exists
        if output_file.exists():

            skipped += 1

            print(
                f"[{index}/{len(conferences)}] "
                f"{event_id} → already exists"
            )

            continue

        print(
            f"[{index}/{len(conferences)}] "
            f"Fetching {event_id}..."
        )

        try:

            details = get_details(event_id)

            with open(
                output_file,
                "w",
                encoding="utf-8"
            ) as f:

                json.dump(
                    details,
                    f,
                    indent=2,
                    ensure_ascii=False
                )

            success += 1

            print(
                f"    ✓ saved"
            )

        except Exception as e:

            failed += 1

            print(
                f"    ✗ FAILED: {e}"
            )

        # Small delay between requests
        time.sleep(0.15)

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    print("\n")
    print("=" * 80)
    print("COMPLETE")
    print("=" * 80)

    print(f"Successful : {success}")
    print(f"Skipped    : {skipped}")
    print(f"Failed     : {failed}")
    print(f"Total      : {len(conferences)}")

    print(
        f"\nRaw details saved in:\n"
        f"{OUTPUT_DIR}"
    )


if __name__ == "__main__":
    main()