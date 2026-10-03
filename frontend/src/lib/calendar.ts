import {
  compareAsc,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Conference } from "@/src/types/api";

export type CalendarEventKind = "deadline" | "conference";
export type DeadlineUrgency = "passed" | "today" | "urgent" | "upcoming" | "normal";

export interface CalendarEvent {
  id: string;
  conference: Conference;
  date: Date;
  kind: CalendarEventKind;
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
      const deadline = parseISO(conference.paper_deadline);
      if (isValid(deadline)) {
        events.push({
          id: `${conference.id}-deadline`,
          conference,
          date: deadline,
          kind: "deadline",
        });
      }
    }

    const start = parseISO(conference.start_date);
    const end = parseISO(conference.end_date);
    if (!isValid(start) || !isValid(end)) continue;

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
  if (!conference.paper_deadline) return null;
  return conference.days_until_deadline ?? differenceInCalendarDays(
    parseISO(conference.paper_deadline),
    startOfDay(today),
  );
}

export function getDeadlineUrgency(daysRemaining: number | null): DeadlineUrgency {
  if (daysRemaining === null) return "normal";
  if (daysRemaining < 0) return "passed";
  if (daysRemaining === 0) return "today";
  if (daysRemaining <= 7) return "urgent";
  if (daysRemaining <= 30) return "upcoming";
  return "normal";
}

export function formatConferenceDateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (!isValid(start) || !isValid(end)) return "Dates not listed";
  if (format(start, "yyyy-MM") === format(end, "yyyy-MM")) {
    return `${format(start, "MMM d")}–${format(end, "d, yyyy")}`;
  }
  return `${format(start, "MMM d")}–${format(end, "MMM d, yyyy")}`;
}
