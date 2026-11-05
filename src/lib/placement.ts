import { q } from "./db";
import { n } from "./util";

export const prefGroup = (p: string | null | undefined) => {
  const s = String(p || "").toLowerCase();
  if (!s) return "Unknown";
  if (/support/.test(s)) return "Tech Support";
  if (/non/.test(s)) return "Non-Tech";
  if (/tech/.test(s)) return "Technical";
  return "Unknown";
};
const emailKey = (e: any) => String(e || "").trim().toLowerCase();
const nameKey = (s: any) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const noEmail = (e: any) => !emailKey(e) || emailKey(e).startsWith("noemail:");

export type CollegeRow = { college: string; total: number; placed: number; tech: [number, number]; support: [number, number]; nontech: [number, number]; unknown: [number, number] };

/** Placed = has a row in offers, matched by email and then by name. The roster's own PLACED column is ignored. */
export async function fpcMetrics() {
  const students = await q("select email,name,college,preference from students");
  const offers = await q("select student_email, student_name from offers");
  const byEmail = new Set(offers.map((o) => emailKey(o.student_email)).filter(Boolean));
  // A name is only used when the offer row has no email, so two students with the same name are not merged by accident.
  const byName = new Set(offers.filter((o) => noEmail(o.student_email)).map((o) => nameKey(o.student_name)).filter(Boolean));
  const map = new Map<string, CollegeRow>();
  let placedTotal = 0;
  for (const s of students) {
    const c = s.college || "(no college)";
    const row = map.get(c) || { college: c, total: 0, placed: 0, tech: [0, 0], support: [0, 0], nontech: [0, 0], unknown: [0, 0] };
    const placed = byEmail.has(emailKey(s.email)) || (!!nameKey(s.name) && byName.has(nameKey(s.name)));
    const g = prefGroup(s.preference);
    const slot = g === "Technical" ? row.tech : g === "Tech Support" ? row.support : g === "Non-Tech" ? row.nontech : row.unknown;
    row.total++; slot[1]++;
    if (placed) { row.placed++; slot[0]++; placedTotal++; }
    map.set(c, row);
  }
  const rows = [...map.values()].sort((a, b) => b.total - a.total);
  const distinctOfferStudents = new Set(offers.map((o) => emailKey(o.student_email) || nameKey(o.student_name))).size;
  const total = rows.reduce((a, r) => a + r.total, 0);
  return { rows, total, placed: placedTotal, offerRows: offers.length, distinctOfferStudents, mismatch: Math.abs(placedTotal - distinctOfferStudents) };
}

export async function driveStats() {
  const [s] = await q(`select count(*)::int drives, count(*) filter (where result='Won')::int won, count(*) filter (where result='Lost')::int lost,
    count(*) filter (where result='Open')::int open, coalesce(sum(offers),0)::int offers, coalesce(sum(joined),0)::int joined from drives`);
  return s;
}

export const LOSS_CATEGORIES = ["Company", "Academic", "Delivery", "Ops", "ERT"] as const;
/** Best-guess owner team and reason from the free-text feedback in the tracker. Edit later in the app. */
export function classifyLoss(feedback: string, detail = ""): { team: string; category: string; reason: string } {
  const t = (feedback + " " + detail).toLowerCase();
  if (/college reject|not approved|exam|unpaid|sales role|digital.?marketing/.test(t)) return { team: "Academic", category: "College / approval", reason: "College or academic team did not approve the role" };
  if (/onsite|on-site|face to face|face-to-face|noida|north|location|language/.test(t)) return { team: "Academic", category: "Location", reason: "Location or in-person interview not workable" };
  if (/didn'?t respond|didn.t respond|no response|not respond|silent/.test(t)) return { team: /follow.?up|whatsapp|mail/.test(t) ? "Company" : "ERT", category: "No response", reason: /follow.?up|whatsapp|mail/.test(t) ? "No reply even after follow-up" : "No reply, no follow-up recorded" };
  if (/requirement.*fulfil|filled|closed|hold/.test(t)) return { team: "Company", category: "Role closed", reason: "Role filled, closed or on hold" };
  if (/refus|declin|did not join|not join/.test(t)) return { team: "Ops", category: "Joining", reason: "Offered student did not join" };
  if (/reject|shortlist|not prepared|weak|skill/.test(t)) return { team: "Delivery", category: "Candidate fit", reason: "Profiles rejected on skills or readiness" };
  return { team: "ERT", category: "Unclear", reason: "No reason recorded" };
}
export { n };
