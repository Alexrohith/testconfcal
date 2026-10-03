"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import ConferenceCard from "@/components/conferences/ConferenceCard";
import { getCalendarConferences } from "@/src/lib/api";
import { getDeadlineDaysRemaining } from "@/src/lib/calendar";
import type { Category, Conference } from "@/src/types/api";

interface DashboardExperienceProps {
  userName: string;
  researchInterests: Category[] | null;
  researchInterestError: boolean;
}

export default function DashboardExperience({ userName, researchInterests, researchInterestError }: DashboardExperienceProps) {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getCalendarConferences({}, controller.signal)
      .then((results) => {
        setConferences(results);
        setError(false);
        setLoaded(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          setLoaded(true);
        }
      });
    return () => controller.abort();
  }, [retry]);

  const today = new Date();
  const upcomingDeadlines = conferences
    .filter((conference) => {
      const remaining = getDeadlineDaysRemaining(conference, today);
      return remaining !== null && remaining >= 0;
    })
    .sort((left, right) => (left.days_until_deadline ?? 0) - (right.days_until_deadline ?? 0))
    .slice(0, 4);
  const upcomingConferences = conferences
    .filter((conference) => conference.start_date >= format(today, "yyyy-MM-dd"))
    .sort((left, right) => left.start_date.localeCompare(right.start_date))
    .slice(0, 4);

  return (
    <main className="page-main dashboard-page">
      <div className="content-width">
        <header className="page-heading">
          <div>
            <div className="eyebrow">Research planning</div>
            <h1>Dashboard</h1>
            <p>Signed in as {userName}. Your overview of conference deadlines and upcoming events.</p>
          </div>
          <Link className="button-primary" href="/calendar">Open calendar</Link>
        </header>

        {error ? (
          <div className="state-panel" role="alert">
            <h2>Unable to load conferences.</h2>
            <p>Check that the ConfCal API is running, then try again.</p>
            <button className="button-primary" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>
          </div>
        ) : !loaded ? (
          <div className="conference-grid" aria-busy="true"><div className="skeleton-card"><div className="skeleton-line medium" /><div className="skeleton-line large" /></div><div className="skeleton-card"><div className="skeleton-line medium" /><div className="skeleton-line large" /></div></div>
        ) : (
          <>
            <section className="dashboard-context" aria-label="Personalization status">
              <div>
                <span className="field-label">Your research interests</span>
                {researchInterestError ? (
                  <p>Unable to load your research interests.</p>
                ) : (
                  <div className="dashboard-interest-tags">
                    {researchInterests?.map((category) => <span className="dashboard-interest-tag" key={category.id}>{category.display_name}</span>)}
                  </div>
                )}
              </div>
              <div><span className="field-label">Saved conferences</span><p>Saved conference support is not available yet.</p></div>
              <Link className="text-link" href="/onboarding">Edit interests</Link>
            </section>

            <div className="dashboard-columns">
              <section className="dashboard-section">
                <header className="dashboard-section-heading"><div><span className="eyebrow">Paper submissions</span><h2>Upcoming deadlines</h2></div><Link className="text-link" href="/explore?deadline=upcoming">Explore deadlines</Link></header>
                {upcomingDeadlines.length === 0 ? <p className="calendar-side-empty">No upcoming paper deadlines in the loaded listings.</p> : (
                  <div className="dashboard-list">
                    {upcomingDeadlines.map((conference) => {
                      const deadline = conference.paper_deadline ? parseISO(conference.paper_deadline) : null;
                      return (
                        <article className="dashboard-list-item" key={conference.id}>
                          <time dateTime={conference.paper_deadline ?? undefined}>{deadline ? format(deadline, "MMM d") : ""}</time>
                          <div><Link href={`/conference/${conference.id}`}>{conference.title}</Link><span>{conference.days_until_deadline === 0 ? "Due today" : `${conference.days_until_deadline} days remaining`}</span></div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="dashboard-section">
                <header className="dashboard-section-heading"><div><span className="eyebrow">Conference dates</span><h2>Coming up</h2></div><Link className="text-link" href="/calendar">Calendar</Link></header>
                {upcomingConferences.length === 0 ? <p className="calendar-side-empty">No upcoming conference dates in the loaded listings.</p> : (
                  <div className="dashboard-list">
                    {upcomingConferences.map((conference) => (
                      <article className="dashboard-list-item" key={conference.id}>
                        <time dateTime={conference.start_date}>{format(parseISO(conference.start_date), "MMM d")}</time>
                        <div><Link href={`/conference/${conference.id}`}>{conference.title}</Link><span>{[conference.city, conference.country].filter(Boolean).join(", ") || "Location not listed"}</span></div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        <section className="dashboard-section dashboard-discovery">
          <header className="dashboard-section-heading"><div><span className="eyebrow">Real IEEE listings</span><h2>Explore conferences</h2></div><Link className="text-link" href="/explore">All conferences</Link></header>
          {loaded && !error && <div className="conference-grid">{conferences.slice(0, 4).map((conference) => <ConferenceCard key={conference.id} conference={conference} />)}</div>}
        </section>
      </div>
    </main>
  );
}