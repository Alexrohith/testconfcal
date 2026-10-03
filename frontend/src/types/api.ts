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

export interface ConferenceResponse {
  page: number;
  limit: number;
  total: number;
  results: Conference[];
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