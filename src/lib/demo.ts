// Sample data so the app can be explored before Zoho is connected. Every row is tagged source='demo' and can be cleared in one click.
import { q, upsertMany } from "./db";
import { istDate, addDays, isWeekend } from "./dates";
import { nameKey } from "./util";

function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const COMPANIES = ["Northwind Labs", "Bluepeak Systems", "Orchid Analytics", "Kestrel Software", "Lumen Retail Tech", "Harbor Cloud", "Mosaic Learning", "Cobalt Networks", "Pinecrest Digital", "Saffron Fintech", "Atlas Robotics", "Juniper Health IT", "Redwood Logistics", "Vertex Edutech", "Ember Games", "Quill Media", "Tandem Payments", "Nimbus Data", "Granite Infra", "Zephyr Apps"];
const COLLEGES = ["Demo College A", "Demo College B", "Demo College C", "Demo College D", "Demo College E", "Demo College F"];
const STAGES = ["Drive Identified", "Profiles Sent", "Interview", "Closed Won", "Closed Lost"];
const ROLES = ["Software Developer Intern", "QA Trainee", "Support Engineer", "Data Analyst Intern", "Business Development Executive", "Web Developer"];
const FEEDBACK = ["Company rejected candidates.", "College rejected.", "Company didn't respond.", "Offer Letter Received", "Candidate refused to join", "Company requirement was fulfilled."];

export async function seedDemo() {
  const R = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const int = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
  const today = istDate();
  const ist = (day: string, h: number, m: number) => `${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`;

  const sdrs = Array.from({ length: 7 }, (_, i) => ({ id: `demo-sdr-${i + 1}`, name: `Demo SDR ${i + 1}` }));
  await upsertMany("team_members", ["zoho_id", "name", "email", "zoho_role", "active", "is_sdr", "source"], [
    ...sdrs.map((s) => [s.id, s.name, `${s.id}@example.com`, "ER Associate", true, true, "demo"]),
    ["demo-mgr", "Demo Manager", "demo-mgr@example.com", "Manager", true, false, "demo"],
    ["demo-old-1", "Demo Former Employee", "former@example.com", "ER Associate", false, true, "demo"],
  ], "zoho_id");
  const owners = [...sdrs.map((s) => s.id), "demo-old-1"];

  const accounts: any[][] = COMPANIES.map((c, i) => [`demo-acc-${i}`, c, nameKey(c), i < 2 ? "demo-old-1" : pick(owners), `https://${nameKey(c)}.example.com`, "Software", null, `${addDays(today, -90 - i)}T10:00:00+05:30`, `${addDays(today, -int(0, 40))}T11:00:00+05:30`, "demo"]);
  for (let i = 0; i < 3; i++) accounts.push([`demo-acc-dup-${i}`, `DUP - ${COMPANIES[i]}`, nameKey(COMPANIES[i]), pick(owners), null, "Software", null, `${addDays(today, -60)}T10:00:00+05:30`, `${addDays(today, -20)}T10:00:00+05:30`, "demo"]);
  await upsertMany("accounts", ["zoho_id", "name", "name_key", "owner_id", "website", "industry", "phone", "created_time", "modified_time", "source"], accounts, "zoho_id");

  const contacts = accounts.slice(0, COMPANIES.length).flatMap((a, i) => [0, 1].map((k) => [`demo-con-${i}-${k}`, `Contact ${i}-${k}`, `hr${i}${k}@example.com`, null, "HR Manager", a[0], a[3], `${addDays(today, -50)}T10:00:00+05:30`, `${addDays(today, -10)}T10:00:00+05:30`, "demo"]));
  await upsertMany("contacts", ["zoho_id", "name", "email", "phone", "title", "account_id", "owner_id", "created_time", "modified_time", "source"], contacts, "zoho_id");

  const deals: any[][] = [];
  accounts.forEach((a, i) => { for (let k = 0; k < int(1, 3); k++) {
    const stage = pick(STAGES); const mod = addDays(today, -(stage.startsWith("Closed") ? int(0, 25) : int(0, 30)));
    deals.push([`demo-deal-${i}-${k}`, `${a[1]} - Drive ${k + 1}`, a[0], a[1], a[3], stage, stage === "Closed Won" ? int(1, 3) : null, addDays(today, int(-20, 30)), `${addDays(today, -int(5, 60))}T10:00:00+05:30`, `${mod}T12:00:00+05:30`, "demo"]);
  } });
  deals.push(["demo-deal-today-1", "Fresh drive today", "demo-acc-1", COMPANIES[1], sdrs[0].id, "Drive Identified", null, null, ist(today, 11, 0), ist(today, 11, 0), "demo"]);
  deals.push(["demo-deal-won-today", "Won today", "demo-acc-2", COMPANIES[2], sdrs[1].id, "Closed Won", 2, null, ist(addDays(today, -9), 11, 0), ist(today, 12, 0), "demo"]);
  await upsertMany("deals", ["zoho_id", "name", "account_id", "account_name", "owner_id", "stage", "amount", "closing_date", "created_time", "modified_time", "source"], deals, "zoho_id");

  const calls: any[][] = []; const events: any[][] = []; const commits: any[][] = [];
  for (let back = 40; back >= 0; back--) {
    const day = addDays(today, -back); if (isWeekend(day)) continue;
    sdrs.forEach((s, si) => {
      const skill = 0.6 + (si % 4) * 0.15; const total = back === 0 ? int(8, 30) : Math.round(int(40, 75) * skill);
      for (let k = 0; k < total; k++) {
        const conn = R() < 0.18 + skill * 0.1; const h = int(10, 17);
        calls.push([`demo-call-${day}-${s.id}-${k}`, s.id, "Outbound call", "Outbound", ist(day, h, int(0, 59)), conn, conn ? "Interested" : pick(["Not reachable", "Busy", "Invalid number"]), null, ist(day, h, 5), ist(day, h, 5), "demo"]);
      }
      for (let k = 0; k < int(0, 3); k++) {
        const startDay = addDays(day, int(1, 5));
        events.push([`demo-evt-${day}-${s.id}-${k}`, s.id, "Discovery meeting", ist(startDay, int(11, 16), 0), ist(startDay, 17, 0), ist(day, 14, 0), ist(day, 14, 0), startDay < today && R() < 0.65 ? "VISITED" : null, "demo"]);
      }
      if (back <= 14 && back > 0) commits.push([s.id, day, 60, 15, 2, 1, 0, 0, "Daily", "demo"]);
    });
  }
  // A silent-looking SDR is not seeded; one connected-but-invalid call set is, so the hygiene checks have real examples.
  calls.push(["demo-call-contradiction", sdrs[2].id, "Odd call", "Outbound", ist(addDays(today, -1), 12, 0), true, "Invalid number", null, ist(addDays(today, -1), 12, 0), ist(addDays(today, -1), 12, 0), "demo"]);
  await upsertMany("calls", ["zoho_id", "owner_id", "subject", "call_type", "start_time", "connected", "result", "who_name", "created_time", "modified_time", "source"], calls, "zoho_id");
  await upsertMany("events", ["zoho_id", "owner_id", "title", "start_time", "end_time", "created_time", "modified_time", "check_in_status", "source"], events, "zoho_id");
  for (const c of commits) await q("insert into commitments(owner_id,day,calls,connected,meetings_scheduled,meetings_to_conduct,upcoming_deals,offer_letters,kind,source) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(owner_id,day) do nothing", c);

  const students: any[][] = []; const offers: any[][] = [];
  COLLEGES.forEach((c, ci) => { for (let k = 0; k < 40; k++) {
    const email = `student${ci}${k}@example.com`; const pref = pick(["Technical", "Technical", "Tech Support", "Non-Tech"]);
    students.push([email, `Student ${ci}-${k}`, null, c, pick(["BCA", "BSc CS", "MCA", "BSc IT"]), pref, "2027", false, "demo"]);
    if (R() < 0.22) offers.push([email, `Student ${ci}-${k}`, c, pick(COMPANIES), pick(ROLES), "3 LPA", null, addDays(today, -int(1, 60)), addDays(today, int(-10, 30)), pick(["Joined", "Joining scheduled", "Did not join", "Offered"]), pick(sdrs).name, "demo"]);
  } });
  await upsertMany("students", ["email", "name", "phone", "college", "dept", "preference", "batch", "sheet_placed", "source"], students, "email");
  await upsertMany("offers", ["student_email", "student_name", "college", "company", "role", "ctc", "stipend", "offer_date", "join_date", "status", "owner", "source"], offers, ["student_email", "company", "role"]);

  for (let i = 0; i < 24; i++) {
    const company = COMPANIES[i % COMPANIES.length] + (i >= COMPANIES.length ? " (2)" : ""); const date = addDays(today, -int(3, 90));
    const fb = pick(FEEDBACK); const won = /offer/i.test(fb); const offersN = won ? int(1, 4) : 0; const lost = !won;
    const { classifyLoss } = await import("./placement");
    const loss = lost ? classifyLoss(fb) : null;
    const [d] = await q(`insert into drives(drive_date,company,sdr,result,outcome,owner_team,loss_category,loss_reason,location,ctc,openings,offers,joined,source)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'demo') on conflict(company,drive_date) do nothing returning id`,
      [date, company, pick(sdrs).name, won ? "Won" : i % 5 === 0 ? "Open" : "Lost", fb, loss?.team ?? null, loss?.category ?? null, loss?.reason ?? null, pick(["Chennai", "Bengaluru", "Remote"]), "3 - 4 LPA", int(1, 6), offersN, won ? int(0, offersN) : 0]);
    if (d) await q("insert into drive_roles(drive_id,role,role_type,openings,status,offers,joined,feedback) values($1,$2,'Technical',$3,$4,$5,$6,$7)", [d.id, pick(ROLES), int(1, 6), won ? "Offers Received" : "Close", offersN, 0, fb]);
  }
  const cands = Array.from({ length: 60 }, (_, i) => [`cand${i}@example.com`, `Candidate ${i}`, null, pick(COLLEGES), pick(["BCA", "BSc CS", "MCA"]), pick(["Technical", "Tech Support", "Non-Tech"]), pick(["Python, SQL", "Java, React", "Excel, Communication", "JavaScript, Node"]), int(40, 95), R() < 0.8, pick(["Pre-assessed", "Interview ready", ""]), "demo"]);
  await upsertMany("candidates", ["email", "name", "phone", "college", "dept", "preference", "skills", "assessment_score", "consent", "tags", "source"], cands, "email");
  await q("insert into holidays(day,name) values($1,'Sample holiday') on conflict do nothing", [addDays(today, 10)]);
  return { sdrs: sdrs.length, calls: calls.length, events: events.length, deals: deals.length, students: students.length };
}

export async function hasDemo() {
  const r = await q("select count(*)::int c from team_members where source='demo'");
  return r[0].c > 0;
}
export async function clearDemo() {
  for (const t of ["calls", "events", "deals", "contacts", "accounts", "students", "offers", "candidates", "commitments"]) await q(`delete from ${t} where source='demo'`);
  await q("delete from drives where source='demo'");
  await q("delete from team_members where source='demo'");
  await q("delete from holidays where name='Sample holiday'");
  await q("delete from hygiene_issues");
}
