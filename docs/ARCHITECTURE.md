# How FPC-MS is put together

```
Browser ──► Vercel (Next.js app) ──► Supabase Postgres
                 ▲   │
GitHub Actions ──┘   ├──► Zoho CRM  (read every 15 min; write only on approved hygiene fixes)
 (schedules)         ├──► Google Sheets / uploaded Excel (imports)
                     ├──► SMTP (reports; preview-only until EMAIL_LIVE=true)
                     └──► Gemini (optional, totals only)
```

The app never reads Zoho while a page loads. Pages read the app's own database, which the sync keeps current.
That is why every page is fast and why the numbers can always be traced to a Zoho record id.

## Folders
| Path | What lives there |
|---|---|
| `src/app/(app)/` | The screens, one folder per page. Server components that query the database directly |
| `src/app/actions.ts` | Every button that changes something (forms, approvals, imports, settings) |
| `src/app/api/cron/[job]` | Entry point the scheduler calls, protected by `CRON_SECRET` |
| `src/app/share/[token]` | Public, expiring profile-pack page (no login, no contact details) |
| `src/lib/schema.ts` | All tables. Add a new migration entry to change the database, never edit an old one |
| `src/lib/db.ts` | Database access (Postgres in production, embedded database locally) |
| `src/lib/zoho.ts`, `zoho-map.ts`, `sync.ts` | Zoho connection, field mapping, incremental sync |
| `src/lib/metrics.ts` | Every metric definition and the scoreboard queries |
| `src/lib/hygiene.ts` | CRM checks and the approve / dismiss flow |
| `src/lib/importers.ts` | Excel / CSV / Google Sheet imports |
| `src/lib/jobs.ts` | The job list, run logging, failure alerts |
| `src/lib/reports.ts`, `mail.ts` | Report builders and the email outbox |
| `tests/` | Metric, import, hygiene and Zoho-sync tests (the Zoho test uses a mock server) |

## Recipes
**Add a scheduled job:** add an entry to `JOBS` in `src/lib/jobs.ts`, add a line to `.github/workflows/schedule.yml` (cron and `case`), done. It appears on the Automations page automatically.
**Add a Zoho module to the sync:** add it to `ENTITIES` in `zoho-map.ts`, a table in a new migration in `schema.ts`, and its name to the `order` list in `sync.ts`.
**Change a metric:** edit `metrics.ts` and its entry in `DEFINITIONS` together, then update the test in `tests/core.test.ts`.
**Add a page:** create `src/app/(app)/<name>/page.tsx` and one line in `src/components/nav.tsx`.

## Safety switches (all default to off)
`ZOHO_WRITE_ENABLED`, `EMAIL_LIVE`, `GEMINI_API_KEY`. The app is locked in production until `APP_PASSWORD` is set, and refuses any Zoho org other than `ZOHO_ORG_ID`.

## Planned next
Google sign-in and roles (replaces the shared password), a per-person audit trail, Zoho webhooks for near-live updates, WhatsApp alerts.
