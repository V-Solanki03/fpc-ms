# Putting FPC-MS online (GitHub + Supabase + Vercel)

About 20 minutes. Everything below works on the free plans. Never paste keys or passwords into chat; type them straight into the website.

## 1. Database (Supabase)
1. supabase.com > **New project**. Name it `fpc-ms`, region **South Asia (Mumbai)**, set a strong database password and save it somewhere safe.
2. When it is ready: click **Connect** (top bar) > **Transaction pooler** > copy the connection string. Replace `[YOUR-PASSWORD]` in it with your database password.
   It looks like `postgresql://postgres.xxxx:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`.
3. Do nothing else. The tables are created automatically the first time the app opens.

## 2. Pick three secrets
Make three long random strings (a password manager can generate them, or run `openssl rand -hex 24` three times):
`APP_PASSWORD` is what your team types to enter. `SESSION_SECRET` and `CRON_SECRET` are private to the app.

## 3. App (Vercel)
1. vercel.com > **Add New > Project** > import `fpc-ms` from GitHub.
2. Open **Environment Variables** and add:

| Name | Value |
|---|---|
| `DATABASE_URL` | the string from step 1 |
| `APP_PASSWORD` | your team password |
| `SESSION_SECRET` | random string |
| `CRON_SECRET` | random string (write it down, step 5 needs it again) |
| `ADMIN_EMAIL` | where failure alerts go |

3. **Deploy**. Open the address Vercel shows, sign in with `APP_PASSWORD`, and open **Integrations**. The page should load with no red box.
   Press **Load sample data** if you want to look around before connecting Zoho (clear it later on the same page).

## 4. Zoho
Follow `docs/ZOHO_SETUP.md`, add the four `ZOHO_*` values in Vercel, redeploy, then press **Sync Zoho now**.
(The Zoho connection inside Claude is separate and cannot be reused by the app, so the app needs its own keys.)

## 5. Turn on the schedules (GitHub Actions, free)
Vercel's free plan can only run one imprecise job a day, so GitHub does the scheduling. In the GitHub repo: **Settings > Secrets and variables > Actions**
- **Secrets:** `APP_URL` = your Vercel address without a trailing slash, `CRON_SECRET` = the same value as in Vercel
- **Variables:** `CRON_ENABLED` = `true`

Then **Actions > schedule > Run workflow**, enter `sync.zoho`, and check **Automations** in the app shows a run. (GitHub may start a run a few minutes late.)
If you later move to Vercel Pro you can use Vercel Cron instead, but nothing requires it.

## 6. Email (when ready)
Reports are saved as previews until email is on. With a Google Workspace sender:
1. Turn on 2-step verification for that account, then create an **App password** (myaccount.google.com/apppasswords).
2. In Vercel add `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS` (the app password), `MAIL_FROM`.
3. Set recipients in **Settings**, check **Reports**, then add `EMAIL_LIVE=true` and redeploy.
Do not use this sender for cold outreach.

## 7. Optional AI
Create a key at aistudio.google.com, add `GEMINI_API_KEY` in Vercel. Only team totals are sent, never student or contact details.

## 8. Moving off the old Claude tasks
Run each job next to its Claude task for 3 working days, compare, then pause the Claude task:
`report.sdr_daily`, `hygiene.scan`, `report.fpc_weekly`, `commitments.open_day`. The scoreboard needs no job; it is live.

## Keeping it healthy
- `/api/health` answers `{"ok":true}` when the app and database are up. Point a free uptime monitor at it.
- Supabase free projects pause after a week of no activity and have limited backups. The 15-minute sync keeps it active; move to the paid plan once the team depends on the data.
- Change `APP_PASSWORD` when someone leaves. Google sign-in and roles replace it later.
