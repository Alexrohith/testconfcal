import {
  compareAsc,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isValid,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Conference } from "@/src/types/api";

export type CalendarEventKind = "deadline" | "conference";
export type DeadlineUrgency = "passed" | "today" | "urgent" | "upcoming" | "normal";
export type PaperDeadlineClassification =
  | "passed"
  | "today"
  | "1_to_7_days"
  | "8_to_30_days"
  | "31_plus_days"
  | "no_deadline";
export type PaperDeadlineFilter = "today" | "7days" | "30days" | "passed" | "none" | "";

export interface PaperDeadlineInfo {
  classification: PaperDeadlineClassification;
  daysUntilDeadline: number | null;
}

export interface CalendarEvent {
  id: string;
  conference: Conference;
  date: Date;
  kind: CalendarEventKind;
}

const MILLISECONDS_PER_DAY = 86_400_000;

export function dateFromDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year
    || utcDate.getUTCMonth() !== month - 1
    || utcDate.getUTCDate() !== day
  ) return null;

  return new Date(year, month - 1, day, 12);
}

function dateOnlyOrdinal(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MILLISECONDS_PER_DAY);
}

function classifyDaysUntilDeadline(daysUntilDeadline: number): PaperDeadlineClassification {
  if (daysUntilDeadline < 0) return "passed";
  if (daysUntilDeadline === 0) return "today";
  if (daysUntilDeadline <= 7) return "1_to_7_days";
  if (daysUntilDeadline <= 30) return "8_to_30_days";
  return "31_plus_days";
}

export function getPaperDeadlineInfo(
  paperDeadline: string | null,
  daysUntilDeadline?: number | null,
  today = new Date(),
): PaperDeadlineInfo {
  if (!paperDeadline) {
    return { classification: "no_deadline", daysUntilDeadline: null };
  }

  const deadlineDate = dateFromDateOnly(paperDeadline);
  if (!deadlineDate) {
    return { classification: "no_deadline", daysUntilDeadline: null };
  }

  const daysRemaining = typeof daysUntilDeadline === "number" && Number.isFinite(daysUntilDeadline)
    ? daysUntilDeadline
    : dateOnlyOrdinal(deadlineDate) - dateOnlyOrdinal(today);

  return {
    classification: classifyDaysUntilDeadline(daysRemaining),
    daysUntilDeadline: daysRemaining,
  };
}

export function paperDeadlineLabel(info: PaperDeadlineInfo): string {
  if (info.classification === "passed") return "Paper deadline passed";
  if (info.classification === "today") return "Paper deadline is today";
  if (info.classification === "no_deadline") return "No paper deadline listed";

  const days = info.daysUntilDeadline;
  return `Paper deadline in ${days} ${days === 1 ? "day" : "days"}`;
}

export function matchesPaperDeadlineFilter(
  info: PaperDeadlineInfo,
  filter: PaperDeadlineFilter,
): boolean {
  if (!filter) return true;
  if (filter === "none") return info.classification === "no_deadline";
  if (filter === "passed") return info.classification === "passed";
  if (filter === "today") return info.classification === "today";
  if (filter === "7days") return info.classification === "1_to_7_days";
  return info.classification === "8_to_30_days";
}

export function getCalendarDays(month: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
}

export function getCalendarEvents(conferences: Conference[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const conference of conferences) {
    if (conference.paper_deadline) {
      const deadline = dateFromDateOnly(conference.paper_deadline);
      if (deadline) {
        events.push({
          id: `${conference.id}-deadline`,
          conference,
          date: deadline,
          kind: "deadline",
        });
      }
    }

    const start = dateFromDateOnly(conference.start_date);
    const end = dateFromDateOnly(conference.end_date);
    if (!start || !end) continue;

    const finalDay = isBefore(end, start) ? start : end;
    for (const date of eachDayOfInterval({ start, end: finalDay })) {
      events.push({
        id: `${conference.id}-conference-${format(date, "yyyy-MM-dd")}`,
        conference,
        date,
        kind: "conference",
      });
    }
  }

  return events.sort((left, right) => {
    const dateOrder = compareAsc(left.date, right.date);
    if (dateOrder !== 0) return dateOrder;
    return left.kind === "deadline" ? -1 : 1;
  });
}

export function getDeadlineDaysRemaining(conference: Conference, today = new Date()): number | null {
  return getPaperDeadlineInfo(
    conference.paper_deadline,
    conference.days_until_deadline,
    today,
  ).daysUntilDeadline;
}

export function getDeadlineUrgency(daysRemaining: number | null): DeadlineUrgency {
  if (daysRemaining === null) return "normal";
  const classification = classifyDaysUntilDeadline(daysRemaining);
  if (classification === "passed" || classification === "today") return classification;
  if (classification === "1_to_7_days") return "urgent";
  if (classification === "8_to_30_days") return "upcoming";
  return "normal";
}

export function formatConferenceDateRange(startDate: string, endDate: string): string {
  const start = dateFromDateOnly(startDate);
  const end = dateFromDateOnly(endDate);
  if (!start || !end || !isValid(start) || !isValid(end)) return "Dates not listed";
  if (format(start, "yyyy-MM") === format(end, "yyyy-MM")) {
    return `${format(start, "MMM d")}–${format(end, "d, yyyy")}`;
  }
  return `${format(start, "MMM d")}–${format(end, "MMM d, yyyy")}`;
}
