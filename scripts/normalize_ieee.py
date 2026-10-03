import json
from datetime import date
from pathlib import Path


# ============================================================
# CONFIG
# ============================================================

SEARCH_FILE = Path("data/ieee_upcoming.json")
DETAIL_DIR = Path("data/ieee_details")

OUTPUT_FILE = Path(
    "data/ieee_conferences.json"
)


# ============================================================
# HELPERS
# ============================================================

def clean_string(value):
    if value is None:
        return ""

    return " ".join(str(value).split()).strip()


def split_keywords(value):
    if not value:
        return []

    return [
        clean_string(item)
        for item in str(value).split(",")
        if clean_string(item)
    ]


def split_semicolon(value):
    if not value:
        return []

    return [
        clean_string(item)
        for item in str(value).split(";")
        if clean_string(item)
    ]


def normalize_url(value):
    value = clean_string(value)

    if not value:
        return ""

    if value.startswith("http://"):
        return value

    if value.startswith("https://"):
        return value

    return "https://" + value


def normalize_date(value):
    value = clean_string(value)

    if not value:
        return None

    try:
        date.fromisoformat(value)
        return value
    except ValueError:
        return None


def normalize_bool(value):
    value = clean_string(value).upper()

    if value == "Y":
        return True

    if value == "N":
        return False

    return None


# ============================================================
# NORMALIZE ONE CONFERENCE
# ============================================================

def normalize_conference(search_record, detail_response):

    entity = detail_response.get("entity", {})

    detail = entity.get("eventDetail")

    if not detail:
        return None

    location = detail.get("location") or {}

    event_id = detail.get(
        "eventId",
        search_record.get("eventId")
    )

    # Categories came from our multi-category search
    categories = search_record.get(
        "matched_categories",
        []
    )

    conference = {
        # ----------------------------------------------------
        # Identity
        # ----------------------------------------------------

        "source": "IEEE",

        "event_id": event_id,

        "title": clean_string(
            detail.get("eventTitle")
            or search_record.get("eventTitle")
        ),

        # ----------------------------------------------------
        # Categories
        # ----------------------------------------------------

        "categories": categories,

        # ----------------------------------------------------
        # Dates
        # ----------------------------------------------------

        "start_date": normalize_date(
            detail.get("startDate")
        ),

        "end_date": normalize_date(
            detail.get("endDate")
        ),

        "paper_deadline": normalize_date(
            detail.get("callForPapers")
        ),

        # ----------------------------------------------------
        # Location
        # ----------------------------------------------------

        "city": clean_string(
            location.get("city")
        ),

        "region": clean_string(
            location.get("region")
        ),

        "country": clean_string(
            location.get("country")
        ),

        "venue": clean_string(
            detail.get("venues")
        ),

        # ----------------------------------------------------
        # Description
        # ----------------------------------------------------

        "scope": clean_string(
            detail.get("scope")
        ),

        "about": clean_string(
            detail.get("about")
        ),

        # ----------------------------------------------------
        # Topics
        # ----------------------------------------------------

        "keywords": split_keywords(
            detail.get("keywords")
        ),

        # ----------------------------------------------------
        # Sponsors
        # ----------------------------------------------------

        "sponsors": split_semicolon(
            detail.get("sponsors")
        ),

        # ----------------------------------------------------
        # Format
        # ----------------------------------------------------

        "format": clean_string(
            detail.get("eventFormat")
        ).lower(),

        "is_virtual": normalize_bool(
            detail.get("isvirtual")
        ),

        # ----------------------------------------------------
        # External information
        # ----------------------------------------------------

        "website": normalize_url(
            detail.get("url")
        ),

        "event_contact": clean_string(
            detail.get("eventContact")
        ),

        # ----------------------------------------------------
        # IEEE metadata
        # ----------------------------------------------------

        "ieee_region": clean_string(
            detail.get("region")
        ),

        "sponsor_types": split_semicolon(
            detail.get("sponsorTypes")
        ),

        # ----------------------------------------------------
        # Source tracking
        # ----------------------------------------------------

        "ieee_detail_url": (
            "https://conference-api.ieee.org/"
            f"conf/details?id={event_id}"
        ),

        "last_verified": date.today().isoformat(),
    }

    return conference


# ============================================================
# VALIDATION
# ============================================================

def validate_conferences(conferences):

    event_ids = set()

    duplicate_ids = []
    missing_titles = []
    invalid_start_dates = []
    invalid_end_dates = []
    missing_dates = []

    for conference in conferences:

        event_id = conference.get("event_id")

        # -----------------------------------------------
        # Duplicate ID
        # -----------------------------------------------

        if event_id in event_ids:
            duplicate_ids.append(event_id)

        event_ids.add(event_id)

        # -----------------------------------------------
        # Title
        # -----------------------------------------------

        if not conference.get("title"):
            missing_titles.append(event_id)

        # -----------------------------------------------
        # Start date
        # -----------------------------------------------

        start_date = conference.get("start_date")

        if not start_date:
            invalid_start_dates.append(event_id)

        # -----------------------------------------------
        # End date
        # -----------------------------------------------

        end_date = conference.get("end_date")

        if not end_date:
            invalid_end_dates.append(event_id)

        # -----------------------------------------------
        # Both dates
        # -----------------------------------------------

        if not start_date or not end_date:
            missing_dates.append(event_id)

    return {
        "duplicate_ids": duplicate_ids,
        "missing_titles": missing_titles,
        "invalid_start_dates": invalid_start_dates,
        "invalid_end_dates": invalid_end_dates,
        "missing_dates": missing_dates,
    }


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 80)
    print("IEEE CONFERENCE NORMALIZATION")
    print("=" * 80)

    # --------------------------------------------------------
    # Load upcoming search records
    # --------------------------------------------------------

    with open(
        SEARCH_FILE,
        "r",
        encoding="utf-8"
    ) as f:

        search_records = json.load(f)

    print(
        f"\nSearch records: "
        f"{len(search_records)}"
    )

    # --------------------------------------------------------
    # Normalize
    # --------------------------------------------------------

    normalized = []

    missing_details = []
    invalid_details = []

    for index, search_record in enumerate(
        search_records,
        start=1
    ):

        event_id = search_record.get("eventId")

        detail_file = (
            DETAIL_DIR /
            f"{event_id}.json"
        )

        # ----------------------------------------------------
        # Detail missing
        # ----------------------------------------------------

        if not detail_file.exists():

            missing_details.append(event_id)

            print(
                f"[{index}/{len(search_records)}] "
                f"MISSING: {event_id}"
            )

            continue

        # ----------------------------------------------------
        # Read detail
        # ----------------------------------------------------

        try:

            with open(
                detail_file,
                "r",
                encoding="utf-8"
            ) as f:

                detail_response = json.load(f)

        except Exception as e:

            invalid_details.append({
                "event_id": event_id,
                "error": str(e),
            })

            continue

        # ----------------------------------------------------
        # Normalize
        # ----------------------------------------------------

        conference = normalize_conference(
            search_record,
            detail_response
        )

        if conference is None:

            invalid_details.append({
                "event_id": event_id,
                "error": "eventDetail missing",
            })

            continue

        normalized.append(conference)

    # --------------------------------------------------------
    # Validate
    # --------------------------------------------------------

    validation = validate_conferences(
        normalized
    )

    # --------------------------------------------------------
    # Save normalized dataset
    # --------------------------------------------------------

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            normalized,
            f,
            indent=2,
            ensure_ascii=False
        )

    # ========================================================
    # SUMMARY
    # ========================================================

    print("\n")
    print("=" * 80)
    print("NORMALIZATION COMPLETE")
    print("=" * 80)

    print(
        f"\nInput records       : "
        f"{len(search_records)}"
    )

    print(
        f"Normalized records  : "
        f"{len(normalized)}"
    )

    print(
        f"Missing details     : "
        f"{len(missing_details)}"
    )

    print(
        f"Invalid details     : "
        f"{len(invalid_details)}"
    )

    print("\n")
    print("=" * 80)
    print("VALIDATION")
    print("=" * 80)

    print(
        f"\nDuplicate event IDs : "
        f"{len(validation['duplicate_ids'])}"
    )

    print(
        f"Missing titles      : "
        f"{len(validation['missing_titles'])}"
    )

    print(
        f"Invalid start dates : "
        f"{len(validation['invalid_start_dates'])}"
    )

    print(
        f"Invalid end dates   : "
        f"{len(validation['invalid_end_dates'])}"
    )

    print(
        f"Missing dates       : "
        f"{len(validation['missing_dates'])}"
    )

    print(
        f"\nSaved to:\n"
        f"{OUTPUT_FILE}"
    )

    # ========================================================
    # SAMPLE
    # ========================================================

    if normalized:

        print("\n")
        print("=" * 80)
        print("SAMPLE RECORD")
        print("=" * 80)

        print(
            json.dumps(
                normalized[0],
                indent=2,
                ensure_ascii=False
            )
        )

    # ========================================================
    # WARNINGS
    # ========================================================

    if missing_details:

        print("\nMissing detail IDs:")

        for event_id in missing_details[:20]:
            print(event_id)

        if len(missing_details) > 20:
            print(
                f"... and "
                f"{len(missing_details) - 20} more"
            )

    if invalid_details:

        print("\nInvalid detail records:")

        for item in invalid_details[:20]:
            print(item)


if __name__ == "__main__":
    main()