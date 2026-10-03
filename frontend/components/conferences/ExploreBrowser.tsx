"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCategories, getConference, getConferenceCountries, getConferences } from "@/src/lib/api";
import type { Category, Conference, ConferenceDetail, ConferenceQuery, ConferenceResponse } from "@/src/types/api";
import ConferenceCard from "@/components/conferences/ConferenceCard";
import ConferenceSkeleton from "@/components/conferences/ConferenceSkeleton";
import { format } from "date-fns";
import {
  dateFromDateOnly,
  formatConferenceDateRange,
  getPaperDeadlineInfo,
  paperDeadlineLabel,
} from "@/src/lib/calendar";

const PAGE_SIZE = 20;
const MAX_COMPARISON_CONFERENCES = 3;

type ComparisonDetailState =
  | { status: "loading" }
  | { status: "loaded"; conference: ConferenceDetail }
  | { status: "error" };

function parseComparisonIds(value: string | null): number[] {
  if (!value) return [];
  const ids: number[] = [];
  const seen = new Set<number>();

  for (const item of value.split(",")) {
    const normalized = item.trim();
    if (!/^\d+$/.test(normalized)) continue;
    const id = Number(normalized);
    if (!Number.isSafeInteger(id) || id < 1 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length === MAX_COMPARISON_CONFERENCES) break;
  }
  return ids;
}

function writeComparisonIds(params: URLSearchParams, ids: number[]): void {
  if (ids.length > 0) params.set("compare", ids.join(","));
  else params.delete("compare");
}

function displayDetailDate(value: string | null): string {
  if (!value) return "Not listed";
  const parsed = dateFromDateOnly(value);
  return parsed ? format(parsed, "MMMM d, yyyy") : "Not listed";
}

function comparisonLocation(conference: ConferenceDetail): string {
  return [conference.city, conference.region, conference.country]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(", ") || "Not listed";
}

function ComparisonField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="comparison-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ComparisonConferenceFields({ conference }: { conference: ConferenceDetail }) {
  const deadlineInfo = getPaperDeadlineInfo(conference.paper_deadline);
  const website = conference.website?.trim();

  return (
    <dl className="comparison-fields">
      <ComparisonField label="Conference">{conference.title}</ComparisonField>
      <ComparisonField label="Dates">
        {formatConferenceDateRange(conference.start_date, conference.end_date)}
      </ComparisonField>
      <ComparisonField label="Paper deadline">{displayDetailDate(conference.paper_deadline)}</ComparisonField>
      <ComparisonField label="Deadline status">{paperDeadlineLabel(deadlineInfo)}</ComparisonField>
      <ComparisonField label="Location">{comparisonLocation(conference)}</ComparisonField>
      <ComparisonField label="Format">{conference.format?.trim() || "Not listed"}</ComparisonField>
      <ComparisonField label="Virtual / in-person">
        {conference.is_virtual === null ? "Not listed" : conference.is_virtual ? "Virtual" : "In-person"}
      </ComparisonField>
      <ComparisonField label="Venue">{conference.venue?.trim() || "Not listed"}</ComparisonField>
      <ComparisonField label="Categories">
        {conference.categories.length > 0 ? (
          <span className="comparison-category-list">
            {conference.categories.map((category) => (
              <span className="category-chip" key={category.name}>{category.display_name}</span>
            ))}
          </span>
        ) : "Not listed"}
      </ComparisonField>
      <ComparisonField label="Official website">
        {website ? <a href={website} target="_blank" rel="noreferrer">Visit website</a> : "Not listed"}
      </ComparisonField>
    </dl>
  );
}

function ComparisonDialog({
  conferenceIds,
  onClose,
  onRemove,
}: {
  conferenceIds: number[];
  onClose: () => void;
  onRemove: (id: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const detailsCache = useRef(new Map<number, ConferenceDetail>());
  const requestControllers = useRef(new Map<number, AbortController>());
  const [detailStates, setDetailStates] = useState<Record<number, ComparisonDetailState>>({});
  const idKey = conferenceIds.join(",");

  const loadDetail = useCallback((id: number) => {
    if (detailsCache.current.has(id) || requestControllers.current.has(id)) return;

    const controller = new AbortController();
    requestControllers.current.set(id, controller);
    setDetailStates((current) => ({ ...current, [id]: { status: "loading" } }));
    void getConference(String(id), controller.signal)
      .then((conference) => {
        if (controller.signal.aborted) return;
        detailsCache.current.set(id, conference);
        setDetailStates((current) => ({
          ...current,
          [id]: { status: "loaded", conference },
        }));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDetailStates((current) => ({ ...current, [id]: { status: "error" } }));
        }
      })
      .finally(() => {
        if (requestControllers.current.get(id) === controller) {
          requestControllers.current.delete(id);
        }
      });
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    closeButtonRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const requestedIds = parseComparisonIds(idKey);
    const selectedIds = new Set(requestedIds);
    for (const [id, controller] of requestControllers.current) {
      if (!selectedIds.has(id)) {
        controller.abort();
        requestControllers.current.delete(id);
      }
    }
    setDetailStates((current) => {
      const next = { ...current };
      for (const id of requestedIds) {
        const cached = detailsCache.current.get(id);
        if (cached) next[id] = { status: "loaded", conference: cached };
      }
      return next;
    });
    requestedIds.forEach(loadDetail);
  }, [idKey, loadDetail]);

  useEffect(() => () => {
    for (const controller of requestControllers.current.values()) controller.abort();
    requestControllers.current.clear();
  }, []);

  function removeConference(id: number) {
    onRemove(id);
    if (conferenceIds.length <= 2) onClose();
  }

  return (
    <dialog
      className="comparison-dialog"
      ref={dialogRef}
      aria-labelledby="comparison-dialog-title"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="comparison-dialog-content">
        <header className="comparison-dialog-header">
          <div>
            <span className="eyebrow">Conference planning</span>
            <h2 id="comparison-dialog-title">Compare Conferences</h2>
            <p>{conferenceIds.length} conferences selected</p>
          </div>
          <button
            className="comparison-close"
            type="button"
            aria-label="Close conference comparison"
            ref={closeButtonRef}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="comparison-grid">
          {conferenceIds.map((id) => {
            const state = detailStates[id];
            return (
              <article className="comparison-column" key={id}>
                <header>
                  <h3>{state?.status === "loaded" ? state.conference.title : `Conference ${id}`}</h3>
                  <button
                    type="button"
                    className="comparison-remove"
                    aria-label={`Remove ${state?.status === "loaded" ? state.conference.title : `conference ${id}`} from comparison`}
                    onClick={() => removeConference(id)}
                  >
                    Remove
                  </button>
                </header>
                {state?.status === "loading" || !state ? (
                  <div className="comparison-detail-skeleton" aria-label="Conference details loading" aria-busy="true">
                    <span /><span /><span /><span />
                  </div>
                ) : state.status === "error" ? (
                  <div className="comparison-unavailable" role="alert">
                    <p>Conference details are unavailable.</p>
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => loadDetail(id)}
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <ComparisonConferenceFields conference={state.conference} />
                )}
              </article>
            );
          })}
        </div>
      </div>
    </dialog>
  );
}

function deadlineFilter(value: string | null): ConferenceQuery["deadline"] {
  return value === "upcoming" || value === "7days" || value === "passed" || value === "none" ? value : undefined;
}

function compareConferenceDeadlines(left: Conference, right: Conference): number {
  const leftDays = left.days_until_deadline;
  const rightDays = right.days_until_deadline;
  const leftGroup = leftDays === null ? 2 : leftDays < 0 ? 1 : 0;
  const rightGroup = rightDays === null ? 2 : rightDays < 0 ? 1 : 0;

  if (leftGroup !== rightGroup) return leftGroup - rightGroup;
  if (leftGroup === 0) return (leftDays ?? 0) - (rightDays ?? 0);
  if (leftGroup === 1) return (rightDays ?? 0) - (leftDays ?? 0);
  return left.start_date.localeCompare(right.start_date);
}

export default function ExploreBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const comparisonIds = parseComparisonIds(searchParams.get("compare"));
  const listingParams = new URLSearchParams(queryString);
  listingParams.delete("compare");
  const listingQueryString = listingParams.toString();
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [countriesLoaded, setCountriesLoaded] = useState(false);
  const [countryError, setCountryError] = useState(false);
  const [conferenceResponse, setConferenceResponse] = useState<ConferenceResponse | null>(null);
  const [categoryError, setCategoryError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loadedRequest, setLoadedRequest] = useState("");
  const [failedRequest, setFailedRequest] = useState("");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compareButtonRef = useRef<HTMLButtonElement>(null);
  const comparisonBarRef = useRef<HTMLElement>(null);
  const currentCategory = searchParams.get("category") ?? "";
  const currentDeadline = searchParams.get("deadline") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const requestKey = `${listingQueryString}#${retry}`;
  const loading = loadedRequest !== requestKey;
  const error = failedRequest === requestKey;

  useEffect(() => {
    const controller = new AbortController();
    getCategories(controller.signal)
      .then((response) => { setCategories(response.categories); setCategoryError(false); })
      .catch(() => { if (!controller.signal.aborted) setCategoryError(true); });
    getConferenceCountries(controller.signal)
      .then((availableCountries) => {
        setCountries(availableCountries);
        setCountriesLoaded(true);
        setCountryError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCountriesLoaded(true);
          setCountryError(true);
        }
      });
    return () => controller.abort();
  }, [retry]);

  function debounceFilter(value: string) {
    const timerRef = searchTimer;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const nextValue = value.trim();
      if (nextValue) params.set("search", nextValue);
      else params.delete("search");
      params.delete("page");
      const suffix = params.toString();
      const currentSuffix = window.location.search.replace(/^\?/, "");
      if (suffix !== currentSuffix) router.replace(`/explore${suffix ? `?${suffix}` : ""}`, { scroll: false });
    }, 350);
  }

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(listingQueryString);
    getConferences({
      search: params.get("search") || undefined,
      country: params.get("country") || undefined,
      category: params.get("category") || undefined,
      deadline: deadlineFilter(params.get("deadline")),
      page: Math.max(1, Number(params.get("page") ?? "1") || 1),
      limit: PAGE_SIZE,
    }, controller.signal)
      .then((response) => {
        setConferenceResponse(response);
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
  }, [listingQueryString, retry, requestKey]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    const suffix = params.toString();
    router.push(`/explore${suffix ? `?${suffix}` : ""}`, { scroll: false });
  }

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(window.location.search);
    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");
    const suffix = params.toString();
    router.push(`/explore${suffix ? `?${suffix}` : ""}`, { scroll: false });
  }

  function clearFilters() {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const params = new URLSearchParams(window.location.search);
    for (const key of ["search", "country", "category", "deadline", "page"]) {
      params.delete(key);
    }
    const suffix = params.toString();
    router.push(`/explore${suffix ? `?${suffix}` : ""}`, { scroll: false });
  }

  function updateComparisonSelection(ids: number[]) {
    const params = new URLSearchParams(window.location.search);
    writeComparisonIds(params, ids);
    const suffix = params.toString();
    router.replace(`/explore${suffix ? `?${suffix}` : ""}`, { scroll: false });
  }

  function currentComparisonIds(): number[] {
    return parseComparisonIds(new URLSearchParams(window.location.search).get("compare"));
  }

  function toggleComparison(conference: Conference) {
    const selectedIds = currentComparisonIds();
    if (selectedIds.includes(conference.id)) {
      updateComparisonSelection(selectedIds.filter((id) => id !== conference.id));
      return;
    }
    if (selectedIds.length >= MAX_COMPARISON_CONFERENCES) return;
    updateComparisonSelection([...selectedIds, conference.id]);
  }

  function removeComparison(id: number) {
    const nextIds = currentComparisonIds().filter((selectedId) => selectedId !== id);
    updateComparisonSelection(nextIds);
    if (nextIds.length < 2) setComparisonOpen(false);
  }

  const conferences: Conference[] = [...(conferenceResponse?.results ?? [])].sort(compareConferenceDeadlines);
  const total = conferenceResponse?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const categoryLabel = categories.find((category) => category.name === currentCategory)?.display_name;
  const visibleConferenceNames = new Map(conferences.map((conference) => [conference.id, conference.title]));

  return (
    <main className="page-main">
      <div className="content-width">
        <div className="page-heading">
          <div><div className="eyebrow">Conference discovery</div><h1>Explore conferences</h1><p>Search real conference listings and narrow the field by research area, location, and paper deadline.</p></div>
        </div>
        <section className="filters" aria-label="Conference filters">
          <label><span className="field-label">Search</span><input key={searchParams.get("search") ?? "search-empty"} className="field-control" type="search" placeholder="Title or research topic" defaultValue={searchParams.get("search") ?? ""} onChange={(event) => debounceFilter(event.target.value)} /></label>
          <label><span className="field-label">Research area</span><select className="field-control" value={currentCategory} onChange={(event) => updateFilter("category", event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.name}>{category.display_name}</option>)}</select></label>
          <label>
            <span className="field-label">Country</span>
            <select
              className="field-control"
              value={searchParams.get("country") ?? ""}
              onChange={(event) => updateFilter("country", event.target.value)}
              disabled={!countriesLoaded && !countryError}
            >
              <option value="">Any country</option>
              {!countryError && countriesLoaded && countries.length === 0 && (
                <option value="" disabled>No countries available</option>
              )}
              {!countriesLoaded && <option value="" disabled>Country options are being prepared</option>}
              {countries.map((country) => <option key={country} value={country}>{country}</option>)}
            </select>
            {countryError && (
              <span className="country-filter-status" role="status">
                Country options unavailable.{" "}
                <button className="text-link" type="button" onClick={() => setRetry((value) => value + 1)}>
                  Try again
                </button>
              </span>
            )}
            {countriesLoaded && !countryError && countries.length === 0 && (
              <span className="country-filter-status" role="status">No country options available.</span>
            )}
          </label>
          <label><span className="field-label">Paper deadline</span><select className="field-control" value={currentDeadline} onChange={(event) => updateFilter("deadline", event.target.value)}><option value="">Any deadline</option><option value="upcoming">Upcoming</option><option value="7days">Within 7 days</option><option value="passed">Passed</option><option value="none">No deadline listed</option></select></label>
        </section>
        {categoryError && <p role="status" className="results-line">Research categories could not be loaded. <button className="text-link" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></p>}
        {comparisonIds.length > 0 && (
          <section
            className="comparison-bar"
            aria-label="Conference comparison selection"
            ref={comparisonBarRef}
            tabIndex={-1}
          >
            <div className="comparison-bar-summary">
              <strong aria-live="polite">{comparisonIds.length} of {MAX_COMPARISON_CONFERENCES} selected</strong>
              <span className="comparison-selected-names">
                {comparisonIds.map((id) => visibleConferenceNames.get(id) ?? `Conference ${id}`).join(" · ")}
              </span>
            </div>
            <div className="comparison-bar-actions">
              <div className="comparison-selected-controls">
                {comparisonIds.map((id) => (
                  <button
                    className="comparison-chip"
                    type="button"
                    key={id}
                    aria-label={`Remove ${visibleConferenceNames.get(id) ?? `conference ${id}`} from comparison`}
                    onClick={() => removeComparison(id)}
                  >
                    <span>{visibleConferenceNames.get(id) ?? `Conference ${id}`}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
              <button
                className="button-primary comparison-open-button"
                type="button"
                disabled={comparisonIds.length < 2}
                ref={compareButtonRef}
                onClick={() => setComparisonOpen(true)}
              >
                Compare
              </button>
              <button
                className="text-link comparison-clear-button"
                type="button"
                onClick={() => updateComparisonSelection([])}
              >
                Clear all
              </button>
            </div>
          </section>
        )}
        <div className="results-line" aria-live="polite">
          <span>{conferenceResponse
            ? `${total.toLocaleString()} ${total === 1 ? "conference" : "conferences"} found`
            : <span className="results-count-skeleton" aria-label="Conference results loading" />}</span>
          {loading && conferenceResponse && <span className="results-refresh-skeleton" aria-label="Refreshing results" />}
          {categoryLabel && <span>Filtered by {categoryLabel}</span>}
        </div>
        {error && !conferenceResponse ? (
          <div className="state-panel" role="alert"><h2>We couldn’t load conference listings.</h2><p>Check your connection and try again.</p><button className="button-primary" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></div>
        ) : loading && !conferenceResponse ? <ConferenceSkeleton /> : error ? (
          <>
            <div className="inline-error" role="alert">
              <strong>These results couldn’t be refreshed.</strong>
              <span>Your previous results are still shown.</span>
              <button className="text-link" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button>
            </div>
            <div className="conference-grid">{conferences.map((conference) => (
              <ConferenceCard
                key={conference.id}
                conference={conference}
                categoryLabel={categoryLabel}
                comparisonSelected={comparisonIds.includes(conference.id)}
                comparisonDisabled={comparisonIds.length >= MAX_COMPARISON_CONFERENCES}
                onToggleComparison={toggleComparison}
              />
            ))}</div>
          </>
        ) : conferences.length === 0 ? (
          <div className="state-panel"><h2>No conferences match your filters.</h2><p>Clear one or more filters to broaden your search.</p><button className="button-secondary" type="button" onClick={clearFilters}>Clear filters</button></div>
        ) : (
          <>
            <div className="conference-grid">{conferences.map((conference) => (
              <ConferenceCard
                key={conference.id}
                conference={conference}
                categoryLabel={categoryLabel}
                comparisonSelected={comparisonIds.includes(conference.id)}
                comparisonDisabled={comparisonIds.length >= MAX_COMPARISON_CONFERENCES}
                onToggleComparison={toggleComparison}
              />
            ))}</div>
            {pageCount > 1 && <nav className="pagination" aria-label="Conference pages"><button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => goToPage(page + 1)}>Next</button></nav>}
          </>
        )}
      </div>
      {comparisonOpen && comparisonIds.length >= 2 && (
        <ComparisonDialog
          conferenceIds={comparisonIds}
          onClose={() => {
            setComparisonOpen(false);
            requestAnimationFrame(() => {
              if (compareButtonRef.current?.disabled) comparisonBarRef.current?.focus();
              else compareButtonRef.current?.focus();
            });
          }}
          onRemove={removeComparison}
        />
      )}
    </main>
  );
}