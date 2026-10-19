import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { isProtectedPath } from "@/lib/routes";

/**
 * Refreshes the Supabase session and sends signed-out visitors of /dashboard to "/".
 * (Next 16 calls middleware "proxy".) Pages re-check the session: this is the
 * first barrier, not the only one.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const needsAuth = isProtectedPath(request.nextUrl.pathname);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without credentials there can be no session.
  if (!url || !anonKey) {
    return needsAuth ? NextResponse.redirect(new URL("/", request.url)) : response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && needsAuth) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webmanifest|traineddata)$).*)"],
};
