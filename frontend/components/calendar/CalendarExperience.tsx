"use client";

import Link from "next/link";
import { addMonths, endOfMonth, format, isSameDay, isSameMonth, startOfDay, startOfMonth, subMonths } from "date-fns";
import { useEffect, useState, type FormEvent } from "react";
import CalendarSkeleton from "@/components/calendar/CalendarSkeleton";
import { getCalendarConferences, getCategories, getPersonalizedCalendarConferences } from "@/src/lib/api";
import { createClient } from "@/src/lib/supabase/client";
import { getCurrentUserInterestProfile, UnauthenticatedUserError } from "@/src/lib/supabase/interests";
import {
  formatConferenceDateRange,
  getCalendarDays,
  getCalendarEvents,
  getDeadlineDaysRemaining,
  getDeadlineUrgency,
  type CalendarEvent,
} from "@/src/lib/calendar";
import type { Category, Conference, ConferenceQuery } from "@/src/types/api";

type CalendarView = "month" | "agenda";
type CalendarMode = "mine" | "all";
type PersonalizationState = "idle" | "ready" | "unauthenticated" | "no-interests" | "unsupported" | "categories-error" | "error";
type DeadlineFilter = NonNullable<ConferenceQuery["deadline"]> | "";

interface CalendarFilters {
  search: string;
  country: string;
  category: string;
  deadline: DeadlineFilter;
}

const initialFilters: CalendarFilters = {
  search: "",
  country: "",
  category: "",
  deadline: "",
};

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getConferenceCountries(conferences: Conference[]): string[] {
  return [...new Set(conferences.map((conference) => conference.country).filter((country): country is string => Boolean(country?.trim())))]
    .sort((left, right) => left.localeCompare(right));
}

function deadlineDescription(daysRemaining: number | null): string {
  if (daysRemaining === null) return "Deadline not listed";
  if (daysRemaining < 0) return "Deadline passed";
  if (daysRemaining === 0) return "Due today";
  return `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} left`;
}

function CalendarEventLink({ event, compact, today }: {
  event: CalendarEvent;
  compact: boolean;
  today: Date;
}) {
  const isDeadline = event.kind === "deadline";
  const daysRemaining = isDeadline ? getDeadlineDaysRemaining(event.conference, today) : null;
  const urgency = getDeadlineUrgency(daysRemaining);
  const eventLabel = isDeadline ? "Paper deadline" : "Conference";

  return (
    <Link
      className={`calendar-event-link ${isDeadline ? `calendar-event-deadline urgency-${urgency}` : "calendar-event-conference"}`}
      href={`/conference/${event.conference.id}`}
      aria-label={`${eventLabel}: ${event.conference.title}, ${format(event.date, "MMMM d, yyyy")}`}
    >
      <span className="calendar-event-type">{eventLabel}</span>
      <span className="calendar-event-title">{event.conference.title}</span>
      {!compact && (
        <span className="calendar-event-detail">
          {isDeadline
            ? deadlineDescription(daysRemaining)
            : formatConferenceDateRange(event.conference.start_date, event.conference.end_date)}
        </span>
      )}
    </Link>
  );
}

function agendaHeading(date: Date, today: Date): string {
  const daysAway = Math.round((startOfDay(date).getTime() - today.getTime()) / 86_400_000);
  if (daysAway === 0) return "Today";
  if (daysAway > 0 && daysAway <= 7) return `In ${daysAway} ${daysAway === 1 ? "day" : "days"}`;
  return format(date, "EEEE, MMMM d");
}

export default function CalendarExperience() {
  const [today] = useState(() => startOfDay(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState<CalendarView>("month");
  const [mode, setMode] = useState<CalendarMode>("all");
  const [filters, setFilters] = useState<CalendarFilters>(initialFilters);
  const [searchDraft, setSearchDraft] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoadedRetry, setCategoriesLoadedRetry] = useState(-1);
  const [categoriesFailedRetry, setCategoriesFailedRetry] = useState(-1);
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [interestCategories, setInterestCategories] = useState<Category[]>([]);
  const [personalizationState, setPersonalizationState] = useState<PersonalizationState>("idle");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loadedRequest, setLoadedRequest] = useState("");
  const [failedRequest, setFailedRequest] = useState("");
  const [retry, setRetry] = useState(0);
  const { search, country, category, deadline } = filters;
  const requestKey = `${mode}#${search}#${country}#${category}#${deadline}#${retry}`;
  const loading = loadedRequest !== requestKey;
  const error = failedRequest === requestKey;
  const categoriesLoading = categoriesLoadedRetry !== categoryRetry;
  const categoryError = categoriesFailedRetry === categoryRetry;

  useEffect(() => {
    const controller = new AbortController();
    getCategories(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setCategories(response.categories);
        setCategoriesFailedRetry(-1);
        setCategoriesLoadedRetry(categoryRetry);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCategoriesFailedRetry(categoryRetry);
          setCategoriesLoadedRetry(categoryRetry);
        }
      });
    return () => controller.abort();
  }, [categoryRetry]);

  useEffect(() => {
    if (mode !== "all") return;
    const controller = new AbortController();
    const query = {
      search: search || undefined,
      country: country || undefined,
      category: category || undefined,
      deadline: deadline || undefined,
    };

    getCalendarConferences(query, controller.signal)
      .then((conferenceResults) => {
        if (controller.signal.aborted) return;
        setConferences(conferenceResults);
        setCountryOptions((current) => [...new Set([...current, ...getConferenceCountries(conferenceResults)])]
          .sort((left, right) => left.localeCompare(right)));
        setSelectedDate(null);
        setPersonalizationState("idle");
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
  }, [category, country, deadline, mode, requestKey, retry, search]);

  useEffect(() => {
    if (mode !== "mine" || categoriesLoading) return;
    const controller = new AbortController();

    async function loadPersonalizedConferences() {
      if (categoryError) {
        setConferences([]);
        setPersonalizationState("categories-error");
        setFailedRequest("");
        setLoadedRequest(requestKey);
        return;
      }

      try {
        const profile = await getCurrentUserInterestProfile(createClient());
        if (controller.signal.aborted) return;

        const selectedInterests = categories.filter((item) => profile.categoryIds.includes(item.id));
        setInterestCategories(selectedInterests);

        if (selectedInterests.length === 0) {
          setConferences([]);
          setPersonalizationState("no-interests");
          setFailedRequest("");
          setLoadedRequest(requestKey);
          return;
        }

        const requestedInterests = category
          ? selectedInterests.filter((item) => item.name === category)
          : selectedInterests;

        if (requestedInterests.length === 0) {
          setConferences([]);
          setPersonalizationState("ready");
          setFailedRequest("");
          setLoadedRequest(requestKey);
          return;
        }

        if (requestedInterests.length > 1) {
          setConferences([]);
          setPersonalizationState("unsupported");
          setFailedRequest("");
          setLoadedRequest(requestKey);
          return;
        }

        const conferenceResults = await getPersonalizedCalendarConferences(
          requestedInterests.map((item) => item.name),
          {
            search: search || undefined,
            country: country || undefined,
            deadline: deadline || undefined,
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;

        setConferences(conferenceResults);
        setCountryOptions((current) => [...new Set([...current, ...getConferenceCountries(conferenceResults)])]
          .sort((left, right) => left.localeCompare(right)));
        setSelectedDate(null);
        setPersonalizationState("ready");
        setFailedRequest("");
        setLoadedRequest(requestKey);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setConferences([]);
        setPersonalizationState(caught instanceof UnauthenticatedUserError ? "unauthenticated" : "error");
        setFailedRequest(caught instanceof UnauthenticatedUserError ? "" : requestKey);
        setLoadedRequest(requestKey);
      }
    }

    void loadPersonalizedConferences();
    return () => controller.abort();
  }, [categories, categoriesLoading, category, categoryError, country, deadline, mode, requestKey, search]);

  const events = getCalendarEvents(conferences);
  const monthDays = getCalendarDays(visibleMonth);
  const selectedEvents = selectedDate
    ? events.filter((event) => isSameDay(event.date, selectedDate))
    : [];
  const upcomingDeadlines = conferences
    .filter((conference) => {
      const remaining = getDeadlineDaysRemaining(conference, today);
      return remaining !== null && remaining >= 0;
    })
    .sort((left, right) => (left.days_until_deadline ?? 0) - (right.days_until_deadline ?? 0))
    .slice(0, 6);

  const agendaStart = startOfMonth(visibleMonth);
  const agendaEnd = endOfMonth(visibleMonth);
  const agendaEvents = events.filter((event) => {
    const firstConferenceDay = event.kind === "deadline"
      || format(event.date, "yyyy-MM-dd") === event.conference.start_date;
    return firstConferenceDay && event.date >= agendaStart && event.date <= agendaEnd;
  });
  const agendaGroups = new Map<string, CalendarEvent[]>();
  for (const event of agendaEvents) {
    const dayKey = format(event.date, "yyyy-MM-dd");
    agendaGroups.set(dayKey, [...(agendaGroups.get(dayKey) ?? []), event]);
  }

  function applyTextFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters((current) => ({
      ...current,
      search: searchDraft.trim(),
    }));
  }

  function applyDropdownFilter(update: Partial<CalendarFilters>) {
    setFilters((current) => ({
      ...current,
      ...update,
      search: searchDraft.trim(),
    }));
  }

  function clearFilters() {
    setFilters(initialFilters);
    setSearchDraft("");
  }

  function selectDay(date: Date) {
    setSelectedDate(date);
    if (!isSameMonth(date, visibleMonth)) setVisibleMonth(startOfMonth(date));
  }

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <main className="page-main calendar-page">
      <div className="content-width">
        <header className="page-heading calendar-heading">
          <div>
            <div className="eyebrow">Global conference listings</div>
            <h1>Calendar</h1>
            <p>Track conferences, paper deadlines, and research opportunities.</p>
          </div>
          <button className="button-secondary calendar-today" type="button" onClick={() => {
            setVisibleMonth(startOfMonth(today));
            setSelectedDate(today);
          }}>Today</button>
        </header>

        <div className="calendar-mode-switch" role="group" aria-label="Conference calendar source">
          <button type="button" aria-pressed={mode === "mine"} onClick={() => {
            setMode("mine");
            setSelectedDate(null);
          }}>My Calendar</button>
          <button type="button" aria-pressed={mode === "all"} onClick={() => {
            setMode("all");
            setSelectedDate(null);
          }}>All Conferences</button>
        </div>

        <div className="calendar-toolbar">
          <div className="calendar-month-controls" aria-label="Calendar month">
            <button type="button" aria-label="Previous month" onClick={() => {
              setVisibleMonth((month) => subMonths(month, 1));
              setSelectedDate(null);
            }}>&lt;</button>
            <h2>{format(visibleMonth, "MMMM yyyy")}</h2>
            <button type="button" aria-label="Next month" onClick={() => {
              setVisibleMonth((month) => addMonths(month, 1));
              setSelectedDate(null);
            }}>&gt;</button>
          </div>
          <div className="calendar-view-switch" role="group" aria-label="Calendar view">
            <button type="button" aria-pressed={view === "month"} onClick={() => setView("month")}>Month</button>
            <button type="button" aria-pressed={view === "agenda"} onClick={() => setView("agenda")}>Agenda</button>
          </div>
        </div>

        <form className="calendar-filters" onSubmit={applyTextFilters}>
          <label>
            <span className="field-label">Search</span>
            <input className="field-control" type="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Conference or topic" />
          </label>
          <label>
            <span className="field-label">Research area</span>
            <select className="field-control" value={filters.category} onChange={(event) => applyDropdownFilter({ category: event.target.value })}>
              <option value="">All research areas</option>
              {categories.map((category) => <option key={category.id} value={category.name}>{category.display_name}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">Country</span>
            <select className="field-control" value={filters.country} onChange={(event) => applyDropdownFilter({ country: event.target.value })}>
              <option value="">Any country</option>
              {countryOptions.map((countryOption) => <option key={countryOption} value={countryOption}>{countryOption}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">Paper deadline</span>
            <select className="field-control" value={filters.deadline} onChange={(event) => applyDropdownFilter({ deadline: event.target.value as DeadlineFilter })}>
              <option value="">All deadlines</option>
              <option value="upcoming">Upcoming</option>
              <option value="7days">Next 7 days</option>
              <option value="passed">Passed</option>
              <option value="none">No deadline</option>
            </select>
          </label>
          <div className="calendar-filter-actions">
            <button className="button-primary" type="submit">Apply</button>
            {hasFilters && <button className="text-link" type="button" onClick={clearFilters}>Clear filters</button>}
          </div>
        </form>

        {categoryError && <p role="status" className="results-line">Research categories could not be loaded. <button className="text-link" type="button" onClick={() => setCategoryRetry((value) => value + 1)}>Try again</button></p>}

        {loading ? <CalendarSkeleton /> : error ? (
          <div className="state-panel calendar-error" role="alert">
            <h2>{mode === "mine" ? "Unable to load your personalized conferences." : "Unable to load conferences."}</h2>
            <p>Check that the ConfCal API is running and try again.</p>
            <button className="button-primary" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>
          </div>
        ) : mode === "mine" && personalizationState === "unauthenticated" ? (
          <div className="state-panel calendar-personal-state">
            <h2>Sign in to use My Calendar.</h2>
            <p>Your calendar will be based on your saved research interests.</p>
            <Link className="button-primary" href="/login">Sign in</Link>
          </div>
        ) : mode === "mine" && personalizationState === "no-interests" ? (
          <div className="state-panel calendar-personal-state">
            <h2>Choose research interests to personalize your calendar.</h2>
            <p>Select research areas to see relevant conferences and deadlines.</p>
            <Link className="button-primary" href="/onboarding">Choose interests</Link>
          </div>
        ) : mode === "mine" && personalizationState === "unsupported" ? (
          <div className="state-panel calendar-personal-state">
            <h2>My Calendar needs multi-category API support.</h2>
            <p>The conference API accepts one research area per request. Choose a research area filter to view that interest, or switch to All Conferences.</p>
          </div>
        ) : mode === "mine" && personalizationState === "categories-error" ? (
          <div className="state-panel calendar-error" role="alert">
            <h2>Unable to load research areas.</h2>
            <p>Your personalized calendar needs category data to match your saved interests.</p>
            <button className="button-primary" type="button" onClick={() => setCategoryRetry((value) => value + 1)}>Retry</button>
          </div>
        ) : conferences.length === 0 ? (
          <div className="state-panel">
            <h2>{mode === "mine" ? "No conferences match your research interests yet." : "No conferences match your filters."}</h2>
            <p>{mode === "mine" ? "Edit your interests or filters to broaden your personalized calendar." : "Clear one or more filters to broaden your search."}</p>
            {mode === "mine" ? <Link className="button-secondary" href="/onboarding">Edit interests</Link> : <button className="button-secondary" type="button" onClick={clearFilters}>Clear filters</button>}
          </div>
        ) : (
          <>
            {mode === "mine" && interestCategories.length > 0 && (
              <section className="calendar-personal-context" aria-label="Personalized calendar interests">
                <div>
                  <span>Based on your research interests</span>
                  <div className="dashboard-interest-tags">
                    {interestCategories.map((interest) => <span className="dashboard-interest-tag" key={interest.id}>{interest.display_name}</span>)}
                  </div>
                </div>
                <Link className="text-link" href="/onboarding">Edit interests</Link>
              </section>
            )}
            <div className="calendar-results-line" aria-live="polite">
              <span>{conferences.length} conferences loaded from the API</span>
              {filters.category && <span>{categories.find((category) => category.name === filters.category)?.display_name}</span>}
            </div>
            <div className={`calendar-layout calendar-view-${view}`}>
              <section className="calendar-main-view" aria-label={`${format(visibleMonth, "MMMM yyyy")} calendar`}>
                <div className="calendar-weekdays" aria-hidden="true">
                  {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
                </div>
                <div className="calendar-month-grid">
                  {monthDays.map((day) => {
                    const dayEvents = events.filter((event) => isSameDay(event.date, day));
                    const selected = selectedDate ? isSameDay(day, selectedDate) : false;
                    return (
                      <div
                        className={`calendar-day-cell${isSameMonth(day, visibleMonth) ? "" : " is-outside-month"}${selected ? " is-selected" : ""}${isSameDay(day, today) ? " is-today" : ""}`}
                        key={format(day, "yyyy-MM-dd")}
                      >
                        <button className="calendar-day-number" type="button" aria-label={format(day, "EEEE, MMMM d, yyyy")} aria-pressed={selected} onClick={() => selectDay(day)}>
                          {format(day, "d")}
                        </button>
                        <div className="calendar-day-events">
                          {dayEvents.slice(0, 2).map((event) => <CalendarEventLink key={event.id} event={event} compact today={today} />)}
                          {dayEvents.length > 2 && <button className="calendar-more-events" type="button" onClick={() => selectDay(day)}>+ {dayEvents.length - 2} more</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="calendar-agenda-view" aria-label="Upcoming calendar agenda">
                {agendaGroups.size === 0 ? (
                  <div className="calendar-empty-day">No conference deadlines or events.</div>
                ) : [...agendaGroups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([dayKey, dayEvents]) => {
                  const day = new Date(`${dayKey}T00:00:00`);
                  return (
                    <section className="agenda-day-group" key={dayKey}>
                      <header className="agenda-day-heading">
                        <span>{agendaHeading(day, today)}</span>
                        <time dateTime={dayKey}>{format(day, "MMM d")}</time>
                      </header>
                      {dayEvents.map((event) => <CalendarEventLink key={event.id} event={event} compact={false} today={today} />)}
                    </section>
                  );
                })}
              </section>

              <aside className="calendar-sidebar">
                <section className="calendar-side-section">
                  <div className="calendar-side-heading">
                    <h2>Upcoming deadlines</h2>
                    <Link href="/explore?deadline=upcoming">View all</Link>
                  </div>
                  {upcomingDeadlines.length === 0 ? (
                    <p className="calendar-side-empty">No upcoming paper deadlines in the loaded listings.</p>
                  ) : (
                    <ul className="upcoming-deadline-list">
                      {upcomingDeadlines.map((conference) => {
                        const remaining = getDeadlineDaysRemaining(conference, today);
                        const urgency = getDeadlineUrgency(remaining);
                        return (
                          <li key={conference.id}>
                            <span className={`upcoming-countdown urgency-${urgency}`}>{deadlineDescription(remaining)}</span>
                            <Link href={`/conference/${conference.id}`}>{conference.title}</Link>
                            <time dateTime={conference.paper_deadline ?? undefined}>{conference.paper_deadline ? format(new Date(`${conference.paper_deadline}T00:00:00`), "MMM d, yyyy") : ""}</time>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                {selectedDate && (
                  <section className="calendar-side-section selected-day-panel" aria-live="polite">
                    <div className="calendar-side-heading">
                      <h2>{format(selectedDate, "MMMM d")}</h2>
                      <button type="button" aria-label="Close selected day" onClick={() => setSelectedDate(null)}>Close</button>
                    </div>
                    {selectedEvents.length === 0 ? (
                      <p className="calendar-side-empty">No conference deadlines or events.</p>
                    ) : selectedEvents.map((event) => <CalendarEventLink key={event.id} event={event} compact={false} today={today} />)}
                  </section>
                )}
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}