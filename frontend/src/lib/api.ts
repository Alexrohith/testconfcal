import type {
  CategoryResponse,
  Conference,
  ConferenceDetail,
  ConferenceQuery,
  ConferenceResponse,
} from "@/src/types/api";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    signal,
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

export function getConferences(
  query: ConferenceQuery = {},
  signal?: AbortSignal,
): Promise<ConferenceResponse> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return request<ConferenceResponse>(`/api/conferences/${suffix}`, signal);
}

export async function getCalendarConferences(
  query: Omit<ConferenceQuery, "page" | "limit">,
  signal?: AbortSignal,
): Promise<Conference[]> {
  const pageQuery = { ...query, page: 1, limit: 100 };
  const hasFilters = Object.values(query).some((value) => value !== undefined && value !== "");

  if (hasFilters) {
    const firstPage = await getConferences(pageQuery, signal);
    const pageCount = Math.ceil(firstPage.total / firstPage.limit);
    const remainingPages = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) =>
        getConferences({ ...pageQuery, page: index + 2 }, signal),
      ),
    );
    const unique = new Map<number, Conference>();

    for (const conference of [firstPage, ...remainingPages].flatMap((response) => response.results)) {
      unique.set(conference.id, conference);
    }

    return [...unique.values()];
  }

  const queries: ConferenceQuery[] = query.deadline
    ? [pageQuery]
    : [
        pageQuery,
        { ...pageQuery, deadline: "upcoming" },
        { ...pageQuery, deadline: "none" },
      ];
  const responses = await Promise.all(
    queries.map((conferenceQuery) => getConferences(conferenceQuery, signal)),
  );
  const unique = new Map<number, Conference>();

  for (const conference of responses.flatMap((response) => response.results)) {
    unique.set(conference.id, conference);
  }

  return [...unique.values()];
}

export class MultipleCategoryFilterUnsupportedError extends Error {
  constructor() {
    super("The conference API currently supports one research area per request.");
    this.name = "MultipleCategoryFilterUnsupportedError";
  }
}

export function getPersonalizedCalendarConferences(
  categoryNames: string[],
  query: Omit<ConferenceQuery, "page" | "limit" | "category">,
  signal?: AbortSignal,
): Promise<Conference[]> {
  const uniqueCategoryNames = [...new Set(categoryNames)];

  if (uniqueCategoryNames.length > 1) {
    return Promise.reject(new MultipleCategoryFilterUnsupportedError());
  }

  if (uniqueCategoryNames.length === 0) return Promise.resolve([]);

  return getCalendarConferences({ ...query, category: uniqueCategoryNames[0] }, signal);
}

export function getCategories(signal?: AbortSignal): Promise<CategoryResponse> {
  return request<CategoryResponse>("/api/categories/", signal);
}

export function getConference(
  id: string,
  signal?: AbortSignal,
): Promise<ConferenceDetail> {
  return request<ConferenceDetail | { error: string }>(
    `/api/conferences/${encodeURIComponent(id)}`,
    signal,
  ).then((response) => {
    if ("error" in response) throw new Error("Conference was not found.");
    return response;
  });
}