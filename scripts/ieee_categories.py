import json
import os
import time
from pathlib import Path

import requests


# ============================================================
# CONFIG
# ============================================================

SEARCH_URL = "https://conference-api.ieee.org/conf/searchfacet"

RAW_DIR = Path("data/ieee_raw")
RAW_DIR.mkdir(parents=True, exist_ok=True)

MASTER_FILE = Path(
    "data/ieee_all_categories.json"
)


# ============================================================
# CATEGORIES
# ============================================================

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


# ============================================================
# HEADERS
# ============================================================

def get_headers():

    api_key = os.getenv("IEEE_API_KEY")

    if not api_key:
        raise RuntimeError(
            "IEEE_API_KEY environment variable is not set."
        )

    return {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": (
            "application/x-www-form-urlencoded"
        ),
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
# IEEE SEARCH
# ============================================================

def search_ieee(query, pos=0):

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

    response = requests.post(
        SEARCH_URL,
        headers=get_headers(),
        data=payload,
        timeout=30,
    )

    response.raise_for_status()

    return response.json()


# ============================================================
# FETCH ONE CATEGORY
# ============================================================

def fetch_category(category_name, query):

    print("\n")
    print("=" * 80)
    print(f"CATEGORY: {category_name}")
    print(f"QUERY   : {query}")
    print("=" * 80)

    # --------------------------------------------------------
    # First page
    # --------------------------------------------------------

    first_response = search_ieee(
        query,
        pos=0
    )

    entity = first_response["entity"]

    total_results = entity["totalResults"]
    page_size = entity["pageSize"]

    total_pages = (
        total_results + page_size - 1
    ) // page_size

    results = entity["results"].copy()

    print(f"Total results : {total_results}")
    print(f"Page size     : {page_size}")
    print(f"Total pages   : {total_pages}")
    print(f"Collected     : {len(results)}")

    # --------------------------------------------------------
    # Remaining pages
    # --------------------------------------------------------

    for page in range(1, total_pages):

        print(
            f"Fetching page "
            f"{page + 1}/{total_pages}..."
        )

        response = search_ieee(
            query,
            pos=page
        )

        page_results = (
            response["entity"]["results"]
        )

        results.extend(page_results)

        print(
            f"Collected: {len(results)}"
        )

        # Small delay
        time.sleep(0.15)

    # --------------------------------------------------------
    # Save raw category
    # --------------------------------------------------------

    output_file = (
        RAW_DIR /
        f"{category_name}.json"
    )

    with open(
        output_file,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            results,
            f,
            indent=2,
            ensure_ascii=False
        )

    print(
        f"\nSaved: {output_file}"
    )

    return results


# ============================================================
# MERGE + DEDUPLICATE
# ============================================================

def merge_results(category_results):

    conferences = {}

    for category_name, results in category_results.items():

        for conference in results:

            event_id = conference.get("eventId")

            if event_id is None:
                continue

            # ------------------------------------------------
            # First time seeing this conference
            # ------------------------------------------------

            if event_id not in conferences:

                conference_copy = conference.copy()

                conference_copy[
                    "matched_categories"
                ] = [category_name]

                conferences[event_id] = conference_copy

            # ------------------------------------------------
            # Already exists
            # ------------------------------------------------

            else:

                categories = conferences[
                    event_id
                ][
                    "matched_categories"
                ]

                if category_name not in categories:

                    categories.append(
                        category_name
                    )

    return list(conferences.values())


# ============================================================
# MAIN
# ============================================================

def main():

    print("\n")
    print("=" * 80)
    print("IEEE MULTI-CATEGORY COLLECTOR")
    print("=" * 80)

    category_results = {}

    # --------------------------------------------------------
    # Fetch every category
    # --------------------------------------------------------

    for category_name, query in CATEGORIES.items():

        try:

            results = fetch_category(
                category_name,
                query
            )

            category_results[
                category_name
            ] = results

        except Exception as e:

            print(
                f"\n❌ ERROR in "
                f"{category_name}: {e}"
            )

    # --------------------------------------------------------
    # Merge
    # --------------------------------------------------------

    print("\n")
    print("=" * 80)
    print("MERGING RESULTS")
    print("=" * 80)

    all_conferences = merge_results(
        category_results
    )

    # --------------------------------------------------------
    # Save master dataset
    # --------------------------------------------------------

    with open(
        MASTER_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            all_conferences,
            f,
            indent=2,
            ensure_ascii=False
        )

    # --------------------------------------------------------
    # Statistics
    # --------------------------------------------------------

    total_raw = sum(
        len(results)
        for results in category_results.values()
    )

    unique = len(all_conferences)

    duplicates = total_raw - unique

    print("\n")
    print("=" * 80)
    print("COLLECTION COMPLETE")
    print("=" * 80)

    print(
        f"\nCategories searched : "
        f"{len(category_results)}"
    )

    print(
        f"Raw results         : "
        f"{total_raw}"
    )

    print(
        f"Unique conferences  : "
        f"{unique}"
    )

    print(
        f"Duplicates removed  : "
        f"{duplicates}"
    )

    print(
        f"\nMaster dataset:"
        f"\n{MASTER_FILE}"
    )

    # --------------------------------------------------------
    # Category statistics
    # --------------------------------------------------------

    print("\n")
    print("=" * 80)
    print("CATEGORY STATISTICS")
    print("=" * 80)

    for category_name, results in (
        category_results.items()
    ):

        unique_ids = {
            r.get("eventId")
            for r in results
            if r.get("eventId") is not None
        }

        print(
            f"{category_name:30} "
            f"{len(unique_ids):5}"
        )

    # --------------------------------------------------------
    # Show examples with multiple categories
    # --------------------------------------------------------

    multi_category = [
        conference
        for conference in all_conferences
        if len(
            conference.get(
                "matched_categories",
                []
            )
        ) > 1
    ]

    print("\n")
    print("=" * 80)
    print("MULTI-CATEGORY EXAMPLES")
    print("=" * 80)

    for conference in multi_category[:10]:

        print(
            f"\n{conference['eventId']} "
            f"- {conference['eventTitle']}"
        )

        print(
            "Categories:",
            ", ".join(
                conference[
                    "matched_categories"
                ]
            )
        )


if __name__ == "__main__":
    main()