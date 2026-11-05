import { q } from "./db";
import { addDays, isWeekend } from "./dates";
import { reportSdrs, type Member } from "./team";
import { n } from "./util";

/** All metric definitions live here and are shown on the Definitions page. */
export const DEFINITIONS: { name: string; rule: string }[] = [
  { name: "Total calls", rule: "Calls owned by the SDR whose Call_Start_Time falls on the day (India time), any call type." },
  { name: "Connected", rule: "Calls on the day with Call_Connected = Yes." },
  { name: "Meetings scheduled", rule: "Meetings (Events) created on the day, by Created_Time. This is the same rule the daily email uses." },
  { name: "Meetings held", rule: "Meetings whose Start_DateTime is on the day and Check_In_Status = VISITED." },
  { name: "Deals created", rule: "Deals created on the day, by Created_Time." },
  { name: "Offers", rule: "Offer count (the Amount field) on deals in stage Closed Won, counted on the day the deal was last modified. Replace once a proper offers field exists." },
  { name: "Working day", rule: "Monday to Friday, minus dates listed under Holidays in Settings." },
  { name: "Placed (FPC)", rule: "A student is placed when at least one row in the Offers data matches their email, or their name when the email is not found. The roster's own PLACED column is ignored because it lags." },
  { name: "Preference (FPC)", rule: "Taken from the PREFERENCE column. PREFERENCE CATEGORY is ignored because it maps Non-Technical to TECH." },
];

const D = (c: string) => `(${c} at time zone 'Asia/Kolkata')::date`;
export type DayMetric = { owner_id: string; day: string; calls: number; connected: number; scheduled: number; held: number; deals: number; offers: number };
const blank = (owner_id: string, day: string): DayMetric => ({ owner_id, day, calls: 0, connected: 0, scheduled: 0, held: 0, deals: 0, offers: 0 });

export async function metricsByDay(from: string, to: string): Promise<DayMetric[]> {
  const map = new Map<string, DayMetric>();
  const get = (o: string, d: string) => { const k = o + "|" + d; let r = map.get(k); if (!r) { r = blank(o, d); map.set(k, r); } return r; };
  const [calls, sched, held, deals, offers] = await Promise.all([
    q(`select owner_id, ${D("start_time")}::text as day, count(*)::int c, count(*) filter (where connected)::int k from calls where ${D("start_time")} between $1 and $2 group by 1,2`, [from, to]),
    q(`select owner_id, ${D("created_time")}::text as day, count(*)::int c from events where ${D("created_time")} between $1 and $2 group by 1,2`, [from, to]),
    q(`select owner_id, ${D("start_time")}::text as day, count(*)::int c from events where ${D("start_time")} between $1 and $2 and upper(coalesce(check_in_status,''))='VISITED' group by 1,2`, [from, to]),
    q(`select owner_id, ${D("created_time")}::text as day, count(*)::int c from deals where ${D("created_time")} between $1 and $2 group by 1,2`, [from, to]),
    q(`select owner_id, ${D("modified_time")}::text as day, coalesce(sum(amount),0)::float c from deals where stage ilike 'closed won' and ${D("modified_time")} between $1 and $2 group by 1,2`, [from, to]),
  ]);
  for (const r of calls) { const m = get(r.owner_id, r.day); m.calls += r.c; m.connected += r.k; }
  for (const r of sched) get(r.owner_id, r.day).scheduled += r.c;
  for (const r of held) get(r.owner_id, r.day).held += r.c;
  for (const r of deals) get(r.owner_id, r.day).deals += r.c;
  for (const r of offers) get(r.owner_id, r.day).offers += Math.round(r.c);
  return [...map.values()];
}

export async function workingDays(from: string, to: string) {
  const hol = new Set((await q("select day::text d from holidays where day between $1 and $2", [from, to])).map((r) => r.d));
  let c = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (!isWeekend(d) && !hol.has(d)) c++;
  return c;
}
export async function isWorkingDay(day: string) { return (await workingDays(day, day)) === 1; }

export type Totals = { calls: number; connected: number; scheduled: number; held: number; deals: number; offers: number };
export const zero = (): Totals => ({ calls: 0, connected: 0, scheduled: 0, held: 0, deals: 0, offers: 0 });
export function add(t: Totals, r: Partial<Totals>) { t.calls += n(r.calls); t.connected += n(r.connected); t.scheduled += n(r.scheduled); t.held += n(r.held); t.deals += n(r.deals); t.offers += n(r.offers); return t; }

export type ScoreRow = Totals & { member: Member; commit_calls: number; commit_connected: number; commit_meetings: number; target_calls: number; target_connected: number; target_meetings: number; connect_rate: number; rank?: number };

export async function scoreboard(from: string, to: string, sdrs?: Member[]) {
  const members = sdrs ?? (await reportSdrs());
  const rows = await metricsByDay(from, to);
  const wd = await workingDays(from, to);
  const commits = await q(`select owner_id, coalesce(sum(calls),0)::int calls, coalesce(sum(connected),0)::int connected, coalesce(sum(meetings_scheduled),0)::int meetings from commitments where day between $1 and $2 group by 1`, [from, to]);
  const cm = new Map(commits.map((c) => [c.owner_id, c]));
  const out: ScoreRow[] = members.map((m) => {
    const t = zero();
    rows.filter((r) => r.owner_id === m.zoho_id).forEach((r) => add(t, r));
    const c = cm.get(m.zoho_id);
    return { ...t, member: m, commit_calls: n(c?.calls), commit_connected: n(c?.connected), commit_meetings: n(c?.meetings),
      target_calls: m.target_calls * wd, target_connected: m.target_connected * wd, target_meetings: m.target_meetings * wd,
      connect_rate: t.calls ? Math.round((t.connected / t.calls) * 100) : 0 };
  });
  out.sort((a, b) => b.connected - a.connected || b.calls - a.calls);
  out.forEach((r, i) => (r.rank = i + 1));
  const total = zero();
  out.forEach((r) => add(total, r));
  return { rows: out, total, workingDays: wd };
}

export async function trend(from: string, to: string, sdrs?: Member[]) {
  const ids = new Set((sdrs ?? (await reportSdrs())).map((m) => m.zoho_id));
  const rows = (await metricsByDay(from, to)).filter((r) => ids.has(r.owner_id));
  const days = new Map<string, Totals>();
  for (let d = from; d <= to; d = addDays(d, 1)) days.set(d, zero());
  rows.forEach((r) => add(days.get(r.day) ?? zero(), r));
  // Weekends and holidays are left out so the lines do not drop to zero on days nobody works.
  const hol = new Set((await q("select day::text d from holidays where day between $1 and $2", [from, to])).map((r) => r.d));
  return [...days.entries()].filter(([day, t]) => (!isWeekend(day) && !hol.has(day)) || t.calls > 0).map(([day, t]) => ({ day, ...t }));
}
