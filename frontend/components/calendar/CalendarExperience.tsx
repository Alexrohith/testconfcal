"use client";

import Link from "next/link";
import { addMonths, endOfMonth, format, isSameDay, isSameMonth, startOfDay, startOfMonth, subMonths } from "date-fns";
import { useEffect, useState, type FormEvent } from "react";
import CalendarSkeleton from "@/components/calendar/CalendarSkeleton";
import { ApiRequestError, getCalendarConferences, getCategories } from "@/src/lib/api";
import { createClient } from "@/src/lib/supabase/client";
import { getSavedConferences } from "@/src/lib/saved";
import {
  formatConferenceDateRange,
  dateFromDateOnly,
  getCalendarDays,
  getCalendarEvents,
  getDeadlineDaysRemaining,
  getDeadlineUrgency,
  getPaperDeadlineInfo,
  matchesPaperDeadlineFilter,
  paperDeadlineLabel,
  type CalendarEvent,
  type PaperDeadlineFilter,
} from "@/src/lib/calendar";
import type { Category, Conference, ConferenceQuery, SavedConference } from "@/src/types/api";

type CalendarView = "month" | "agenda";
type CalendarMode = "mine" | "all";
type MyCalendarState = "loading" | "unauthenticated" | "ready" | "error" | "auth-error";
interface CalendarFilters {
  search: string;
  country: string;
  category: string;
  deadline: PaperDeadlineFilter;
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

function filterSavedConferences(
  conferences: SavedConference[],
  filters: CalendarFilters,
  today: Date,
): SavedConference[] {
  const search = filters.search.toLocaleLowerCase();
  const country = filters.country.toLocaleLowerCase();

  return conferences.filter((conference) => {
    if (search && ![
      conference.title,
      conference.scope ?? "",
      conference.about ?? "",
    ].some((value) => value.toLocaleLowerCase().includes(search))) return false;

    if (country && !(conference.country ?? "").toLocaleLowerCase().includes(country)) return false;

    if (filters.category && !conference.categories?.some(
      (item) => item.name === filters.category,
    )) return false;

    if (!matchesPaperDeadlineFilter(
      getPaperDeadlineInfo(conference.paper_deadline, conference.days_until_deadline, today),
      filters.deadline,
    )) return false;

    return true;
  });
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
  const deadlineText = isDeadline
    ? paperDeadlineLabel(getPaperDeadlineInfo(
      event.conference.paper_deadline,
      event.conference.days_until_deadline,
      today,
    ))
    : null;

  return (
    <Link
      className={`calendar-event-link ${isDeadline ? `calendar-event-deadline urgency-${urgency}` : "calendar-event-conference"}`}
      href={`/conference/${event.conference.id}`}
      aria-label={`${eventLabel}: ${event.conference.title}, ${format(event.date, "MMMM d, yyyy")}${deadlineText ? `, ${deadlineText}` : ""}`}
    >
      <span className="calendar-event-type">{eventLabel}</span>
      <span className="calendar-event-title">{event.conference.title}</span>
      {!compact && (
        <span className="calendar-event-detail">
          {isDeadline
            ? deadlineText
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
  const [categoriesFailedRetry, setCategoriesFailedRetry] = useState(-1);
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [allConferences, setAllConferences] = useState<Conference[]>([]);
  const [savedConferences, setSavedConferences] = useState<SavedConference[]>([]);
  const [myCalendarState, setMyCalendarState] = useState<MyCalendarState>("loading");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loadedRequest, setLoadedRequest] = useState("");
  const [failedRequest, setFailedRequest] = useState("");
  const [retry, setRetry] = useState(0);
  const { search, country, category, deadline } = filters;
  const requestKey = `${mode}#${search}#${country}#${category}#${deadline}#${retry}`;
  const categoryError = categoriesFailedRetry === categoryRetry;

  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;
    let unsubscribe = () => {};

    void Promise.resolve()
      .then(() => createClient())
      .then((supabase) => {
        if (!active) return null;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          receivedAuthEvent = true;
          const token = session?.access_token ?? null;
          setAccessToken(token);
          setSavedConferences([]);
          setMyCalendarState(token ? "loading" : "unauthenticated");
          setSessionLoaded(true);
        });
        unsubscribe = () => subscription.unsubscribe();
        return supabase.auth.getSession();
      })
      .then((result) => {
        if (!active || !result || receivedAuthEvent) return;
        if (result.error) {
          setAccessToken(null);
          setSessionLoaded(true);
          setMyCalendarState("error");
          return;
        }
        const token = result.data.session?.access_token ?? null;
        setAccessToken(token);
        setMyCalendarState(token ? "loading" : "unauthenticated");
        setSessionLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setAccessToken(null);
        setSessionLoaded(true);
        setMyCalendarState("error");
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getCategories(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setCategories(response.categories);
        setCategoriesFailedRetry(-1);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCategoriesFailedRetry(categoryRetry);
        }
      });
    return () => controller.abort();
  }, [categoryRetry]);

  useEffect(() => {
    if (mode !== "all") return;
    const controller = new AbortController();
    const apiDeadline: ConferenceQuery["deadline"] = deadline === "today" || deadline === "30days"
      ? "upcoming"
      : deadline === "7days" || deadline === "passed" || deadline === "none"
        ? deadline
        : undefined;
    const query: Omit<ConferenceQuery, "page" | "limit"> = {
      search: search || undefined,
      country: country || undefined,
      category: category || undefined,
      deadline: apiDeadline,
    };

    getCalendarConferences(query, controller.signal)
      .then((conferenceResults) => {
        if (controller.signal.aborted) return;
        const filteredResults = conferenceResults.filter((conference) => matchesPaperDeadlineFilter(
          getPaperDeadlineInfo(conference.paper_deadline, conference.days_until_deadline, today),
          deadline,
        ));
        setAllConferences(filteredResults);
        setCountryOptions((current) => [...new Set([...current, ...getConferenceCountries(conferenceResults)])]
          .sort((left, right) => left.localeCompare(right)));
        setSelectedDate(null);
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
  }, [category, country, deadline, mode, requestKey, retry, search, today]);

  useEffect(() => {
      if (mode !== "mine" || !sessionLoaded) return;
      let active = true;
      if (!accessToken) return;

      queueMicrotask(() => {
        if (!active) return;
        setMyCalendarState("loading");
        getSavedConferences(accessToken)
          .then((results) => {
            if (!active) return;
            setSavedConferences(results);
            setMyCalendarState("ready");
            setSelectedDate(null);
          })
          .catch((caught: unknown) => {
            if (!active) return;
            setSavedConferences([]);
            setMyCalendarState(
              caught instanceof ApiRequestError && (caught.status === 401 || caught.status === 403)
                ? "auth-error"
                : "error",
            );
          });
      });

      return () => {
      active = false;
    };
  }, [accessToken, mode, retry, sessionLoaded]);

  const filteredSavedConferences = filterSavedConferences(savedConferences, filters, today);
  const conferences = mode === "all" ? allConferences : filteredSavedConferences;
  const loading = mode === "all"
    ? loadedRequest !== requestKey
    : !sessionLoaded || myCalendarState === "loading";
  const error = mode === "all"
    ? failedRequest === requestKey
    : myCalendarState === "error" || myCalendarState === "auth-error";

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
    .sort((left, right) => (
      (getDeadlineDaysRemaining(left, today) ?? Number.POSITIVE_INFINITY)
      - (getDeadlineDaysRemaining(right, today) ?? Number.POSITIVE_INFINITY)
    ))
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
            <select className="field-control" value={filters.deadline} onChange={(event) => applyDropdownFilter({ deadline: event.target.value as PaperDeadlineFilter })}>
              <option value="">All deadlines</option>
              <option value="today">Due today</option>
              <option value="7days">Due in 7 days</option>
              <option value="30days">Due in 30 days</option>
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
            <h2>{mode === "mine"
              ? myCalendarState === "auth-error"
                ? "Sign in to view your calendar."
                : "Unable to load your saved conferences."
              : "Unable to load conferences."}</h2>
            <p>{mode === "mine"
              ? myCalendarState === "auth-error"
                ? "Your session has expired or could not be verified."
                : "Your saved conferences could not be loaded. Check your connection and try again."
              : "Conference listings are temporarily unavailable. Check your connection and try again."}</p>
            {mode === "mine" && myCalendarState === "auth-error"
              ? <Link className="button-primary" href="/login">Sign in</Link>
              : <button className="button-primary" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>}
          </div>
        ) : mode === "mine" && myCalendarState === "unauthenticated" ? (
          <div className="state-panel calendar-personal-state">
            <h2>Sign in to view your calendar.</h2>
            <p>Your calendar will show conferences you have saved.</p>
            <Link className="button-primary" href="/login">Sign in</Link>
          </div>
        ) : mode === "mine" && savedConferences.length === 0 ? (
          <div className="state-panel calendar-personal-state">
            <h2>Your calendar is empty.</h2>
            <p>Save conferences from Explore to see them here.</p>
            <Link className="button-primary" href="/explore">Explore conferences</Link>
          </div>
        ) : conferences.length === 0 ? (
          <div className="state-panel">
            <h2>No conferences match your filters.</h2>
            <p>Clear one or more filters to broaden your calendar.</p>
            <button className="button-secondary" type="button" onClick={clearFilters}>Clear filters</button>
          </div>
        ) : (
          <>
            <div className="calendar-results-line" aria-live="polite">
              <span>{mode === "mine"
                ? `${conferences.length} saved ${conferences.length === 1 ? "conference" : "conferences"}`
                : `${conferences.length} conferences loaded from the API`}</span>
              {filters.category && <span>{categories.find((category) => category.name === filters.category)?.display_name}</span>}
            </div>
            <div
              className={`calendar-layout calendar-view-${view}`}
              key={`${format(visibleMonth, "yyyy-MM")}-${view}`}
            >
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
                  const day = dateFromDateOnly(dayKey) ?? new Date(`${dayKey}T12:00:00`);
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
                        const deadlineDate = conference.paper_deadline
                          ? dateFromDateOnly(conference.paper_deadline)
                          : null;
                        return (
                          <li key={conference.id}>
                            <span className={`upcoming-countdown urgency-${urgency}`}>
                              {paperDeadlineLabel(getPaperDeadlineInfo(
                                conference.paper_deadline,
                                conference.days_until_deadline,
                                today,
                              ))}
                            </span>
                            <Link href={`/conference/${conference.id}`}>{conference.title}</Link>
                            <time dateTime={conference.paper_deadline ?? undefined}>
                              {deadlineDate ? format(deadlineDate, "MMM d, yyyy") : ""}
                            </time>
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