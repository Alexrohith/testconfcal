import { requestWithAccessToken } from "@/src/lib/api";
import type { SavedConference } from "@/src/types/api";

export interface SavedConferenceRepository {
  getSavedConferenceIds(): Promise<number[]>;
  saveConference(id: number): Promise<void>;
  removeConference(id: number): Promise<void>;
}

interface SavedStatusResponse {
  conference_id: number;
  saved: boolean;
}

interface SaveResponse {
  conference_id: number;
  saved: boolean;
  already_saved?: boolean;
  already_unsaved?: boolean;
}

interface SavedConferencesResponse {
  conferences: SavedConference[];
}

export async function getSavedConferences(accessToken: string): Promise<SavedConference[]> {
  const response = await requestWithAccessToken<SavedConferencesResponse>(
    "/api/conferences/saved",
    "GET",
    accessToken,
  );
  return response.conferences;
}

export function getConferenceSavedStatus(
  conferenceId: number,
  accessToken: string,
): Promise<SavedStatusResponse> {
  return requestWithAccessToken(
    `/api/conferences/${encodeURIComponent(conferenceId)}/saved`,
    "GET",
    accessToken,
  );
}

export function saveConference(
  conferenceId: number,
  accessToken: string,
): Promise<SaveResponse> {
  return requestWithAccessToken(
    `/api/conferences/${encodeURIComponent(conferenceId)}/save`,
    "POST",
    accessToken,
  );
}

export function removeSavedConference(
  conferenceId: number,
  accessToken: string,
): Promise<SaveResponse> {
  return requestWithAccessToken(
    `/api/conferences/${encodeURIComponent(conferenceId)}/save`,
    "DELETE",
    accessToken,
  );
}