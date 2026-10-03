import Link from "next/link";
import type { Conference } from "@/src/types/api";
import DeadlineBadge from "@/components/conferences/DeadlineBadge";
import SaveConferenceButton from "@/components/conferences/SaveConferenceButton";
import { formatConferenceDateRange } from "@/src/lib/calendar";

interface ConferenceCardProps {
  conference: Conference;
  categoryLabel?: string;
}

export default function ConferenceCard({ conference, categoryLabel }: ConferenceCardProps) {
  const location = [conference.city, conference.country].filter(Boolean).join(", ") || "Location not listed";
  const format = conference.is_virtual ? "Virtual" : conference.format || "Format not listed";

  return (
    <article className="conference-card">
      <div className="card-topline">
        {categoryLabel ? <span className="category-chip">{categoryLabel}</span> : <span className="format-label">Conference</span>}
        <span className="format-label">{format}</span>
      </div>
      <h2>{conference.title}</h2>
      <div className="card-meta"><span>{location}</span><span>{formatConferenceDateRange(conference.start_date, conference.end_date)}</span></div>
      <DeadlineBadge status={conference.deadline_status} daysUntilDeadline={conference.days_until_deadline} />
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