import "server-only";

import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { hasSupabaseEnv, requireSupabaseEnv } from "./env";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 * Queries carry the user's JWT (or none), so RLS always applies.
 */
export async function createClient() {
  // Reading cookies first marks the route as dynamic (never prerendered).
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't write cookies; proxy.ts refreshes the session.
        }
      },
    },
  });
}

/** Current user, validated against Supabase Auth (not just decoded from the cookie). */
export async function getUser() {
  if (!hasSupabaseEnv) {
    await cookies(); // keep the route dynamic even when Supabase isn't configured
    return { supabase: null, user: null };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}
