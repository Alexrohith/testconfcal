"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isValid, parseISO } from "date-fns";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { ApiRequestError } from "@/src/lib/api";
import { getNotifications, markNotificationRead } from "@/src/lib/notifications";
import type { Notification } from "@/src/types/api";

interface NotificationCenterProps {
  accessToken: string;
}

function isSessionError(error: unknown): boolean {
  return error instanceof ApiRequestError
    && (error.status === 401 || error.status === 403);
}

function formatNotificationDate(value: string, pattern: string): string {
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, pattern) : "Date unavailable";
}

export default function NotificationCenter({ accessToken }: NotificationCenterProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notificationData, setNotificationData] = useState<{
    accessToken: string;
    notifications: Notification[];
  } | null>(null);
  const [requestError, setRequestError] = useState<{
    accessToken: string;
    message: string;
    sessionExpired: boolean;
  } | null>(null);
  const [settledAttempt, setSettledAttempt] = useState("");
  const [retry, setRetry] = useState(0);
  const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pendingIdsRef = useRef(new Set<number>());
  const accessTokenRef = useRef(accessToken);
  useLayoutEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);
  const attemptKey = `${accessToken}:${retry}`;
  const notifications = notificationData?.accessToken === accessToken
    ? notificationData.notifications
    : [];
  const currentError = requestError?.accessToken === accessToken ? requestError : null;
  const loading = settledAttempt !== attemptKey;
  const unreadCount = notifications.reduce(
    (count, notification) => count + (notification.read_at === null ? 1 : 0),
    0,
  );

  useEffect(() => {
    const controller = new AbortController();

    getNotifications(accessToken, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setNotificationData({ accessToken, notifications: response.notifications });
          setRequestError(null);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (isSessionError(error)) {
          setRequestError({
            accessToken,
            sessionExpired: true,
            message: "Your session has expired. Sign in again to view notifications.",
          });
        } else {
          setRequestError({
            accessToken,
            sessionExpired: false,
            message: "Notifications could not be loaded. Please try again.",
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSettledAttempt(attemptKey);
      });

    return () => controller.abort();
  }, [accessToken, attemptKey]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)
        && !triggerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const handleNotificationClick = useCallback(async (
    event: ReactMouseEvent<HTMLAnchorElement>,
    notification: Notification,
  ) => {
    if (notification.read_at !== null) {
      setOpen(false);
      return;
    }

    event.preventDefault();
    if (pendingIdsRef.current.has(notification.id)) return;

    pendingIdsRef.current.add(notification.id);
    setPendingIds(new Set(pendingIdsRef.current));
    setRequestError(null);

    try {
      const response = await markNotificationRead(notification.id, accessToken);
      if (accessTokenRef.current !== accessToken) return;
      setNotificationData((current) => {
        if (current?.accessToken !== accessToken) return current;
        return {
          ...current,
          notifications: current.notifications.map((item) => (
            item.id === notification.id ? { ...item, read_at: response.read_at } : item
          )),
        };
      });
      setOpen(false);
      router.push(`/conferences/${notification.conference_id}`);
    } catch (error: unknown) {
      if (isSessionError(error)) {
        setRequestError({
          accessToken,
          sessionExpired: true,
          message: "Your session has expired. Sign in again to continue.",
        });
      } else {
        setRequestError({
          accessToken,
          sessionExpired: false,
          message: "Could not mark this notification as read. Try again.",
        });
      }
    } finally {
      pendingIdsRef.current.delete(notification.id);
      setPendingIds(new Set(pendingIdsRef.current));
    }
  }, [accessToken, router]);

  const visibleNotifications = notifications.slice(0, 8);
  const buttonLabel = unreadCount > 0
    ? `Notifications, ${unreadCount} unread`
    : "Notifications";

  return (
    <div className="notification-center">
      <button
        ref={triggerRef}
        className="notification-trigger"
        type="button"
        aria-label={buttonLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="notification-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        <span className="notification-count" aria-hidden="true">
          {unreadCount > 9 ? "9+" : unreadCount > 0 ? unreadCount : ""}
        </span>
      </button>
      {open && (
        <div
          ref={panelRef}
          id="notification-panel"
          className="notification-panel"
          role="dialog"
          aria-label="Notifications"
          aria-busy={loading}
        >
          <div className="notification-panel-heading">
            <h2>Notifications</h2>
            {unreadCount > 0 && <span>{unreadCount} unread</span>}
          </div>

          {currentError && (
            <div className="notification-error" role="alert">
              <p>{currentError.message}</p>
              {currentError.sessionExpired ? (
                <Link href="/login" onClick={() => setOpen(false)}>Sign in</Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (loading) return;
                    setRequestError(null);
                    setRetry((count) => count + 1);
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="notification-skeleton-list" role="status" aria-label="Loading notifications">
              {Array.from({ length: 3 }, (_, index) => (
                <div className="notification-skeleton" key={index} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : !currentError && notifications.length === 0 ? (
            <p className="notification-empty">You’re all caught up. No deadline reminders yet.</p>
          ) : (
            !currentError && (
              <div className="notification-list">
                {visibleNotifications.map((notification) => {
                  const unread = notification.read_at === null;
                  const pending = pendingIds.has(notification.id);
                  const deadline = formatNotificationDate(
                    notification.paper_deadline,
                    "MMMM d, yyyy",
                  );
                  const created = formatNotificationDate(
                    notification.created_at,
                    "MMM d, h:mm a",
                  );

                  return (
                    <Link
                      className={`notification-item${unread ? " is-unread" : ""}`}
                      key={notification.id}
                      href={`/conferences/${notification.conference_id}`}
                      aria-label={`${notification.conference_title}. Paper deadline ${deadline}. ${unread ? "Unread." : "Read."}`}
                      aria-disabled={pending}
                      onClick={(event) => void handleNotificationClick(event, notification)}
                    >
                      <span className="notification-item-dot" aria-hidden="true" />
                      <span className="notification-item-content">
                        <strong>{notification.conference_title}</strong>
                        <span className="notification-item-message">Paper deadline is coming up: {deadline}</span>
                        <time dateTime={notification.created_at}>{created}</time>
                      </span>
                      {pending && <span className="notification-item-pending">Updating…</span>}
                    </Link>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
