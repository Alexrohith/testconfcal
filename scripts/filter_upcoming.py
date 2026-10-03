import json
from datetime import date
from pathlib import Path


INPUT_FILE = Path(
    "data/ieee_all_categories.json"
)

OUTPUT_FILE = Path(
    "data/ieee_upcoming.json"
)


def is_upcoming(conference):

    end_date = conference.get("endDate")

    if not end_date:
        return False

    try:
        return date.fromisoformat(
            end_date
        ) >= date.today()

    except ValueError:
        return False


def main():

    print("=" * 80)
    print("IEEE UPCOMING CONFERENCE FILTER")
    print("=" * 80)

    with open(
        INPUT_FILE,
        "r",
        encoding="utf-8"
    ) as f:

        conferences = json.load(f)

    upcoming = []
    finished = []

    for conference in conferences:

        if is_upcoming(conference):
            upcoming.append(conference)
        else:
            finished.append(conference)

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            upcoming,
            f,
            indent=2,
            ensure_ascii=False
        )

    print(f"\nTotal catalog : {len(conferences)}")
    print(f"Upcoming      : {len(upcoming)}")
    print(f"Finished      : {len(finished)}")

    print(
        f"\nSaved upcoming catalog to:"
        f"\n{OUTPUT_FILE}"
    )


if __name__ == "__main__":
    main()