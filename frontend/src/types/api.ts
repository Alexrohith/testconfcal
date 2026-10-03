export type DeadlineStatus = "passed" | "urgent" | "upcoming" | "no_deadline";
export interface ConferenceCategory {
  id?: number;
  name: string;
  display_name: string;
}

export interface Category {
  id: number;
  name: string;
  display_name: string;
}

export interface Conference {
  id: number;
  event_id: number;
  title: string;
  start_date: string;
  end_date: string;
  paper_deadline: string | null;
  deadline_status: DeadlineStatus;
  days_until_deadline: number | null;
  city: string | null;
  country: string | null;
  format: string | null;
  is_virtual: boolean | null;
  website: string | null;
}

export interface SavedConference extends Conference {
  scope?: string | null;
  about?: string | null;
  categories?: ConferenceCategory[];
}

export interface ConferenceResponse {
  page: number;
  limit: number;
  total: number;
  results: Conference[];
}

export interface RecommendedConference extends Conference {
  match_count: number;
  match_percentage: number;
  matched_categories: ConferenceCategory[];
}

export interface RecommendedConferenceResponse {
  page: number;
  limit: number;
  total: number;
  personalization_configured: boolean;
  results: RecommendedConference[];
}

export interface CategoryResponse {
  categories: Category[];
}

export interface ConferenceDetail {
  id: number;
  event_id: number;
  title: string;
  start_date: string;
  end_date: string;
  paper_deadline: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  venue: string | null;
  scope: string | null;
  about: string | null;
  format: string | null;
  is_virtual: boolean | null;
  website: string | null;
  event_contact: string | null;
  ieee_region: string | null;
  ieee_detail_url: string | null;
  categories: ConferenceCategory[];
}

export interface ConferenceQuery {
  search?: string;
  country?: string;
  category?: string;
  deadline?: "upcoming" | "7days" | "passed" | "none";
  page?: number;
  limit?: number;
}

export interface Notification {
  id: number;
  reminder_id: number;
  conference_id: number;
  conference_title: string;
  paper_deadline: string;
  created_at: string;
  read_at: string | null;
}

export interface NotificationsResponse {
  notifications: Notification[];
}

export interface NotificationReadResponse {
  id: number;
  read_at: string;
}

export interface DeadlineReminder {
  id: number;
  conference_id: number;
  days_before: 1 | 3 | 7;
  enabled: boolean;
  paper_deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeadlineRemindersResponse {
  reminders: DeadlineReminder[];
}