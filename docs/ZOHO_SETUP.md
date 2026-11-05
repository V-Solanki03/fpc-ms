# Connecting Zoho CRM

FPC-MS reads your CRM with its own Zoho login (a "Self Client"). It does not use Claude.
Your Zoho is on the India data centre, so every address below uses `.in`.

1. Sign in to Zoho as the user the app should act as. Use an admin, or someone whose profile can see all
   accounts, deals, calls and meetings. The app only sees what this user can see.
2. Open https://api-console.zoho.in and choose **Self Client**.
3. In **Generate Code**, paste these scopes (read only), set the time to 10 minutes, and click **Create**:

   ```
   ZohoCRM.modules.READ,ZohoCRM.modules.custom.READ,ZohoCRM.settings.fields.READ,ZohoCRM.users.READ,ZohoCRM.org.READ
   ```
   If a source later shows a scope error on the Integrations page, add the scope it names and repeat.
4. Copy the code and exchange it for a refresh token within 10 minutes (run on your computer):

   ```bash
   curl -X POST "https://accounts.zoho.in/oauth/v2/token" \
     -d "grant_type=authorization_code" -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" -d "code=THE_CODE_FROM_STEP_3"
   ```
   Keep the `refresh_token` from the answer. It does not expire.
5. In Vercel, add these environment variables and redeploy:

   | Name | Value |
   |---|---|
   | `ZOHO_CLIENT_ID` | from the Self Client page |
   | `ZOHO_CLIENT_SECRET` | from the Self Client page |
   | `ZOHO_REFRESH_TOKEN` | from step 4 |
   | `ZOHO_ORG_ID` | `1363009000000020813` (FACE prep). The app refuses to sync from any other org |

6. Open **Integrations** and press **Sync Zoho now**. The first sync pulls users, accounts, contacts, deals,
   and the last 120 days of calls and meetings. Big modules finish over a few 15-minute runs.
7. Open **Settings**. Zoho users with the role "ER Associate" are marked as SDRs automatically. Untick
   "In reports" for anyone who should be left out (today: Shreshta, and Armaan from commitments).
   Tick "SDR" and "In reports" for Abhishek if he should appear as a zero row in the daily email.

Writes to Zoho stay OFF. Only after you trust the app, add the scope `ZohoCRM.modules.UPDATE`, set
`ZOHO_WRITE_ENABLED=true`, and choose a default owner in Settings. The only write the app can make is an
approved owner reassignment from the CRM hygiene page.

Keep the Self Client secret private. Never paste it into chat.
