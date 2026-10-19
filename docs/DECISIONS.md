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
- Tomorrow's first move: F2 — Next.js scaffold, Supabase Google auth, `installments` table with RLS.
