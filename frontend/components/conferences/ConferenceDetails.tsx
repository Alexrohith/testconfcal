"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { getConference } from "@/src/lib/api";
import {
  dateFromDateOnly,
  formatConferenceDateRange,
  getDeadlineUrgency,
  getPaperDeadlineInfo,
  paperDeadlineLabel,
} from "@/src/lib/calendar";
import SaveConferenceButton from "@/components/conferences/SaveConferenceButton";
import DeadlineReminderControl from "@/components/conferences/DeadlineReminderControl";
import ConferenceDetailsSkeleton from "@/components/conferences/ConferenceDetailsSkeleton";
import type { ConferenceDetail } from "@/src/types/api";

function displayDate(date: string | null): string {
  if (!date) return "Not listed";
  const parsed = dateFromDateOnly(date);
  return parsed ? format(parsed, "MMMM d, yyyy") : "Not listed";
}

function displayVenue(venue: string | null): string {
  return venue?.split(/[;,]/).map((part) => part.trim()).filter(Boolean).join(", ") ?? "";
}

export default function ConferenceDetails({ id }: { id: string }) {
  const [conference, setConference] = useState<ConferenceDetail | null>(null);
  const [retry, setRetry] = useState(0);
  const [loadedRequest, setLoadedRequest] = useState("");
  const [failedRequest, setFailedRequest] = useState("");
  const requestKey = `${id}#${retry}`;
  const loading = loadedRequest !== requestKey;
  const error = failedRequest === requestKey;
  const venue = displayVenue(conference?.venue ?? null);
  const deadlineInfo = conference ? getPaperDeadlineInfo(conference.paper_deadline) : null;

  useEffect(() => {
    const controller = new AbortController();
    getConference(id, controller.signal)
      .then((result) => {
        setConference(result);
        setFailedRequest("");
        setLoadedRequest(requestKey);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailedRequest(requestKey);
          setLoadedRequest(requestKey);
        }
      });
    return () => controller.abort();
  }, [id, retry, requestKey]);

  return (
    <main className="page-main"><div className="content-width">
      <p><Link className="text-link" href="/explore">← Back to explore</Link></p>
      {loading && !conference ? <ConferenceDetailsSkeleton /> : error && !conference ? (
        <div className="state-panel" role="alert"><h2>We couldn’t load conference details.</h2><p>Check your connection, then try again. The conference may also have been removed.</p><button className="button-primary" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></div>
      ) : !conference ? (
        <div className="state-panel"><h2>Conference not found.</h2><p>This listing may no longer be available.</p><Link className="button-secondary" href="/explore">Explore conferences</Link></div>
      ) : (
        <div className="detail-layout">
          <article>
            {error && (
              <div className="inline-error" role="alert">
                <strong>Conference details couldn’t be refreshed.</strong>
                <span>Your previously loaded information is still shown.</span>
                <button className="text-link" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button>
              </div>
            )}
            <div className="eyebrow">Conference details</div><h1 className="detail-title">{conference.title}</h1>
            <section
              className={`detail-deadline urgency-${getDeadlineUrgency(deadlineInfo?.daysUntilDeadline ?? null)}`}
              aria-label={`Paper submission deadline: ${deadlineInfo ? paperDeadlineLabel(deadlineInfo) : "Not available"}`}
            >
              <span>Paper submission deadline</span>
              <strong>{displayDate(conference.paper_deadline)}</strong>
              <span>{deadlineInfo ? paperDeadlineLabel(deadlineInfo) : "No paper deadline listed"}</span>
            </section>
            <DeadlineReminderControl
              conferenceId={conference.id}
              paperDeadline={conference.paper_deadline}
              onRefreshConference={() => setRetry((value) => value + 1)}
            />
            <div className="card-meta">{conference.categories.map((category) => <span className="category-chip" key={category.name}>{category.display_name}</span>)}</div>
            <div className="detail-actions"><SaveConferenceButton conferenceId={conference.id} title={conference.title} /></div>
            {conference.scope && <section className="detail-section"><h2>Scope</h2><p>{conference.scope}</p></section>}
            {conference.about && <section className="detail-section"><h2>About</h2><p>{conference.about}</p></section>}
            {(conference.event_contact || conference.ieee_region) && <section className="detail-section"><h2>Contact and region</h2><p>{[conference.event_contact, conference.ieee_region].filter(Boolean).join(" · ")}</p></section>}
          </article>
          <aside className="detail-aside" aria-label="Conference information">
            <h2>At a glance</h2>
            <div className="detail-fact"><span>Conference dates</span><strong>{formatConferenceDateRange(conference.start_date, conference.end_date)}</strong></div>
            <div className="detail-fact"><span>Paper deadline</span><strong>{displayDate(conference.paper_deadline)}</strong></div>
            {conference.city && <div className="detail-fact"><span>City</span><strong>{conference.city}</strong></div>}
            {conference.region && <div className="detail-fact"><span>Region</span><strong>{conference.region}</strong></div>}
            {conference.country && <div className="detail-fact"><span>Country</span><strong>{conference.country}</strong></div>}
            {venue && <div className="detail-fact"><span>Venue</span><strong>{venue}</strong></div>}
            {conference.format && <div className="detail-fact"><span>Format</span><strong>{conference.format}</strong></div>}
            {conference.is_virtual !== null && <div className="detail-fact"><span>Virtual status</span><strong>{conference.is_virtual ? "Virtual" : "In person"}</strong></div>}
            {conference.ieee_region && <div className="detail-fact"><span>IEEE region</span><strong>{conference.ieee_region}</strong></div>}
            {conference.event_contact && <div className="detail-fact"><span>Contact</span><strong>{conference.event_contact}</strong></div>}
            {conference.website && <p><a className="button-primary" href={conference.website} target="_blank" rel="noreferrer">Visit conference website ↗</a></p>}
            {conference.ieee_detail_url && <p><a className="text-link" href={conference.ieee_detail_url} target="_blank" rel="noreferrer">View IEEE listing ↗</a></p>}
          </aside>
        </div>
      )}
    </div></main>
  );
}