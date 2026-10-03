"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ConferenceCard from "@/components/conferences/ConferenceCard";
import ConferenceSkeleton from "@/components/conferences/ConferenceSkeleton";
import { ApiRequestError } from "@/src/lib/api";
import { getSavedConferences } from "@/src/lib/saved";
import { createClient } from "@/src/lib/supabase/client";
import type { Conference } from "@/src/types/api";

type SavedPageState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "loaded"; conferences: Conference[] }
  | { status: "error"; message: string; authenticationError: boolean };

export default function SavedPage() {
  const [pageState, setPageState] = useState<SavedPageState>({ status: "loading" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;
    let requestId = 0;
    let unsubscribe = () => {};

    const loadForSession = async (accessToken: string | null) => {
      const currentRequestId = ++requestId;
      if (!accessToken) {
        setPageState({ status: "unauthenticated" });
        return;
      }

      setPageState({ status: "loading" });
      try {
        const conferences = await getSavedConferences(accessToken);
        if (active && currentRequestId === requestId) {
          setPageState({ status: "loaded", conferences });
        }
      } catch (error) {
        if (!active || currentRequestId !== requestId) return;
        const authenticationError = error instanceof ApiRequestError
          && (error.status === 401 || error.status === 403);
        setPageState({
          status: "error",
          authenticationError,
          message: authenticationError
            ? "Your session could not be verified. Please sign in again."
            : "Saved conferences could not be loaded. Check your connection and try again.",
        });
      }
    };

    void Promise.resolve()
      .then(() => createClient())
      .then((supabase) => {
        if (!active) return null;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          receivedAuthEvent = true;
          void loadForSession(session?.access_token ?? null);
        });
        unsubscribe = () => subscription.unsubscribe();
        return supabase.auth.getSession();
      })
      .then((result) => {
        if (!active || !result || receivedAuthEvent) return;
        if (result.error) {
          setPageState({
            status: "error",
            authenticationError: false,
            message: "Your sign-in session could not be checked. Please try again.",
          });
          return;
        }
        void loadForSession(result.data.session?.access_token ?? null);
      })
      .catch(() => {
        if (active && !receivedAuthEvent) {
          setPageState({
            status: "error",
            authenticationError: false,
            message: "Your sign-in session could not be checked. Please try again.",
          });
        }
      });

    return () => {
      active = false;
      requestId += 1;
      unsubscribe();
    };
  }, [retry]);

  return (
    <main className="page-main">
      <div className="content-width">
        <header className="page-heading">
          <div>
            <div className="eyebrow">Your reading list</div>
            <h1>Saved conferences</h1>
            <p>Keep calls for papers you are considering together.</p>
          </div>
        </header>
        {pageState.status === "loading" ? (
          <ConferenceSkeleton />
        ) : pageState.status === "unauthenticated" ? (
          <section className="state-panel saved-empty-state">
            <h2>Sign in to save conferences.</h2>
            <p>Your saved conferences will appear here after you sign in.</p>
            <Link className="button-primary" href="/login">Sign in</Link>
          </section>
        ) : pageState.status === "error" ? (
          <section className="state-panel saved-empty-state" role="alert">
            <h2>{pageState.authenticationError ? "Sign-in required." : "Unable to load saved conferences."}</h2>
            <p>{pageState.message}</p>
            {pageState.authenticationError ? (
              <Link className="button-primary" href="/login">Sign in again</Link>
            ) : (
              <button className="button-primary" type="button" onClick={() => setRetry((value) => value + 1)}>
                Try again
              </button>
            )}
          </section>
        ) : pageState.conferences.length === 0 ? (
          <section className="state-panel saved-empty-state">
            <h2>No saved conferences yet.</h2>
            <p>Explore conferences and save the calls for papers you want to revisit.</p>
            <Link className="button-primary" href="/explore">Explore conferences</Link>
          </section>
        ) : (
          <div className="conference-grid">
            {pageState.conferences.map((conference) => (
              <ConferenceCard key={conference.id} conference={conference} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}