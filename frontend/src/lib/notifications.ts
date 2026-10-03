import { requestWithAccessToken } from "@/src/lib/api";
import type {
  NotificationReadResponse,
  NotificationsResponse,
} from "@/src/types/api";

export async function getNotifications(
  accessToken: string,
  signal?: AbortSignal,
): Promise<NotificationsResponse> {
  return requestWithAccessToken(
    "/api/notifications",
    "GET",
    accessToken,
    signal,
  );
}

export function markNotificationRead(
  notificationId: number,
  accessToken: string,
  signal?: AbortSignal,
): Promise<NotificationReadResponse> {
  return requestWithAccessToken(
    `/api/notifications/${encodeURIComponent(notificationId)}/read`,
    "PATCH",
    accessToken,
    signal,
  );
}
