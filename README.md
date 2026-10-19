# Mi Quincena

Reads screenshots of BNPL payment calendars in the browser, groups the debt by *quincena* (Mexico's twice-monthly pay period) and shows what a new purchase would add to each one. It shows numbers; it never blocks, ranks or sells anything.

- **Spec:** [`docs/PACKET.md`](docs/PACKET.md) · build prompt: [`docs/IMPLEMENTATION_PROMPT.md`](docs/IMPLEMENTATION_PROMPT.md) · decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md) · setup: [`docs/SETUP.md`](docs/SETUP.md)

## Run locally

```bash
cp .env.example .env.local   # fill in (see docs/SETUP.md)
npm install
npm run dev                  # http://localhost:3800
```

Database: paste `supabase/schema.sql` into the Supabase SQL editor and run it. RLS tests: paste `supabase/tests/rls.sql` and run it (it rolls back).

## Checks

```bash
npm test          # vitest
npm run typecheck
npm run secrets   # git grep for key patterns
```
