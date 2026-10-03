import type { DeadlineStatus } from "@/src/types/api";

interface DeadlineBadgeProps {
  status: DeadlineStatus;
  daysUntilDeadline: number | null;
}

export default function DeadlineBadge({ status, daysUntilDeadline }: DeadlineBadgeProps) {
  const label = status === "passed"
    ? "Deadline passed"
    : status === "no_deadline"
      ? "No paper deadline"
      : daysUntilDeadline === 0
        ? "Deadline today"
        : `Deadline in ${daysUntilDeadline ?? "—"} ${daysUntilDeadline === 1 ? "day" : "days"}`;
  const statusLabel = status === "urgent" ? "Urgent" : status === "upcoming" ? "Upcoming" : status === "passed" ? "Passed" : "No deadline";

  return (
    <div className="deadline-panel">
      <div className="deadline-copy">
        <span className="deadline-caption">Paper submission</span>
        <span className="deadline-text">{label}</span>
      </div>
      <span className={`deadline-badge ${status.replace("_", "-")}`}>{statusLabel}</span>
    </div>
  );
}