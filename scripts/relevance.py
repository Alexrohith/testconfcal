import json
import re
from pathlib import Path


INPUT_FILE = Path(
    "data/ieee_conferences_normalized.json"
)

OUTPUT_FILE = Path(
    "data/ieee_personalized.json"
)


# ============================================================
# USER INTERESTS
# ============================================================

USER_INTERESTS = [
    "artificial intelligence",
    "machine learning",
    "deep learning",
    "natural language processing",
    "computer vision",
    "generative ai",
    "large language models",
    "retrieval augmented generation",
]


# ============================================================
# TEXT NORMALIZATION
# ============================================================

def normalize_text(text):
    if not text:
        return ""

    text = text.lower()

    # Replace punctuation with spaces
    text = re.sub(r"[^a-z0-9+#.\- ]+", " ", text)

    # Remove duplicate whitespace
    text = re.sub(r"\s+", " ", text)

    return text.strip()


# ============================================================
# CONFERENCE TEXT
# ============================================================

def build_conference_text(conference):

    parts = []

    parts.append(
        conference.get("title", "")
    )

    parts.append(
        conference.get("scope", "")
    )

    parts.append(
        conference.get("about", "")
    )

    parts.extend(
        conference.get("keywords", [])
    )

    return normalize_text(
        " ".join(parts)
    )


# ============================================================
# SCORE ONE CONFERENCE
# ============================================================

def calculate_relevance(
    conference,
    interests
):

    text = build_conference_text(
        conference
    )

    matched = []

    for interest in interests:

        interest_normalized = normalize_text(
            interest
        )

        if interest_normalized in text:

            matched.append(interest)

    # --------------------------------------------------------
    # Score
    # --------------------------------------------------------

    if not interests:
        return 0, []

    score = (
        len(matched) / len(interests)
    ) * 100

    return round(score, 2), matched


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 80)
    print("CONFERENCE RELEVANCE ENGINE")
    print("=" * 80)

    # --------------------------------------------------------
    # Load conferences
    # --------------------------------------------------------

    with open(
        INPUT_FILE,
        "r",
        encoding="utf-8"
    ) as f:

        conferences = json.load(f)

    print(
        f"\nConferences loaded: "
        f"{len(conferences)}"
    )

    print(
        "\nUser interests:"
    )

    for interest in USER_INTERESTS:
        print(f"  • {interest}")

    # --------------------------------------------------------
    # Score conferences
    # --------------------------------------------------------

    personalized = []

    for conference in conferences:

        score, matched = calculate_relevance(
            conference,
            USER_INTERESTS
        )

        conference_copy = conference.copy()

        conference_copy[
            "relevance_score"
        ] = score

        conference_copy[
            "matched_interests"
        ] = matched

        personalized.append(
            conference_copy
        )

    # --------------------------------------------------------
    # Sort
    # --------------------------------------------------------

    personalized.sort(
        key=lambda x: x["relevance_score"],
        reverse=True
    )

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            personalized,
            f,
            indent=2,
            ensure_ascii=False
        )

    # --------------------------------------------------------
    # Show top conferences
    # --------------------------------------------------------

    print("\n")
    print("=" * 80)
    print("TOP MATCHES")
    print("=" * 80)

    for index, conference in enumerate(
        personalized[:20],
        start=1
    ):

        print(
            f"\n{index}. "
            f"{conference['title']}"
        )

        print(
            f"   Score: "
            f"{conference['relevance_score']}%"
        )

        print(
            f"   Matched: "
            f"{', '.join(conference['matched_interests'])}"
        )

        print(
            f"   Date: "
            f"{conference['start_date']} "
            f"→ "
            f"{conference['end_date']}"
        )

        print(
            f"   Location: "
            f"{conference['city']}, "
            f"{conference['country']}"
        )

    print("\n")
    print("=" * 80)
    print("DONE")
    print("=" * 80)

    print(
        f"\nSaved to:\n"
        f"{OUTPUT_FILE}"
    )


if __name__ == "__main__":
    main()