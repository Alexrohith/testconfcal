"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/src/lib/api";
import {
  createDeadlineReminder,
  deleteDeadlineReminder,
  getDeadlineReminders,
  updateDeadlineReminder,
} from "@/src/lib/reminders";
import { createClient } from "@/src/lib/supabase/client";
import { getPaperDeadlineInfo } from "@/src/lib/calendar";
import type { DeadlineReminder } from "@/src/types/api";

const reminderOptions = [7, 3, 1] as const;
type ReminderDays = typeof reminderOptions[number];

type SessionState =
  | { status: "checking"; accessToken: null }
  | { status: "signed-out"; accessToken: null }
  | { status: "authenticated" | "expired"; accessToken: string };

interface ReminderLoadState {
  conferenceId: number;
  accessToken: string;
  reminder: DeadlineReminder | null;
  error: string | null;
}

function sessionError(error: unknown): boolean {
  return error instanceof ApiRequestError
    && (error.status === 401 || error.status === 403);
}

function actionErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401 || error.status === 403) {
      return "Your session has expired. Sign in again to manage this reminder.";
    }
    if (error.status === 404) {
      return "This reminder or conference is no longer available. Refresh the reminder state.";
    }
    if (error.status === 409) {
      return "The paper deadline may have changed or passed. Refresh the conference details before trying again.";
    }
    if (error.status === 422) {
      return "This reminder is not valid for the current paper deadline.";
    }
    if (error.status >= 500) {
      return "The reminder service is temporarily unavailable. Please try again.";
    }
  }

  return "Could not update this reminder. Check your connection and try again.";
}

export default function DeadlineReminderControl({
  conferenceId,
  paperDeadline,
  onRefreshConference,
}: {
  conferenceId: number;
  paperDeadline: string | null;
  onRefreshConference: () => void;
}) {
  const [session, setSession] = useState<SessionState>({
    status: "checking",
    accessToken: null,
  });
  const [loadedState, setLoadedState] = useState<ReminderLoadState | null>(null);
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState(false);
  const [pendingDays, setPendingDays] = useState<ReminderDays | null>(null);
  const [actionError, setActionError] = useState("");
  const accessTokenRef = useRef<string | null>(null);
  const actionLock = useRef(false);
  const loadKey = `${conferenceId}:${session.accessToken ?? ""}:${retry}`;
  const deadlineInfo = getPaperDeadlineInfo(paperDeadline);
  const eligibleDeadline = paperDeadline !== null
    && deadlineInfo.classification !== "no_deadline"
    && deadlineInfo.classification !== "passed"
    && deadlineInfo.classification !== "today";
  const reminder = session.status === "authenticated"
    && loadedState?.conferenceId === conferenceId
    && loadedState.accessToken === session.accessToken
    ? loadedState.reminder
    : null;
  const loadingReminder = session.status === "checking"
    || (session.status === "authenticated"
      && (loadedState?.conferenceId !== conferenceId
        || loadedState.accessToken !== session.accessToken));
  const loadError = session.status === "authenticated"
    && loadedState?.conferenceId === conferenceId
    && loadedState.accessToken === session.accessToken
    ? loadedState.error
    : null;

  useLayoutEffect(() => {
    accessTokenRef.current = session.status === "authenticated" ? session.accessToken : null;
  }, [session]);

  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;
    let unsubscribe = () => {};

    const updateSession = (token: string | null) => {
      accessTokenRef.current = token;
      setActionError("");
      setSession(token
        ? { status: "authenticated", accessToken: token }
        : { status: "signed-out", accessToken: null });
    };

    void Promise.resolve()
      .then(() => createClient())
      .then((supabase) => {
        if (!active) return null;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, authSession) => {
          receivedAuthEvent = true;
          updateSession(authSession?.access_token ?? null);
        });
        unsubscribe = () => subscription.unsubscribe();
        return supabase.auth.getSession();
      })
      .then((result) => {
        if (!active || !result || receivedAuthEvent) return;
        if (result.error) {
          accessTokenRef.current = null;
          setSession({ status: "signed-out", accessToken: null });
          return;
        }
        updateSession(result.data.session?.access_token ?? null);
      })
      .catch(() => {
        if (!active) return;
        accessTokenRef.current = null;
        setSession({ status: "signed-out", accessToken: null });
      });

    return () => {
      active = false;
      accessTokenRef.current = null;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session.status !== "authenticated") return;

    const controller = new AbortController();
    const accessToken = session.accessToken;
    getDeadlineReminders(accessToken, controller.signal)
      .then(({ reminders }) => {
        if (!controller.signal.aborted && accessTokenRef.current === accessToken) {
          const configured = reminders.find(
            (item) => item.conference_id === conferenceId && item.enabled,
          ) ?? null;
          setLoadedState({ conferenceId, accessToken, reminder: configured, error: null });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || accessTokenRef.current !== accessToken) return;
        if (sessionError(error)) {
          setSession({ status: "expired", accessToken });
          return;
        }
        setLoadedState({
          conferenceId,
          accessToken,
          reminder: null,
          error: "Could not load your reminder settings. Please try again.",
        });
      });

    return () => controller.abort();
  }, [conferenceId, loadKey, session]);

  const reloadReminder = useCallback(() => {
    if (session.status !== "authenticated") return;
    setLoadedState(null);
    setActionError("");
    setRetry((value) => value + 1);
  }, [session]);

  const saveReminder = useCallback(async (daysBefore: ReminderDays) => {
    if (session.status !== "authenticated" || pending || actionLock.current) return;
    if (reminder?.days_before === daysBefore) return;
    const accessToken = session.accessToken;
    actionLock.current = true;
    setPending(true);
    setPendingDays(daysBefore);
    setActionError("");

    try {
      const result = reminder
        ? await updateDeadlineReminder(reminder.id, daysBefore, accessToken)
        : await createDeadlineReminder(conferenceId, daysBefore, accessToken);
      if (accessTokenRef.current !== accessToken) return;
      setLoadedState({ conferenceId, accessToken, reminder: result, error: null });
    } catch (error: unknown) {
      if (accessTokenRef.current !== accessToken) return;
      if (sessionError(error)) setSession({ status: "expired", accessToken });
      if (error instanceof ApiRequestError && (error.status === 404 || error.status === 409)) {
        onRefreshConference();
        reloadReminder();
      }
      setActionError(actionErrorMessage(error));
    } finally {
      actionLock.current = false;
      setPending(false);
      setPendingDays(null);
    }
  }, [conferenceId, onRefreshConference, pending, reloadReminder, reminder, session]);

  const turnOffReminder = useCallback(async () => {
    if (session.status !== "authenticated" || !reminder || pending || actionLock.current) return;
    const accessToken = session.accessToken;
    actionLock.current = true;
    setPending(true);
    setActionError("");

    try {
      await deleteDeadlineReminder(reminder.id, accessToken);
      if (accessTokenRef.current !== accessToken) return;
      setLoadedState({ conferenceId, accessToken, reminder: null, error: null });
    } catch (error: unknown) {
      if (accessTokenRef.current !== accessToken) return;
      if (sessionError(error)) setSession({ status: "expired", accessToken });
      setActionError(actionErrorMessage(error));
      if (error instanceof ApiRequestError && error.status === 404) reloadReminder();
    } finally {
      actionLock.current = false;
      setPending(false);
    }
  }, [conferenceId, pending, reloadReminder, reminder, session]);

  if (session.status === "signed-out") {
    return (
      <section className="deadline-reminder" aria-label="Deadline reminder">
        <h2>Deadline reminder</h2>
        {eligibleDeadline
          ? <p><Link href="/login">Sign in to set a deadline reminder</Link></p>
          : <p>{deadlineUnavailableMessage(deadlineInfo.classification)}</p>}
      </section>
    );
  }

  if (session.status === "checking" || loadingReminder) {
    return (
      <section className="deadline-reminder" aria-label="Deadline reminder" aria-busy="true">
        <div className="deadline-reminder-heading-skeleton" />
        <div className="deadline-reminder-options-skeleton">
          <span /><span /><span />
        </div>
      </section>
    );
  }

  if (session.status === "expired") {
    return (
      <section className="deadline-reminder" aria-label="Deadline reminder">
        <h2>Deadline reminder</h2>
        <p role="alert">Your session has expired. <Link href="/login">Sign in again</Link> to manage reminders.</p>
      </section>
    );
  }

  if (!eligibleDeadline) {
    return (
      <section className="deadline-reminder" aria-label="Deadline reminder">
        <h2>Deadline reminder</h2>
        <p>{deadlineUnavailableMessage(deadlineInfo.classification)}</p>
      </section>
    );
  }

  return (
    <section className="deadline-reminder" aria-label="Deadline reminder">
      <div className="deadline-reminder-heading">
        <h2>Deadline reminder</h2>
        {reminder
          ? <p>Remind me {reminder.days_before} days before the deadline.</p>
          : <p>No reminder is currently set.</p>}
      </div>

      {loadError && (
        <div className="deadline-reminder-error" role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={reloadReminder}>Retry</button>
        </div>
      )}
      {actionError && (
        <div className="deadline-reminder-error" role="alert">
          <span>{actionError}</span>
        </div>
      )}

      <fieldset className="deadline-reminder-fieldset" disabled={pending || Boolean(loadError)}>
        <legend>Remind me:</legend>
        <div className="deadline-reminder-options">
          {reminderOptions.map((daysBefore) => {
            const selected = reminder?.days_before === daysBefore;
            return (
              <button
                className={`deadline-reminder-option${selected ? " is-selected" : ""}`}
                key={daysBefore}
                type="button"
                aria-label={`Remind me ${daysBefore} ${daysBefore === 1 ? "day" : "days"} before the deadline`}
                aria-pressed={selected}
                aria-busy={pending && pendingDays === daysBefore}
                onClick={() => void saveReminder(daysBefore)}
              >
                {pending && pendingDays === daysBefore
                  ? <span className="deadline-reminder-spinner" aria-hidden="true" />
                  : null}
                {daysBefore} days before
              </button>
            );
          })}
        </div>
      </fieldset>

      {reminder && (
        <button
          className="deadline-reminder-turn-off"
          type="button"
          onClick={() => void turnOffReminder()}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? "Updating reminder…" : "Turn off reminder"}
        </button>
      )}
    </section>
  );
}

function deadlineUnavailableMessage(
  classification: ReturnType<typeof getPaperDeadlineInfo>["classification"],
): string {
  if (classification === "today") {
    return "The paper deadline is today. Reminders cannot be created on the deadline.";
  }
  if (classification === "passed") {
    return "The paper deadline has passed. Reminder controls are unavailable.";
  }
  return "No paper deadline is listed, so a reminder cannot be set.";
}
