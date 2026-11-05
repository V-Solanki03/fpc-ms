# Putting FPC-MS online (Vercel)

## 1. A database
FPC-MS needs a Postgres database. The easiest options, both with a free tier to start:

- **Neon** (neon.tech): create a project, choose an Asia region (Singapore), copy the *pooled* connection string.
- **Supabase** (supabase.com): create a project in Mumbai (ap-south-1), Project Settings > Database > Connection string > **Transaction pooler**.

Tables are created automatically the first time the app opens. Free tiers pause or limit idle databases, so move to a paid plan once the team depends on it. Turn on daily backups.

## 2. Put the code on GitHub
Create a private repository and push this folder to it.

## 3. Create the Vercel project
1. vercel.com > Add New > Project > import the repository. Framework is detected as Next.js.
2. Add these environment variables (Settings > Environment Variables):

| Name | Value |
|---|---|
| `DATABASE_URL` | connection string from step 1 |
| `APP_PASSWORD` | the password the team will type to enter. The app stays locked until this is set |
| `SESSION_SECRET` | a long random string |
| `CRON_SECRET` | another long random string (Vercel sends it to scheduled jobs automatically) |
| `ADMIN_EMAIL` | where failure alerts go |
| `ZOHO_*` | see docs/ZOHO_SETUP.md |
| `EMAIL_LIVE`, `SMTP_*`, `MAIL_FROM` | when you are ready to send reports. See below |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | optional. Key from aistudio.google.com |

3. Deploy. Open the address Vercel gives you and sign in with `APP_PASSWORD`.

## 4. Scheduled jobs and your Vercel plan
`vercel.json` schedules the jobs (Zoho sync every 15 minutes, reports, hygiene scan). Times there are UTC.

- **Vercel Pro:** works as shipped.
- **Vercel Hobby (free):** it refuses a deployment that has jobs running more than once a day. Copy `docs/vercel.hobby.json` over `vercel.json`, then use `.github/workflows/cron.yml` (read the comments in it) so GitHub calls the sync every 15 minutes for free.

You can always press **Run now** on the Automations page.

## 5. Sending email
Reports are saved as previews until email is switched on. For a Gmail or Google Workspace sender:
1. Turn on 2-step verification for that Google account, then create an **App password** (myaccount.google.com/apppasswords).
2. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=that address`, `SMTP_PASS=the app password`, `MAIL_FROM="FPC-MS <that address>"`.
3. Set recipients in **Settings**. Open **Reports**, check the preview, then set `EMAIL_LIVE=true` and redeploy.

Workspace limits sending to about 2,000 messages a day, far more than the reports need. Do not use this sender for cold outreach.

## 6. Moving off the old Claude routines
Run each automation beside the old Claude task for 3 working days, compare outputs, then pause the Claude task:
`report.sdr_daily` (6:10 PM), `hygiene.scan` (9:04 AM), the scoreboard (live, no job needed), `report.fpc_weekly` (Saturday), `commitments.open_day` (9:30 AM).

## 7. Later
Google sign-in and roles replace the shared password. Until then, treat `APP_PASSWORD` as a team secret and change it when someone leaves.
