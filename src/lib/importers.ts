import * as XLSX from "xlsx";
import { q, upsertMany } from "./db";
import { classifyLoss } from "./placement";
import { n } from "./util";
import { istDate } from "./dates";

export type Row = Record<string, any>;
export type ImportKind = "roster" | "offers" | "drives" | "candidates";
export type ImportReport = { kind: ImportKind; rows: number; saved: number; skipped: number; warnings: string[] };

const norm = (s: any) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const clean = (v: any) => (v === undefined || v === null ? "" : String(v).trim());
const nk = (s: any) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
const emailOf = (v: any) => clean(v).toLowerCase();

export function parseWorkbook(buf: Buffer | ArrayBuffer | Uint8Array) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  return wb.SheetNames.map((name) => ({ name, rows: sheetRows(wb.Sheets[name]) }));
}
/** First row with 3+ filled cells is the header. Keys are lower-case letters and digits only. */
export function sheetRows(ws: XLSX.WorkSheet): Row[] {
  const grid: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false, raw: true });
  const h = grid.findIndex((r) => r.filter((c) => clean(c) !== "").length >= 3);
  if (h < 0) return [];
  const keys = grid[h].map((c) => norm(c));
  return grid.slice(h + 1).map((r) => { const o: Row = {}; keys.forEach((k, i) => { if (k && o[k] === undefined) o[k] = r[i]; }); return o; })
    .filter((o) => Object.values(o).some((v) => clean(v) !== ""));
}
const pick = (r: Row, ...aliases: string[]) => { for (const a of aliases) { const v = r[a]; if (v !== undefined && clean(v) !== "") return v; } return ""; };

export function toDate(v: any): string | null {
  if (v === "" || v === null || v === undefined) return null;
  if (v instanceof Date && !isNaN(+v)) return new Date(v.getTime() + 12 * 3600000).toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = clean(v);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t + 12 * 3600000).toISOString().slice(0, 10);
}
function fill(rows: Row[], keys: string[]) {
  const last: Row = {};
  return rows.map((r) => { const o = { ...r }; for (const k of keys) { if (clean(o[k]) === "") o[k] = last[k] ?? ""; else last[k] = o[k]; } return o; });
}
const yes = (v: any) => /^(y|yes|true|1|done|received|available)/i.test(clean(v));

export async function importRoster(rows: Row[]): Promise<ImportReport> {
  const warnings: string[] = []; let skipped = 0;
  const out: any[][] = [];
  for (const r of rows) {
    const name = clean(pick(r, "name", "studentname", "fullname", "candidatename"));
    const email = emailOf(pick(r, "email", "emailid", "studentemail", "mail", "emailaddress"));
    const college = clean(pick(r, "college", "collegename", "institution", "institute", "inst", "university"));
    if (!name && !email) { skipped++; continue; }
    const key = email || `noemail:${nk(name)}:${nk(college)}`;
    out.push([key, name, clean(pick(r, "phone", "mobile", "phonenumber", "contact")), college, clean(pick(r, "department", "dept", "branch", "course", "degree")),
      clean(r["preference"]), clean(pick(r, "batch", "year", "passoutyear")), yes(r["placed"]), "import"]);
    if (!email) warnings.push(`No email for ${name}; matched by name only.`);
  }
  const seen = new Map(out.map((o) => [o[0], o])); // last row wins for repeated emails
  await upsertMany("students", ["email", "name", "phone", "college", "dept", "preference", "batch", "sheet_placed", "source"], [...seen.values()], "email");
  return { kind: "roster", rows: rows.length, saved: seen.size, skipped, warnings: warnings.slice(0, 10) };
}

export async function importOffers(raw: Row[]): Promise<ImportReport> {
  const rows = fill(raw, ["date", "owner", "company", "companyname", "sdr"]);
  const warnings: string[] = []; let skipped = 0;
  const out = new Map<string, any[]>();
  for (const r of rows) {
    const company = clean(pick(r, "company", "companyname"));
    const name = clean(pick(r, "studentname", "name", "candidatename", "candidate"));
    const email = emailOf(pick(r, "email", "emailid", "studentemail", "mail"));
    if (!company || (!name && !email)) { skipped++; continue; }
    const key = email || `noemail:${nk(name)}`;
    const role = clean(pick(r, "role", "designation", "position", "jobrole"));
    const status = clean(pick(r, "status", "joiningstatus", "offerstatus")) || "Offered";
    out.set(`${key}|${company}|${role}`, [key, name, clean(pick(r, "college", "collegename", "inst", "institution")), company, role,
      clean(pick(r, "ctc", "package", "salary", "lpa")), clean(pick(r, "stipend")), toDate(pick(r, "offerdate", "date")), toDate(pick(r, "joindate", "joiningdate", "doj")), status,
      clean(pick(r, "owner", "sdr")), "import"]);
  }
  await upsertMany("offers", ["student_email", "student_name", "college", "company", "role", "ctc", "stipend", "offer_date", "join_date", "status", "owner", "source"], [...out.values()], ["student_email", "company", "role"]);
  if (!out.size) warnings.push("No offer rows found. Check the tab has Company and Student Name (or Email) columns.");
  return { kind: "offers", rows: raw.length, saved: out.size, skipped, warnings };
}

export async function importDrives(raw: Row[]): Promise<ImportReport> {
  const rows = fill(raw, ["sr", "sdr", "date", "company"]);
  type D = { date: string | null; sdr: string; company: string; roles: any[] };
  const groups = new Map<string, D>();
  const warnings: string[] = []; let skipped = 0;
  for (const r of rows) {
    const company = clean(r["company"] || r["companyname"]);
    if (!company) { skipped++; continue; }
    const date = toDate(r["date"]);
    const k = nk(company) + "|" + date;
    const g = groups.get(k) || { date, sdr: clean(r["sdr"] || r["owner"]), company, roles: [] };
    g.roles.push({
      role: clean(pick(r, "role", "rolename", "jobrole")), type: clean(pick(r, "type", "roletype")), openings: n(pick(r, "openings", "vacancies")),
      status: clean(pick(r, "status", "rolestatus")), offers: n(pick(r, "offers", "offersreceived", "noofoffers")), joined: n(pick(r, "joined", "joinedcount")),
      feedback: clean(pick(r, "fb", "feedback", "reason", "feedbackreason")), detail: clean(pick(r, "detail", "details", "detailedfeedback")),
      location: clean(pick(r, "loc", "location")), ctc: clean(pick(r, "ctc", "package")), stipend: clean(pick(r, "stipend")), notes: clean(pick(r, "notes")),
    });
    groups.set(k, g);
  }
  let saved = 0;
  for (const g of groups.values()) {
    const offers = g.roles.reduce((a, r) => a + r.offers, 0), joined = g.roles.reduce((a, r) => a + r.joined, 0), openings = g.roles.reduce((a, r) => a + r.openings, 0);
    const fb = g.roles.find((r) => r.feedback) || g.roles[0];
    const allClosed = g.roles.every((r) => /close|reject|declin|lost/i.test(r.status + " " + r.feedback)) && offers === 0;
    const result = offers > 0 ? "Won" : allClosed ? "Lost" : "Open";
    const loss = result === "Lost" ? classifyLoss(fb.feedback, fb.detail) : null;
    const date = g.date || istDate();
    if (!g.date) warnings.push(`${g.company}: no date, used today's date.`);
    const first = g.roles.find((r) => r.location) || g.roles[0];
    const res = await q(
      `insert into drives(drive_date,company,sdr,result,outcome,owner_team,loss_category,loss_reason,summary,location,ctc,stipend,openings,offers,joined,notes,source)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'import')
       on conflict(company,drive_date) do update set sdr=excluded.sdr, result=excluded.result, outcome=excluded.outcome, owner_team=excluded.owner_team,
         loss_category=excluded.loss_category, loss_reason=excluded.loss_reason, summary=excluded.summary, location=excluded.location, ctc=excluded.ctc,
         stipend=excluded.stipend, openings=excluded.openings, offers=excluded.offers, joined=excluded.joined, notes=excluded.notes
       returning id`,
      [date, g.company, g.sdr, result, fb.feedback || null, loss?.team ?? null, loss?.category ?? null, loss?.reason ?? null, fb.detail || null, first.location || null,
        first.ctc || null, first.stipend || null, openings, offers, joined, g.roles.map((r) => r.notes).filter(Boolean).join("; ") || null]
    );
    const id = res[0].id;
    await q("delete from drive_roles where drive_id=$1", [id]);
    for (const r of g.roles) await q("insert into drive_roles(drive_id,role,role_type,openings,status,offers,joined,feedback,detail) values($1,$2,$3,$4,$5,$6,$7,$8,$9)", [id, r.role || null, r.type || null, r.openings, r.status || null, r.offers, r.joined, r.feedback || null, r.detail || null]);
    saved++;
  }
  return { kind: "drives", rows: raw.length, saved, skipped, warnings: warnings.slice(0, 10) };
}

export async function importCandidates(rows: Row[]): Promise<ImportReport> {
  const out = new Map<string, any[]>(); let skipped = 0; const warnings: string[] = [];
  for (const r of rows) {
    const name = clean(pick(r, "name", "studentname", "fullname", "candidatename"));
    const email = emailOf(pick(r, "email", "emailid", "mail", "emailaddress"));
    if (!email) { skipped++; continue; }
    const score = pick(r, "score", "assessmentscore", "marks", "percentage");
    out.set(email, [email, name, clean(pick(r, "phone", "mobile", "contact")), clean(pick(r, "college", "collegename", "institution", "inst")), clean(pick(r, "department", "dept", "branch", "course")),
      clean(r["preference"]), clean(pick(r, "skills", "skillset", "techstack")), score === "" ? null : Number(score) || null, yes(pick(r, "consent", "consentgiven")), clean(pick(r, "tags")), "import"]);
  }
  if (skipped) warnings.push(`${skipped} rows had no email and were skipped.`);
  await upsertMany("candidates", ["email", "name", "phone", "college", "dept", "preference", "skills", "assessment_score", "consent", "tags", "source"], [...out.values()], "email", { skipUpdate: ["consent"] });
  return { kind: "candidates", rows: rows.length, saved: out.size, skipped, warnings };
}

export const IMPORTERS: Record<ImportKind, (rows: Row[]) => Promise<ImportReport>> = { roster: importRoster, offers: importOffers, drives: importDrives, candidates: importCandidates };
export const IMPORT_LABEL: Record<ImportKind, string> = { roster: "FPC student roster", offers: "Offers", drives: "Campus drive tracker", candidates: "Candidates (talent pool)" };

export async function importWorkbook(kind: ImportKind, buf: Buffer | Uint8Array, tab?: string) {
  const sheets = parseWorkbook(buf);
  const sheet = (tab && sheets.find((s) => s.name.toLowerCase() === tab.toLowerCase())) || sheets[0];
  if (!sheet) throw new Error("The file has no sheets.");
  return IMPORTERS[kind](sheet.rows);
}

/** Works without any Google Cloud setup when the sheet is shared as "anyone in the organisation / anyone with the link can view". */
export async function fetchSheetXlsx(urlOrId: string): Promise<Buffer> {
  const id = (urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/) || [null, urlOrId])[1];
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`, { redirect: "follow" });
  const type = res.headers.get("content-type") || "";
  if (!res.ok || type.includes("text/html")) throw new Error("Could not read the Google Sheet. Share it as 'Anyone with the link can view', or upload the file instead.");
  return Buffer.from(await res.arrayBuffer());
}
