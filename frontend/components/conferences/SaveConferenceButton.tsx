"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/src/lib/api";
import {
  getConferenceSavedStatus,
  removeSavedConference,
  saveConference,
} from "@/src/lib/saved";
import { createClient } from "@/src/lib/supabase/client";

type ButtonState =
  | "checking"
  | "signed-out"
  | "ready"
  | "saving"
  | "load-error"
  | "action-error";

function needsSignIn(error: unknown): boolean {
  return error instanceof ApiRequestError && (error.status === 401 || error.status === 403);
}

function errorMessage(error: unknown, action: "load" | "save" | "remove"): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401 || error.status === 403) {
      return "Your session is unavailable. Sign in again to manage saved conferences.";
    }
    if (error.status === 404) return "This conference is no longer available.";
  }

  if (action === "load") return "Could not check whether this conference is saved. Try again.";
  if (action === "remove") return "Could not remove this saved conference. Try again.";
  return "Could not save this conference. Try again.";
}

export default function SaveConferenceButton({ conferenceId, title }: {
  conferenceId: number;
  title: string;
}) {
  const router = useRouter();
  const accessToken = useRef<string | null>(null);
  const [buttonState, setButtonState] = useState<ButtonState>("checking");
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState("");
  const [signInRequired, setSignInRequired] = useState(false);

  const loadSavedState = useCallback(async (token: string) => {
    setButtonState("checking");
    setError("");

    try {
      const result = await getConferenceSavedStatus(conferenceId, token);
      if (accessToken.current !== token) return;
      setIsSaved(result.saved);
      setSignInRequired(false);
      setButtonState("ready");
    } catch (cause) {
      if (accessToken.current !== token) return;
      setError(errorMessage(cause, "load"));
      setSignInRequired(needsSignIn(cause));
      setButtonState("load-error");
    }
  }, [conferenceId]);

  useEffect(() => {
    let active = true;
    let authRequest = 0;
    let unsubscribe = () => {};

    const updateSession = async (token: string | null) => {
      const requestId = ++authRequest;
      accessToken.current = token;
      setError("");
      setSignInRequired(false);

      if (!token) {
        setButtonState("signed-out");
        setIsSaved(false);
        return;
      }

      setButtonState("checking");
      try {
        const result = await getConferenceSavedStatus(conferenceId, token);
        if (!active || requestId !== authRequest || accessToken.current !== token) return;
        setIsSaved(result.saved);
        setButtonState("ready");
      } catch (cause) {
        if (!active || requestId !== authRequest || accessToken.current !== token) return;
        setError(errorMessage(cause, "load"));
        setButtonState("load-error");
      }
    };

    void Promise.resolve()
      .then(() => createClient())
      .then((supabaseClient) => {
        if (!active) return null;
        const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
          void updateSession(session?.access_token ?? null);
        });
        unsubscribe = () => subscription.unsubscribe();
        return supabaseClient.auth.getSession();
      })
      .then((result) => {
        if (!active || !result) return;
        if (result.error) {
          accessToken.current = null;
          setError("Could not check your sign-in session. Try again.");
          setButtonState("load-error");
          return;
        }
        void updateSession(result.data.session?.access_token ?? null);
      })
      .catch(() => {
        if (!active) return;
        accessToken.current = null;
        setError("Sign-in is not available right now. Please try again later.");
        setButtonState("load-error");
      });

    return () => {
      active = false;
      authRequest += 1;
      accessToken.current = null;
      unsubscribe();
    };
  }, [conferenceId]);

  async function handleClick() {
    if (buttonState === "checking" || buttonState === "saving") return;

    const token = accessToken.current;
    if (!token || buttonState === "signed-out" || signInRequired) {
      router.push("/login");
      return;
    }

    if (buttonState === "load-error") {
      await loadSavedState(token);
      return;
    }

    const previousState = isSaved;
    setButtonState("saving");
    setError("");

    try {
      if (previousState) {
        await removeSavedConference(conferenceId, token);
      } else {
        await saveConference(conferenceId, token);
      }
      if (accessToken.current !== token) return;
      setIsSaved(!previousState);
      setSignInRequired(false);
      setButtonState("ready");
    } catch (cause) {
      if (accessToken.current !== token) return;
      setIsSaved(previousState);
      setError(errorMessage(cause, previousState ? "remove" : "save"));
      setSignInRequired(needsSignIn(cause));
      setButtonState("action-error");
    }
  }

  const busy = buttonState === "checking" || buttonState === "saving";
  const label = buttonState === "checking"
    ? "Checking…"
    : buttonState === "saving"
      ? "Saving…"
      : buttonState === "signed-out" || signInRequired
          ? "Sign in"
          : buttonState === "load-error"
            ? "Retry"
            : isSaved
              ? "★ Saved"
              : "☆ Save";

  return (
    <span className="save-conference-control">
      <button
        className={`save-conference-link${isSaved ? " is-saved" : ""}`}
        type="button"
        data-conference-id={conferenceId}
        aria-label={buttonState === "signed-out" || signInRequired ? `Sign in to save ${title}` : `${isSaved ? "Remove saved conference" : "Save conference"}: ${title}`}
        aria-pressed={buttonState === "ready" ? isSaved : undefined}
        aria-busy={busy}
        onClick={() => void handleClick()}
        disabled={busy}
        title={buttonState === "signed-out" ? "Sign in to save this conference." : undefined}
      >
        {label}
      </button>
      {error && <span className="save-conference-feedback" role="alert">{error}</span>}
    </span>
  );
}