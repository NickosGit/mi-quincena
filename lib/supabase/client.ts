import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseEnv } from "./env";

/** Browser Supabase client (anon key + the user's session cookie). */
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
