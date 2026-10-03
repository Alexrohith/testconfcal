import json
from pathlib import Path

INPUT_FILE = Path("data/ieee_machine_learning.json")
DETAIL_DIR = Path("data/ieee_details")


def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        conferences = json.load(f)

    downloaded_ids = {
        int(path.stem)
        for path in DETAIL_DIR.glob("*.json")
        if path.stem.isdigit()
    }

    missing = []

    for conference in conferences:
        event_id = conference["eventId"]

        if event_id not in downloaded_ids:
            missing.append(conference)

    print("=" * 80)
    print("MISSING IEEE CONFERENCE DETAILS")
    print("=" * 80)

    print(f"\nTotal conferences : {len(conferences)}")
    print(f"Downloaded        : {len(downloaded_ids)}")
    print(f"Missing           : {len(missing)}")

    for conference in missing:
        print("\nEvent ID :", conference["eventId"])
        print("Title   :", conference["eventTitle"])
        print("Date    :", conference["startDate"], "to", conference["endDate"])


if __name__ == "__main__":
    main()