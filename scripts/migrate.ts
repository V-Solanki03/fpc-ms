// Creates or updates all tables. Run with: DATABASE_URL=... npm run db:migrate
import { getDb } from "../src/lib/db";
getDb().then(() => { console.log("Database is up to date."); process.exit(0); }).catch((e) => { console.error(e.message); process.exit(1); });
