# Decisions — Mi Quincena (Week 10)

## 2026-10-18
- Decided: F1 quincena engine as pure functions over ISO date strings (`YYYY-MM-DD`) and integer cents. `totalsByQuincena`, `splitPurchase` and `prePurchaseImpact` return cents; pesos only at the edges (`toCents` in, `formatMXN` out).
- Why: `due_date` is a Postgres `date`, so strings avoid timezone shifts (`new Date("2026-11-15")` is Nov 14 in Mexico City). Cents make totals exact; `toCents` rejects sub-cent amounts instead of rounding them silently.
- Decided: `count` in `totalsByQuincena` is the number of installments in that quincena (the dashboard's "number of plans" will be derived from labels in F5).
- Decided: engine tests use synthetic rows that reproduce the brief's $2,490.50 for the 1st Nov 2026 quincena; real fixture text replaces them from F3.
- Resolved: Week 10 `docs/PACKET.md` arrived after F1. Checked F1 against it: no conflicts; §10 items 1 (bucketing) and 4 ($899 in 4 → +$224.75) are already covered by `tests/quincena.test.ts`.
- Packet rules the prompt doesn't spell out, to apply in later features (packet wins): installment amount 0.01–100,000; due date within −1/+24 months of today; label ≤ 40 chars; §10.3 — blurred fixture, once the user fills the dates, must total $2,490.50.
- Noted: the packet's security table mentions a Supabase service key in Vercel env; the prompt says not to use it at all. Following the stricter rule: no service-role key anywhere.
- Open: the packet embeds `mockup.png`, but the only one in Downloads is from Week 7 (2026-09-27). Waiting for the Week 10 image before adding `docs/mockup.png`.
- Rejected: accepting `Date` objects in `quincenaOf` (local vs UTC ambiguity); Intl currency formatting (output depends on the runtime's ICU data).
- Decided (F2): reuse Sello's Supabase SSR pattern (`proxy.ts` refreshes the session, pages re-check with `auth.getUser()`, PKCE callback with `safeNext` against open redirects). Signed-out `/dashboard` goes to `/`, as the prompt says, not to a separate login page.
- Decided (F2): RLS is tested with `supabase/tests/rls.sql` (16 checks, two simulated users via `role` + `request.jwt.claims`, forced rollback), the same mechanism PostgREST uses for supabase-js calls. Packet §10.5 also asks for a two-Google-account check through the client. That one stays manual: sign in with a second test account and confirm its dashboard shows 0 pagos.
- Decided (F2): schema adds `revoke all … from anon` and a `(user_id, due_date)` index beyond the prompt's SQL. Both are additive.
- Decided (F2): `npm run secrets`. The prompt's literal F2 grep pattern has two false positives: `docs/IMPLEMENTATION_PROMPT.md` quotes the pattern, and `package-lock.json` has the tarball URL of `queue-microtask` (an eslint transitive dep) whose name + version contains the OpenAI-style prefix. This file never quotes the pattern, so the scan stays clean. The script runs key-shaped patterns over every file (tracked + untracked) and the literal pattern with only those two files excluded.
- Decided (F2): landing puts the Google button directly under the one-line pitch, above the steps; on a 375px screen it was below the fold (packet persona: "distrusts anything that asks to log in before showing value"). F7's demo button belongs in the same spot.
- Verified (F2, 2026-10-18): `schema.sql` applied to the Supabase project; `rls.sql` 16/16 PASS (run by Nicolas); signed-out REST read of `installments` returns 401 `permission denied`; Google sign-in on localhost reached `/dashboard` (server log: callback 307 → dashboard 200).
- Pending (F2): the two-Google-account check through the client (packet §10.5) is only meaningful once account A has saved rows, so it moves to F5's acceptance.
- Deploy 1 (2026-10-18): https://mi-quincena-tau.vercel.app from github.com/NickosGit/mi-quincena (main). Live checks: `/` 200 with the Google button (env wired), signed-out `/dashboard` → 307 to `/`, security headers present. Nicolas signed in with Google from his phone and saw the empty dashboard.
- Tomorrow's first move: F3. Needs `fixtures/clean.png` and `fixtures/blurred.png` (the brief's fictional calendars).
