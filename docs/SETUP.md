# Setup: the steps only you can do

Replace `<ref>` with your Supabase project ref and `<vercel-url>` with the deployed host (e.g. `mi-quincena-xxx.vercel.app`).

## 1. Supabase (≈5 min)

1. https://supabase.com/dashboard → **New project**. Name `mi-quincena`, free plan, region **East US** or **West US** (closest to CDMX). The free plan allows **2 active projects**: if you're at the limit, pause an old week's project first.
2. **Project Settings → API Keys**: copy
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / publishable** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - ⚠️ Do **not** copy the service-role / secret key. The app never uses it.
   Put both in `mi-quincena/.env.local` (copy `.env.example`; it's gitignored).
3. **SQL Editor** → paste `supabase/schema.sql` → Run. Then paste `supabase/tests/rls.sql` → Run. You should get **SUMMARY: 16 of 16 PASS**. The suite rolls back; nothing stays in the table. (If the editor warns about a destructive query, that's the test's own `delete`, inside the rollback.)
4. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3800` (switch to `https://<vercel-url>` after Deploy 1)
   - Redirect URLs: add `http://localhost:3800/auth/callback` and `https://<vercel-url>/auth/callback`
5. **Authentication → Sign In / Providers → Google**: copy the **Callback URL** it shows (`https://<ref>.supabase.co/auth/v1/callback`). You need it in step 2.3.

## 2. Google OAuth client (≈7 min)

You can reuse a previous week's Google OAuth client: just add the new origins and redirect URI below. Or create a new one:

1. https://console.cloud.google.com → project picker → **New project** → `mi-quincena`.
2. **Google Auth Platform → Branding / Audience**: app name `Mi Quincena`, your email as support and developer contact, Audience **External**, status **Testing**. Under **Test users**, add every Gmail that will sign in (yours, a second account for the RLS check, persona testers).
3. **Clients → Create client → Web application**
   - Authorized JavaScript origins: `http://localhost:3800` and `https://<vercel-url>`
   - Authorized redirect URIs: `https://<ref>.supabase.co/auth/v1/callback` (from 1.5)
4. Paste the **Client ID** and **Client secret** into the Supabase Google provider (1.5), toggle **Enable**, **Save**. These two go into Supabase only, never into `.env.local`.

## 3. Gemini key (needed from F4)

1. https://aistudio.google.com → **Get API key → Create API key** → `GEMINI_API_KEY`.
2. Copy the exact ID of the current **free-tier Flash** model → `GEMINI_MODEL`.

## 4. GitHub + Vercel (Deploy 1)

1. https://github.com/new → repo `mi-quincena`, **no** README/.gitignore/license → send me the URL and I'll push.
2. https://vercel.com/new → **Import** the repo. Framework: Next.js (auto). Root directory `./`.
3. **Environment Variables** (Production + Preview): the two `NEXT_PUBLIC_SUPABASE_*` values now; `GEMINI_API_KEY` and `GEMINI_MODEL` from F4.
4. **Deploy**. Once you know `<vercel-url>`, add it to Supabase Site URL + Redirect URLs (1.4) and the Google JS origins (2.3). Then sign in from your phone.
