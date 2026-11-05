import { esc } from "./util";
import { longDate } from "./dates";
import { scoreboard } from "./metrics";
import { fpcMetrics } from "./placement";
import { queueEmail } from "./mail";
import { getSetting } from "./settings";

const th = 'style="background:#f2f4f6;border:1px solid #ddd;padding:6px;text-align:left"';
const td = 'style="border:1px solid #ddd;padding:6px"';
const tdn = 'style="border:1px solid #ddd;padding:6px;text-align:right"';

export async function buildSdrDaily(day: string) {
  const { rows, total } = await scoreboard(day, day);
  const head = ["SDR", "Total Calls", "Calls Connected", "Meetings Scheduled", "Meetings Happened", "Deals Created"];
  const body = rows.map((r) => `<tr><td ${td}>${esc(r.member.name)}</td><td ${tdn}>${r.calls}</td><td ${tdn}>${r.connected}</td><td ${tdn}>${r.scheduled}</td><td ${tdn}>${r.held}</td><td ${tdn}>${r.deals}</td></tr>`).join("");
  const tot = `<tr style="font-weight:bold"><td ${td}>Total</td><td ${tdn}>${total.calls}</td><td ${tdn}>${total.connected}</td><td ${tdn}>${total.scheduled}</td><td ${tdn}>${total.held}</td><td ${tdn}>${total.deals}</td></tr>`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px"><p>Hi team,</p><p>Please find today's SDR performance summary below.</p>
<table style="border-collapse:collapse"><thead><tr>${head.map((h) => `<th ${th}>${h}</th>`).join("")}</tr></thead><tbody>${body}${tot}</tbody></table><p>Thank You</p></div>`;
  const text = [head.join(" | "), ...rows.map((r) => [r.member.name, r.calls, r.connected, r.scheduled, r.held, r.deals].join(" | ")), ["Total", total.calls, total.connected, total.scheduled, total.held, total.deals].join(" | ")].join("\n");
  return { subject: `DAILY SDR DASHBOARD ${longDate(day)} (FACEPREP)`, html, text, total };
}

export async function buildFpcWeekly(day: string) {
  const m = await fpcMetrics();
  const cell = (p: [number, number]) => (p[1] ? `${p[0]}/${p[1]}` : "-");
  const head = ["College", "Placed / Total", "Technical", "Tech Support", "Non-Tech"];
  const body = m.rows.map((r) => `<tr><td ${td}>${esc(r.college)}</td><td ${tdn}>${r.placed}/${r.total}</td><td ${tdn}>${cell(r.tech)}</td><td ${tdn}>${cell(r.support)}</td><td ${tdn}>${cell(r.nontech)}</td></tr>`).join("");
  const warn = m.mismatch > 2 ? `<p style="color:#b00"><b>Check:</b> matched placed students (${m.placed}) and distinct students in the Offers data (${m.distinctOfferStudents}) differ by ${m.mismatch}.</p>` : "";
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px"><p>FPC Placement Metrics by College, ${longDate(day)}</p>${warn}<table style="border-collapse:collapse"><thead><tr>${head.map((h) => `<th ${th}>${h}</th>`).join("")}</tr></thead><tbody>${body}<tr style="font-weight:bold"><td ${td}>Total</td><td ${tdn}>${m.placed}/${m.total}</td><td ${td}></td><td ${td}></td><td ${td}></td></tr></tbody></table></div>`;
  const text = [head.join(" | "), ...m.rows.map((r) => [r.college, `${r.placed}/${r.total}`, cell(r.tech), cell(r.support), cell(r.nontech)].join(" | "))].join("\n");
  return { subject: `FPC Placement Metrics by College ${longDate(day)}`, html, text, mismatch: m.mismatch };
}

export async function sendSdrDaily(day: string) {
  const b = await buildSdrDaily(day);
  const rec = await getSetting("sdr_report_recipients");
  return queueEmail({ kind: "sdr_daily", to: rec.to, cc: rec.cc, subject: b.subject, html: b.html, text: b.text, dedupeKey: "sdr_daily:" + day });
}
export async function sendFpcWeekly(day: string) {
  const b = await buildFpcWeekly(day);
  const rec = await getSetting("fpc_report_recipients");
  return queueEmail({ kind: "fpc_weekly", to: rec.to, cc: rec.cc, subject: b.subject, html: b.html, text: b.text, dedupeKey: "fpc_weekly:" + day });
}
