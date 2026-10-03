import json
import os
from pathlib import Path

import requests


# ============================================================
# CONFIG
# ============================================================

SEARCH_URL = "https://conference-api.ieee.org/conf/searchfacet"
DETAIL_URL = "https://conference-api.ieee.org/conf/details"

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)


# ============================================================
# COMMON HEADERS
# ============================================================

def get_headers():
    api_key = os.getenv("IEEE_API_KEY")

    if not api_key:
        raise RuntimeError(
            "IEEE_API_KEY environment variable is not set.\n"
            "Run in PowerShell:\n"
            '$env:IEEE_API_KEY="YOUR_API_KEY"'
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


# ============================================================
# IEEE SEARCH API
# ============================================================

def search_ieee(query, pos=0):
    """
    Search IEEE conferences.

    IMPORTANT:
    `pos` is the PAGE NUMBER, not an offset.

    Page 1 -> pos=0
    Page 2 -> pos=1
    Page 3 -> pos=2
    """

    payload = {
        "q": query,
        "subsequent_q": "",
        "date": "all",
        "from": "",
        "to": "",
        "region": "all",
        "country": "all",
        "pos": pos,
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

    headers = get_headers()

    response = requests.post(
        SEARCH_URL,
        headers={
            **headers,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data=payload,
        timeout=30,
    )

    response.raise_for_status()

    return response.json()


# ============================================================
# FETCH ALL SEARCH RESULTS
# ============================================================

def fetch_all_conferences(query):
    """
    Fetch every conference returned by the IEEE search API.
    """

    print("=" * 80)
    print("IEEE CONFERENCE SEARCH")
    print("=" * 80)

    print(f"\nQuery: {query}")
    print("Fetching first page...")

    first_response = search_ieee(query, pos=0)

    entity = first_response["entity"]

    total_results = entity["totalResults"]
    page_size = entity["pageSize"]

    first_results = entity["results"]

    all_results = first_results.copy()

    total_pages = (
        total_results + page_size - 1
    ) // page_size

    print(f"Total results: {total_results}")
    print(f"Page size: {page_size}")
    print(f"Total pages: {total_pages}")
    print(f"Got {len(first_results)}")

    # --------------------------------------------------------
    # Fetch remaining pages
    # --------------------------------------------------------

    for page in range(1, total_pages):

        print(
            f"\nFetching position {page} "
            f"(page {page + 1}/{total_pages})..."
        )

        response = search_ieee(
            query,
            pos=page
        )

        results = response["entity"]["results"]

        print(f"Got {len(results)}")

        all_results.extend(results)

        print(
            f"Total collected: {len(all_results)}"
        )

    return all_results


# ============================================================
# IEEE CONFERENCE DETAIL API
# ============================================================

def get_conference_details(event_id):
    """
    Fetch detailed information for one IEEE conference.

    Example:
        GET /conf/details?id=72300
    """

    headers = get_headers()

    response = requests.get(
        DETAIL_URL,
        headers=headers,
        params={
            "id": event_id
        },
        timeout=30,
    )

    response.raise_for_status()

    return response.json()


# ============================================================
# TEST ONE CONFERENCE DETAIL
# ============================================================

def test_conference_detail(event_id):
    """
    Fetch and save one conference's detail response.
    """

    print("\n")
    print("=" * 80)
    print("IEEE CONFERENCE DETAIL TEST")
    print("=" * 80)

    print(f"\nEvent ID: {event_id}")
    print("Fetching details...")

    details = get_conference_details(event_id)

    print("\nRequest successful!")
    print("Status: 200 OK")

    # --------------------------------------------------------
    # Print JSON
    # --------------------------------------------------------

    print("\nResponse:")
    print(
        json.dumps(
            details,
            indent=2,
            ensure_ascii=False
        )
    )

    # --------------------------------------------------------
    # Save response
    # --------------------------------------------------------

    output_file = (
        DATA_DIR /
        f"ieee_detail_{event_id}.json"
    )

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

    print("\n")
    print(f"Saved to: {output_file}")

    return details


# ============================================================
# MAIN
# ============================================================

def main():

    # --------------------------------------------------------
    # STEP 1
    # Search IEEE conferences
    # --------------------------------------------------------

    query = "machine learning"

    conferences = fetch_all_conferences(query)

    # --------------------------------------------------------
    # STEP 2
    # Save search results
    # --------------------------------------------------------

    search_output = (
        DATA_DIR /
        "ieee_machine_learning.json"
    )

    with open(
        search_output,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            conferences,
            f,
            indent=2,
            ensure_ascii=False
        )

    print("\n")
    print("=" * 80)
    print("SEARCH COMPLETE")
    print("=" * 80)

    print(
        f"\nTotal conferences collected: "
        f"{len(conferences)}"
    )

    print(
        f"Saved to: {search_output}"
    )

    # --------------------------------------------------------
    # STEP 3
    # Test detail API
    #
    # We know 72300 works from DevTools.
    # --------------------------------------------------------

    event_id = 72300

    test_conference_detail(event_id)

    # --------------------------------------------------------
    # DONE
    # --------------------------------------------------------

    print("\n")
    print("=" * 80)
    print("ALL DONE")
    print("=" * 80)


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()