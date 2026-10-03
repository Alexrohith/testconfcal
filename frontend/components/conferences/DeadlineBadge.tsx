import { getPaperDeadlineInfo, paperDeadlineLabel } from "@/src/lib/calendar";

interface DeadlineBadgeProps {
  paperDeadline: string | null;
  daysUntilDeadline: number | null;
}

export default function DeadlineBadge({ paperDeadline, daysUntilDeadline }: DeadlineBadgeProps) {
  const info = getPaperDeadlineInfo(paperDeadline, daysUntilDeadline);
  const label = paperDeadlineLabel(info);
  const statusLabel = info.classification === "passed"
    ? "Passed"
    : info.classification === "today"
      ? "Today"
      : info.classification === "1_to_7_days"
        ? "Due soon"
        : info.classification === "8_to_30_days"
          ? "Upcoming"
          : info.classification === "31_plus_days"
            ? "Later"
            : "No deadline";
  const badgeClass = info.classification === "passed"
    ? "passed"
    : info.classification === "today" || info.classification === "1_to_7_days"
      ? "urgent"
      : info.classification === "no_deadline"
        ? "no-deadline"
        : "upcoming";

  return (
    <div className="deadline-panel">
      <div className="deadline-copy">
        <span className="deadline-caption">Paper submission</span>
        <span className="deadline-text">{label}</span>
      </div>
      <span className={`deadline-badge ${badgeClass}`}>{statusLabel}</span>
    </div>
  );
}