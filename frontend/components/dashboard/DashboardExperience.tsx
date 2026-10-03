"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import ConferenceCard from "@/components/conferences/ConferenceCard";
import ConferenceSkeleton from "@/components/conferences/ConferenceSkeleton";
import {
  ApiRequestError,
  getCalendarConferences,
  getRecommendedConferences,
} from "@/src/lib/api";
import { getDeadlineDaysRemaining } from "@/src/lib/calendar";
import type { Category, Conference, RecommendedConferenceResponse } from "@/src/types/api";

type RecommendationState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "loaded"; response: RecommendedConferenceResponse }
  | { status: "error"; authenticationError: boolean };

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
  const [recommendations, setRecommendations] = useState<RecommendationState>({ status: "loading" });
  const [recommendationRetry, setRecommendationRetry] = useState(0);

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

  useEffect(() => {
    const controller = new AbortController();
    getRecommendedConferences(1, 6, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setRecommendations(response
          ? { status: "loaded", response }
          : { status: "signed-out" });
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setRecommendations({
          status: "error",
          authenticationError: caught instanceof ApiRequestError
            && (caught.status === 401 || caught.status === 403),
        });
      });
    return () => controller.abort();
  }, [recommendationRetry]);

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

        <section className="dashboard-section dashboard-recommendations" aria-labelledby="recommendations-heading">
          <header className="dashboard-section-heading">
            <div>
              <span className="eyebrow">Personalized discovery</span>
              <h2 id="recommendations-heading">Recommended for You</h2>
              <p className="dashboard-section-description">Based on your research interests</p>
            </div>
            {recommendations.status === "loaded" && recommendations.response.results.length > 0 && (
              <span className="recommendation-count">
                {recommendations.response.total} {recommendations.response.total === 1 ? "match" : "matches"}
              </span>
            )}
          </header>
          {recommendations.status === "loading" ? (
            <ConferenceSkeleton className="recommendation-skeleton-grid" />
          ) : recommendations.status === "signed-out" ? (
            <div className="state-panel recommendation-state">
              <h3>Sign in to see recommendations.</h3>
              <p>Your recommendations are based on your selected research interests.</p>
              <Link className="button-primary" href="/login">Sign in</Link>
            </div>
          ) : recommendations.status === "error" ? (
            <div className="state-panel recommendation-state" role="alert">
              <h3>{recommendations.authenticationError ? "Your session needs attention." : "Unable to load recommendations."}</h3>
              <p>
                {recommendations.authenticationError
                  ? "Sign in again to view conferences matched to your research interests."
                  : "Recommendations could not be loaded. Your other dashboard sections are still available."}
              </p>
              {recommendations.authenticationError ? (
                <Link className="button-primary" href="/login">Sign in again</Link>
              ) : (
                <button
                  className="button-primary"
                  type="button"
                  onClick={() => setRecommendationRetry((value) => value + 1)}
                >
                  Try again
                </button>
              )}
            </div>
          ) : !recommendations.response.personalization_configured ? (
            <div className="state-panel recommendation-state">
              <h3>Choose your research interests to get personalized conference recommendations.</h3>
              <Link className="button-primary" href="/onboarding">Choose interests</Link>
            </div>
          ) : recommendations.response.results.length === 0 ? (
            <div className="state-panel recommendation-state">
              <h3>No current conferences match your selected interests.</h3>
              <p>Explore all conferences or adjust your research interests to broaden your matches.</p>
              <div className="recommendation-state-actions">
                <Link className="button-primary" href="/explore">Explore conferences</Link>
                <Link className="text-link" href="/onboarding">Edit interests</Link>
              </div>
            </div>
          ) : (
            <div className="conference-grid">
              {recommendations.response.results.map((conference) => (
                <ConferenceCard
                  key={conference.id}
                  conference={conference}
                  recommendation={{
                    matchPercentage: conference.match_percentage,
                    matchedCategories: conference.matched_categories,
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {error && conferences.length === 0 ? (
          <div className="state-panel" role="alert">
            <h2>We couldn’t load conference listings.</h2>
            <p>Check your connection and try again. Your recommendations remain available above.</p>
            <button className="button-primary" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>
          </div>
        ) : !loaded ? (
          <section className="dashboard-loading" aria-label="Dashboard summaries loading" aria-busy="true">
            <div className="dashboard-summary-skeletons">
              {Array.from({ length: 3 }, (_, index) => (
                <div className="dashboard-summary-skeleton" key={index}>
                  <div className="skeleton-line short" />
                  <div className="skeleton-line medium" />
                </div>
              ))}
            </div>
            <div className="dashboard-columns">
              {Array.from({ length: 2 }, (_, index) => (
                <div className="dashboard-list-skeleton" key={index}>
                  <div className="skeleton-line medium" />
                  {Array.from({ length: 3 }, (_, row) => (
                    <div className="dashboard-list-row-skeleton" key={row}>
                      <span />
                      <div><span /><span /></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <>
            {error && (
              <div className="inline-error" role="alert">
                <strong>Conference listings couldn’t be refreshed.</strong>
                <span>Your previously loaded dashboard information is still shown.</span>
                <button className="text-link" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button>
              </div>
            )}
            <section className="dashboard-context" aria-label="Personalization status">
              <div>
                <span className="field-label">Your research interests</span>
                {researchInterestError ? (
                  <p>Unable to load your research interests.</p>
                ) : researchInterests?.length === 0 ? (
                  <p>No research interests selected yet.</p>
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
          {loaded && conferences.length > 0 && <div className="conference-grid">{conferences.slice(0, 4).map((conference) => <ConferenceCard key={conference.id} conference={conference} />)}</div>}
        </section>
      </div>
    </main>
  );
}