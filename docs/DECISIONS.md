# Decisions — Mi Quincena (Week 10)

## 2026-10-18
- Decided: F1 quincena engine as pure functions over ISO date strings (`YYYY-MM-DD`) and integer cents. `totalsByQuincena`, `splitPurchase` and `prePurchaseImpact` return cents; pesos only at the edges (`toCents` in, `formatMXN` out).
- Why: `due_date` is a Postgres `date`, so strings avoid timezone shifts (`new Date("2026-11-15")` is Nov 14 in Mexico City). Cents make totals exact; `toCents` rejects sub-cent amounts instead of rounding them silently.
- Decided: `count` in `totalsByQuincena` is the number of installments in that quincena (the dashboard's "number of plans" will be derived from labels in F5).
- Decided: engine tests use synthetic rows that reproduce the brief's $2,490.50 for the 1st Nov 2026 quincena; real fixture text replaces them from F3.
- Open: no Week 10 `docs/PACKET.md` was supplied (Downloads only has Week 9's). Building from IMPLEMENTATION_PROMPT.md + brief + blueprint until it arrives; F8 needs its §10 test plan.
- Rejected: accepting `Date` objects in `quincenaOf` (local vs UTC ambiguity); Intl currency formatting (output depends on the runtime's ICU data).
- Tomorrow's first move: F2 — Next.js scaffold, Supabase Google auth, `installments` table with RLS.
