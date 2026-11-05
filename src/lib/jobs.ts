import { q } from "./db";
import { istDate, dow } from "./dates";
import { isWorkingDay } from "./metrics";
import { syncAll } from "./sync";
import { zohoConfigured } from "./zoho";
import { scan } from "./hygiene";
import { sendSdrDaily, sendFpcWeekly } from "./reports";
import { commitmentSdrs } from "./team";
import { getSetting, notify, setSetting } from "./settings";
import { queueEmail } from "./mail";
import { fetchSheetXlsx, importWorkbook, type ImportKind } from "./importers";

export type SheetSource = { kind: ImportKind; url: string; tab?: string };
type Job = { name: string; title: string; when: string; description: string; weekdaysOnly?: boolean; run: () => Promise<string> };

async function freshZoho() {
  if (!zohoConfigured()) return "Zoho not connected, used stored data";
  const [s] = await q("select max(last_sync) t from sync_state where entity='deals'");
  if (!s?.t || Date.now() - new Date(s.t).getTime() > 2 * 3600000) return "refreshed: " + (await syncAll(120000));
  return "data fresh";
}

export const JOBS: Job[] = [
  { name: "sync.zoho", title: "Zoho sync", when: "Every 15 minutes", description: "Copies users, accounts, contacts, deals, calls, meetings and commitments from Zoho into the app.",
    run: async () => syncAll() },
  { name: "sync.sheets", title: "Google Sheets import", when: "Hourly", description: "Re-reads the sheets listed in Import > Linked sheets (roster, offers, drives, candidates).",
    run: async () => {
      const src = (await getSetting("sheet_sources" as any)) as unknown as SheetSource[] | undefined;
      const list = Array.isArray(src) ? src : [];
      if (!list.length) return "No linked sheets";
      const out: string[] = [];
      for (const s of list) {
        try { const r = await importWorkbook(s.kind, await fetchSheetXlsx(s.url), s.tab); out.push(`${s.kind}: ${r.saved} saved`); }
        catch (e: any) { out.push(`${s.kind}: FAILED ${e.message}`); }
      }
      return out.join("; ");
    } },
  { name: "commitments.open_day", title: "Open today's commitments", when: "9:30 AM, Mon to Fri", weekdaysOnly: true,
    description: "Creates today's blank commitment for each SDR and posts a reminder. SDRs fill it in the app before the cut-off.",
    run: async () => {
      const day = istDate();
      const sdrs = await commitmentSdrs();
      const kind = dow(day) === 1 ? "Daily + Weekly" : "Daily";
      for (const m of sdrs) await q("insert into commitments(owner_id,day,kind,source) values($1,$2,$3,'app') on conflict(owner_id,day) do nothing", [m.zoho_id, day, kind]);
      await notify("commitments", `Add your commitments for ${day}`, `${sdrs.length} SDRs need to fill today's targets.`, "/my-day");
      return `${sdrs.length} commitments opened`;
    } },
  { name: "hygiene.scan", title: "CRM hygiene scan", when: "9:04 AM daily", description: "Runs the six data-quality checks and updates the issue queue. Nothing is written to Zoho.",
    run: async () => { const z = await freshZoho(); const r = await scan(); return `${z}; ${r.found} issues, ${r.fresh} new, ${r.resolved} resolved`; } },
  { name: "report.sdr_daily", title: "SDR daily report", when: "6:10 PM, Mon to Fri", weekdaysOnly: true, description: "Builds the daily SDR table and emails it to the recipients in Settings.",
    run: async () => { const z = await freshZoho(); const r = await sendSdrDaily(istDate()); return `${z}; email ${r.status}`; } },
  { name: "report.fpc_weekly", title: "FPC weekly report", when: "Saturday 9:00 AM", description: "Placement metrics by college, with the offers sanity check.",
    run: async () => { const r = await sendFpcWeekly(istDate()); return `email ${r.status}`; } },
  { name: "ops.cleanup", title: "Housekeeping", when: "2:30 AM daily", description: "Removes old job logs, read notifications and old email previews.",
    run: async () => {
      await q("delete from job_runs where started_at < now() - interval '60 days'");
      await q("delete from notifications where read and created_at < now() - interval '30 days'");
      await q("delete from email_outbox where status='preview' and created_at < now() - interval '90 days'");
      return "done";
    } },
];

export async function runJob(name: string, by = "schedule") {
  const job = JOBS.find((j) => j.name === name);
  if (!job) throw new Error("Unknown job " + name);
  const [run] = await q("insert into job_runs(job,triggered_by) values($1,$2) returning id", [name, by]);
  try {
    if (job.weekdaysOnly && by === "schedule" && !(await isWorkingDay(istDate()))) {
      await q("update job_runs set status='skipped', finished_at=now(), summary='Not a working day' where id=$1", [run.id]);
      return { status: "skipped", summary: "Not a working day" };
    }
    const summary = await job.run();
    await q("update job_runs set status='ok', finished_at=now(), summary=$2 where id=$1", [run.id, summary.slice(0, 500)]);
    return { status: "ok", summary };
  } catch (e: any) {
    const msg = String(e.message || e).slice(0, 500);
    const soft = /not connected yet/.test(msg);
    await q("update job_runs set status=$3, finished_at=now(), error=$2 where id=$1", [run.id, msg, soft ? "skipped" : "failed"]);
    if (!soft) {
      await notify("failure", `${job.title} failed`, msg, "/automations");
      const admin = await getSetting("admin_email");
      if (admin) await queueEmail({ kind: "alert", to: [admin], subject: `[FPC-MS] ${job.title} failed`, html: `<p>${job.title} failed at ${new Date().toISOString()}:</p><pre>${msg}</pre>`, text: msg, dedupeKey: `fail:${name}:${istDate()}:${Math.floor(Date.now() / 3600000)}` });
    }
    return { status: soft ? "skipped" : "failed", summary: msg };
  }
}
export { setSetting };
