export interface SavedConferenceRepository {
  getSavedConferenceIds(): Promise<number[]>;
  saveConference(id: number): Promise<void>;
  removeConference(id: number): Promise<void>;
}