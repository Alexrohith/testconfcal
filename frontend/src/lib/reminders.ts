import { requestWithAccessToken } from "@/src/lib/api";
import type {
  DeadlineReminder,
  DeadlineRemindersResponse,
} from "@/src/types/api";

export function getDeadlineReminders(
  accessToken: string,
  signal?: AbortSignal,
): Promise<DeadlineRemindersResponse> {
  return requestWithAccessToken(
    "/api/reminders",
    "GET",
    accessToken,
    signal,
  );
}

export function createDeadlineReminder(
  conferenceId: number,
  daysBefore: 1 | 3 | 7,
  accessToken: string,
): Promise<DeadlineReminder> {
  return requestWithAccessToken(
    "/api/reminders",
    "POST",
    accessToken,
    undefined,
    { conference_id: conferenceId, days_before: daysBefore },
  );
}

export function updateDeadlineReminder(
  reminderId: number,
  daysBefore: 1 | 3 | 7,
  accessToken: string,
): Promise<DeadlineReminder> {
  return requestWithAccessToken(
    `/api/reminders/${encodeURIComponent(reminderId)}`,
    "PATCH",
    accessToken,
    undefined,
    { days_before: daysBefore },
  );
}

export function deleteDeadlineReminder(
  reminderId: number,
  accessToken: string,
): Promise<{ deleted: boolean }> {
  return requestWithAccessToken(
    `/api/reminders/${encodeURIComponent(reminderId)}`,
    "DELETE",
    accessToken,
  );
}
