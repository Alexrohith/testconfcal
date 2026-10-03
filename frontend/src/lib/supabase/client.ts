import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/src/lib/supabase/config";
import type { Database } from "@/src/types/supabase";

export function createClient() {
  const { url, anonKey } = getSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
}