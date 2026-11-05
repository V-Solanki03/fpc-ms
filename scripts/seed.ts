// Loads sample data into the configured database. Run with: npm run db:seed
import { seedDemo } from "../src/lib/demo";
seedDemo().then((r) => { console.log("Sample data loaded", r); process.exit(0); }).catch((e) => { console.error(e.message); process.exit(1); });
