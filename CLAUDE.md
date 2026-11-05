# FPC-MS: notes for Claude Code

Next.js 15 (App Router) + TypeScript + Tailwind, Postgres (Supabase in production, embedded PGlite locally), deployed on Vercel. Read `docs/ARCHITECTURE.md` first.

## Commands
`npm run dev` · `npm test` (vitest, runs on an in-memory database) · `npx tsc --noEmit` · `npm run build`

## Rules
- All metric rules live in `src/lib/metrics.ts` with a matching entry in `DEFINITIONS`; change both and the tests.
- Never edit an existing migration in `src/lib/schema.ts`; append a new one. Migrations must be idempotent.
- Zoho writes, real email and AI are off by default. Do not enable them in code; they are environment switches.
- Never log or display secrets. The public `/share/[token]` page must never show email or phone.
- Dates are India time (`Asia/Kolkata`); use helpers in `src/lib/dates.ts`.
- Add a test for any change to metrics, imports, hygiene or sync. The Zoho sync test uses a mock fetch.
- Sample data (`source='demo'`) must stay clearly labelled and removable.
- The JobSpy scraper and Apollo work are intentionally outside this app.
