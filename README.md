# FPC-MS

FACE Prep Campus management system: SDR scoreboard and commitments, Zoho CRM accounts and pipeline,
CRM data-quality checks, campus drives, FPC placement, candidates and profile packs, scheduled reports.
It runs on its own and does not need Claude.

Not included on purpose: the JobSpy scraper and Apollo work, which stay on your laptop.

## Run it on your computer
```bash
npm install
npm run dev          # http://localhost:3000, uses an embedded database in .data/
```
Open **Integrations** and press **Load sample data** to explore with made-up data.

## Commands
| | |
|---|---|
| `npm run dev` | local app |
| `npm run build` / `npm start` | production build |
| `npm test` | 17 tests, including a mock Zoho server |
| `npm run typecheck` | type check |
| `npm run db:migrate` | create or update tables on `DATABASE_URL` |

## Where things are
- `src/lib/zoho*.ts`, `sync.ts`: direct Zoho connection and 15-minute sync (India data centre, org check, only existing fields requested)
- `src/lib/metrics.ts`: every metric definition, in one file, also shown under Settings
- `src/lib/hygiene.ts`: the six CRM checks and the approval flow
- `src/lib/importers.ts`: roster, offers, drive tracker and candidate imports (Excel, CSV, or a linked Google Sheet)
- `src/lib/jobs.ts` + `.github/workflows/schedule.yml`: the scheduled jobs
- `src/lib/reports.ts`, `mail.ts`: report emails; saved as previews until `EMAIL_LIVE=true`
- `src/lib/ai.ts`: optional Gemini summary (only team totals are sent)
- `src/app/(app)/*`: the screens

## Guides
`docs/DEPLOY.md` (Supabase + Vercel + schedules), `docs/ZOHO_SETUP.md` (connect the CRM), `docs/ARCHITECTURE.md` (how it fits together).

One-click start on Vercel: https://vercel.com/new/clone?repository-url=https://github.com/V-Solanki03/fpc-ms&env=DATABASE_URL,APP_PASSWORD,SESSION_SECRET,CRON_SECRET

## Safe defaults
Zoho writes off, email in preview, AI off, app locked in production until `APP_PASSWORD` is set.
