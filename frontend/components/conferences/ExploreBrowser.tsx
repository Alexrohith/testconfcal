"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCategories, getConferences } from "@/src/lib/api";
import type { Category, Conference, ConferenceQuery, ConferenceResponse } from "@/src/types/api";
import ConferenceCard from "@/components/conferences/ConferenceCard";
import ConferenceSkeleton from "@/components/conferences/ConferenceSkeleton";

const PAGE_SIZE = 20;

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [conferenceResponse, setConferenceResponse] = useState<ConferenceResponse | null>(null);
  const [categoryError, setCategoryError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loadedRequest, setLoadedRequest] = useState("");
  const [failedRequest, setFailedRequest] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentCategory = searchParams.get("category") ?? "";
  const currentDeadline = searchParams.get("deadline") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const requestKey = `${queryString}#${retry}`;
  const loading = loadedRequest !== requestKey;
  const error = failedRequest === requestKey;

  useEffect(() => {
    const controller = new AbortController();
    getCategories(controller.signal)
      .then((response) => { setCategories(response.categories); setCategoryError(false); })
      .catch(() => { if (!controller.signal.aborted) setCategoryError(true); });
    return () => controller.abort();
  }, [retry]);

  function debounceFilter(key: "search" | "country", value: string) {
    const timerRef = key === "search" ? searchTimer : countryTimer;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const nextValue = value.trim();
      if (nextValue) params.set(key, nextValue);
      else params.delete(key);
      params.delete("page");
      const suffix = params.toString();
      const currentSuffix = window.location.search.replace(/^\?/, "");
      if (suffix !== currentSuffix) router.replace(`/explore${suffix ? `?${suffix}` : ""}`, { scroll: false });
    }, 350);
  }

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (countryTimer.current) clearTimeout(countryTimer.current);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(queryString);
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
  }, [queryString, retry, requestKey]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(queryString);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    const suffix = params.toString();
    router.push(`/explore${suffix ? `?${suffix}` : ""}`, { scroll: false });
  }

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(queryString);
    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");
    router.push(`/explore?${params.toString()}`, { scroll: false });
  }

  function clearFilters() {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (countryTimer.current) clearTimeout(countryTimer.current);
    router.push("/explore", { scroll: false });
  }

  const conferences: Conference[] = [...(conferenceResponse?.results ?? [])].sort(compareConferenceDeadlines);
  const total = conferenceResponse?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const categoryLabel = categories.find((category) => category.name === currentCategory)?.display_name;

  return (
    <main className="page-main">
      <div className="content-width">
        <div className="page-heading">
          <div><div className="eyebrow">Conference discovery</div><h1>Explore conferences</h1><p>Search real conference listings and narrow the field by research area, location, and paper deadline.</p></div>
        </div>
        <section className="filters" aria-label="Conference filters">
          <label><span className="field-label">Search</span><input key={searchParams.get("search") ?? "search-empty"} className="field-control" type="search" placeholder="Title or research topic" defaultValue={searchParams.get("search") ?? ""} onChange={(event) => debounceFilter("search", event.target.value)} /></label>
          <label><span className="field-label">Research area</span><select className="field-control" value={currentCategory} onChange={(event) => updateFilter("category", event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.name}>{category.display_name}</option>)}</select></label>
          <label><span className="field-label">Country</span><input key={searchParams.get("country") ?? "country-empty"} className="field-control" type="search" placeholder="Any country" defaultValue={searchParams.get("country") ?? ""} onChange={(event) => debounceFilter("country", event.target.value)} /></label>
          <label><span className="field-label">Paper deadline</span><select className="field-control" value={currentDeadline} onChange={(event) => updateFilter("deadline", event.target.value)}><option value="">Any deadline</option><option value="upcoming">Upcoming</option><option value="7days">Within 7 days</option><option value="passed">Passed</option><option value="none">No deadline listed</option></select></label>
        </section>
        {categoryError && <p role="status" className="results-line">Research categories could not be loaded. <button className="text-link" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></p>}
        <div className="results-line" aria-live="polite"><span>{loading ? "Loading conferences…" : `${total.toLocaleString()} ${total === 1 ? "conference" : "conferences"} found`}</span>{categoryLabel && <span>Filtered by {categoryLabel}</span>}</div>
        {loading ? <ConferenceSkeleton /> : error ? (
          <div className="state-panel" role="alert"><h2>Unable to load conferences.</h2><p>Check that the ConfCal API is running, then try again.</p><button className="button-primary" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></div>
        ) : conferences.length === 0 ? (
          <div className="state-panel"><h2>No conferences match your filters.</h2><p>Clear one or more filters to broaden your search.</p><button className="button-secondary" type="button" onClick={clearFilters}>Clear filters</button></div>
        ) : (
          <>
            <div className="conference-grid">{conferences.map((conference) => <ConferenceCard key={conference.id} conference={conference} categoryLabel={categoryLabel} />)}</div>
            {pageCount > 1 && <nav className="pagination" aria-label="Conference pages"><button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => goToPage(page + 1)}>Next</button></nav>}
          </>
        )}
      </div>
    </main>
  );
}