import Link from "next/link";
import type { Conference } from "@/src/types/api";
import DeadlineBadge from "@/components/conferences/DeadlineBadge";
import SaveConferenceButton from "@/components/conferences/SaveConferenceButton";
import { formatConferenceDateRange } from "@/src/lib/calendar";
import type { ConferenceCategory } from "@/src/types/api";

interface ConferenceCardProps {
  conference: Conference;
  categoryLabel?: string;
  comparisonSelected?: boolean;
  comparisonDisabled?: boolean;
  onToggleComparison?: (conference: Conference) => void;
  recommendation?: {
    matchPercentage: number;
    matchedCategories: ConferenceCategory[];
  };
}

export default function ConferenceCard({
  conference,
  categoryLabel,
  comparisonSelected = false,
  comparisonDisabled = false,
  onToggleComparison,
  recommendation,
}: ConferenceCardProps) {
  const location = [conference.city, conference.country].filter(Boolean).join(", ") || "Location not listed";
  const format = conference.is_virtual ? "Virtual" : conference.format || "Format not listed";

  return (
    <article className={`conference-card${comparisonSelected ? " is-comparison-selected" : ""}`}>
      <div className="card-topline">
        {categoryLabel ? <span className="category-chip">{categoryLabel}</span> : <span className="format-label">Conference</span>}
        <span className="format-label">{format}</span>
      </div>
      {recommendation ? (
        <div className="recommendation-match">
          <strong>{recommendation.matchPercentage}% match</strong>
          <div className="recommendation-categories" aria-label="Matched research categories">
            {recommendation.matchedCategories.map((matchedCategory) => (
              <span className="dashboard-interest-tag" key={matchedCategory.name}>
                {matchedCategory.display_name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <h2>
        {recommendation
          ? <Link href={`/conference/${conference.id}`}>{conference.title}</Link>
          : conference.title}
      </h2>
      <div className="card-meta"><span>{location}</span><span>{formatConferenceDateRange(conference.start_date, conference.end_date)}</span></div>
      <DeadlineBadge
        paperDeadline={conference.paper_deadline}
        daysUntilDeadline={conference.days_until_deadline}
      />
      {onToggleComparison && (
        <div className="conference-compare-control">
          <button
            className="comparison-toggle"
            type="button"
            aria-pressed={comparisonSelected}
            aria-label={`${comparisonSelected ? "Remove" : "Add"} ${conference.title} ${comparisonSelected ? "from" : "to"} comparison`}
            aria-describedby={
              comparisonDisabled && !comparisonSelected
                ? `comparison-limit-${conference.id}`
                : undefined
            }
            title={!comparisonSelected && comparisonDisabled
              ? "Three conferences are already selected. Remove one before adding another."
              : undefined}
            disabled={!comparisonSelected && comparisonDisabled}
            onClick={() => onToggleComparison(conference)}
          >
            <span aria-hidden="true">{comparisonSelected ? "✓" : "+"}</span>
            {comparisonSelected ? "Selected for comparison" : "Compare"}
          </button>
          {comparisonDisabled && !comparisonSelected && (
            <span className="sr-only" id={`comparison-limit-${conference.id}`}>
              Three conferences are already selected. Remove one before adding another.
            </span>
          )}
        </div>
      )}
      <div className="card-footer">
        <span className="card-dates">Conference dates</span>
        <div className="card-actions">
          <SaveConferenceButton conferenceId={conference.id} title={conference.title} />
          <Link className="text-link" href={`/conference/${conference.id}`}>View details <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </article>
  );
}