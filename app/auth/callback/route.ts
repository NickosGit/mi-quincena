import { NextResponse } from "next/server";

import { safeNext } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

/** Return trip from Google (PKCE): exchanges the `code` for a session cookie. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // Behind Vercel's proxy, `origin` can be the internal host.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const base = isLocal || !forwardedHost ? origin : "https://" + forwardedHost;

  if (!code) return NextResponse.redirect(base + "/?error=sin_codigo");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(base + "/?error=enlace");

  return NextResponse.redirect(base + next);
}
