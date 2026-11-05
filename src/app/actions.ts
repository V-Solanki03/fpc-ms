"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { COOKIE, sessionToken } from "@/lib/auth";
import { q } from "@/lib/db";
import { runJob, type SheetSource } from "@/lib/jobs";
import { approve, reject, scan } from "@/lib/hygiene";
import { importWorkbook, IMPORT_LABEL, type ImportKind, type ImportReport } from "@/lib/importers";
import { clearDemo, seedDemo } from "@/lib/demo";
import { audit, getSetting, setSetting } from "@/lib/settings";
import { deliver } from "@/lib/mail";
import { summariseDay } from "@/lib/ai";
import { istDate } from "@/lib/dates";

const ACTOR = "team"; // replaced by the signed-in person once Google sign-in exists
const num = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(v));
const list = (v: FormDataEntryValue | null) => String(v || "").split(/[\s,;]+/).map((s) => s.trim()).filter((s) => /@/.test(s));

export async function login(fd: FormData) {
  const pw = String(fd.get("password") || "");
  const expected = process.env.APP_PASSWORD || "";
  const a = Buffer.from(pw), b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !crypto.timingSafeEqual(a, b)) redirect("/login?e=1");
  (await cookies()).set(COOKIE, await sessionToken(), { httpOnly: true, sameSite: "lax", secure: !!process.env.VERCEL, maxAge: 60 * 60 * 24 * 30, path: "/" });
  redirect("/");
}

export async function saveCommitment(fd: FormData) {
  const owner = String(fd.get("owner")), day = String(fd.get("day"));
  await q(
    `insert into commitments(owner_id,day,calls,connected,meetings_scheduled,meetings_to_conduct,upcoming_deals,offer_letters,kind,source,submitted_at,updated_at)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,'app',now(),now())
     on conflict(owner_id,day) do update set calls=excluded.calls, connected=excluded.connected, meetings_scheduled=excluded.meetings_scheduled,
       meetings_to_conduct=excluded.meetings_to_conduct, upcoming_deals=excluded.upcoming_deals, offer_letters=excluded.offer_letters, source='app', submitted_at=now(), updated_at=now()`,
    [owner, day, num(fd.get("calls")), num(fd.get("connected")), num(fd.get("ms")), num(fd.get("mc")), num(fd.get("ud")), num(fd.get("ol")), String(fd.get("kind") || "Daily")]);
  revalidatePath("/my-day");
  redirect(`/my-day?sdr=${owner}&day=${day}&saved=1`);
}

export async function runJobAction(fd: FormData) { await runJob(String(fd.get("job")), "manual"); revalidatePath("/automations"); revalidatePath("/sync"); }
export async function syncNow() { await runJob("sync.zoho", "manual"); revalidatePath("/sync"); }
export async function hygieneScan() { await runJob("hygiene.scan", "manual"); revalidatePath("/hygiene"); }
export async function hygieneApprove(fd: FormData) {
  const id = Number(fd.get("id"));
  let note = "";
  try { note = await approve(id, ACTOR); } catch (e: any) { note = "Failed: " + e.message; }
  revalidatePath("/hygiene"); redirect(`/hygiene?kind=${fd.get("kind") || "all"}&note=${encodeURIComponent(note)}`);
}
export async function hygieneReject(fd: FormData) { await reject(Number(fd.get("id")), ACTOR); revalidatePath("/hygiene"); }

export async function sendOutbox(fd: FormData) {
  let msg = "Sent";
  try { await deliver(Number(fd.get("id"))); } catch (e: any) { msg = e.message; }
  revalidatePath("/reports"); redirect(`/reports?msg=${encodeURIComponent(msg)}`);
}
export async function buildReport(fd: FormData) {
  const { sendSdrDaily, sendFpcWeekly } = await import("@/lib/reports");
  const day = String(fd.get("day") || istDate());
  if (fd.get("kind") === "fpc") await sendFpcWeekly(day + "-manual-" + Date.now()); else await sendSdrDaily(day);
  revalidatePath("/reports");
}

export async function loadDemoAction() { await seedDemo(); revalidatePath("/", "layout"); }
export async function clearDemoAction() { await clearDemo(); revalidatePath("/", "layout"); }

export async function saveMember(fd: FormData) {
  const id = String(fd.get("id"));
  await q("update team_members set is_sdr=$2, in_reports=$3, in_commitments=$4, target_calls=$5, target_connected=$6, target_meetings=$7 where zoho_id=$1",
    [id, fd.get("is_sdr") === "on", fd.get("in_reports") === "on", fd.get("in_commitments") === "on", num(fd.get("tc")) ?? 60, num(fd.get("tk")) ?? 15, num(fd.get("tm")) ?? 2]);
  await audit(ACTOR, "update_member", "team_members", id, null, Object.fromEntries(fd.entries()));
  revalidatePath("/settings");
}
export async function saveSettings(fd: FormData) {
  await setSetting("sdr_report_recipients", { to: list(fd.get("sdr_to")), cc: list(fd.get("sdr_cc")) });
  await setSetting("fpc_report_recipients", { to: list(fd.get("fpc_to")), cc: list(fd.get("fpc_cc")) });
  await setSetting("admin_email", String(fd.get("admin_email") || "").trim());
  await setSetting("orphan_default_owner_id", String(fd.get("orphan") || ""));
  await setSetting("stale_days", Number(fd.get("stale")) || 14);
  revalidatePath("/settings");
}
export async function addHoliday(fd: FormData) {
  const day = String(fd.get("day") || ""); if (!day) return;
  await q("insert into holidays(day,name) values($1,$2) on conflict(day) do update set name=excluded.name", [day, String(fd.get("name") || "Holiday")]);
  revalidatePath("/settings");
}
export async function removeHoliday(fd: FormData) { await q("delete from holidays where day=$1", [String(fd.get("day"))]); revalidatePath("/settings"); }

export async function uploadImport(_prev: ImportReport | { error: string } | null, fd: FormData): Promise<ImportReport | { error: string }> {
  try {
    const file = fd.get("file") as File | null; const kind = String(fd.get("kind")) as ImportKind;
    if (!file || !file.size) return { error: "Choose a file first." };
    if (!(kind in IMPORT_LABEL)) return { error: "Choose what the file contains." };
    const rep = await importWorkbook(kind, Buffer.from(await file.arrayBuffer()), String(fd.get("tab") || "") || undefined);
    await audit(ACTOR, "import_" + kind, "import", file.name, null, { saved: rep.saved, rows: rep.rows });
    revalidatePath("/", "layout");
    return rep;
  } catch (e: any) { return { error: e.message }; }
}
export async function saveSheetSources(fd: FormData) {
  const kinds = fd.getAll("kind").map(String), urls = fd.getAll("url").map(String), tabs = fd.getAll("tab").map(String);
  const src: SheetSource[] = kinds.map((k, i) => ({ kind: k as ImportKind, url: urls[i].trim(), tab: tabs[i].trim() || undefined })).filter((s) => s.url);
  await setSetting("sheet_sources", src);
  revalidatePath("/import");
}

export async function aiSummary() {
  const day = istDate();
  try { await setSetting("ai_summary", { day, text: await summariseDay(day), at: new Date().toISOString() }); }
  catch (e: any) { await setSetting("ai_summary", { day, error: e.message, at: new Date().toISOString() }); }
  revalidatePath("/");
}

export async function createPack(fd: FormData) {
  const token = crypto.randomBytes(16).toString("hex");
  const days = Number(fd.get("days")) || 14;
  const [p] = await q("insert into profile_packs(title,company,share_token,expires_at,created_by) values($1,$2,$3,now() + ($4 || ' days')::interval,$5) returning id",
    [String(fd.get("title") || "Profile pack"), String(fd.get("company") || ""), token, String(days), ACTOR]);
  redirect(`/packs/${p.id}`);
}
export async function packAdd(fd: FormData) {
  const pack = Number(fd.get("pack")); const ids = fd.getAll("cid").map(Number).filter(Boolean);
  for (const id of ids) await q("insert into pack_items(pack_id,candidate_id) values($1,$2) on conflict do nothing", [pack, id]);
  revalidatePath(`/packs/${pack}`); redirect(`/packs/${pack}`);
}
export async function packRemove(fd: FormData) { await q("delete from pack_items where pack_id=$1 and candidate_id=$2", [Number(fd.get("pack")), Number(fd.get("cid"))]); revalidatePath(`/packs/${fd.get("pack")}`); }
export async function packStatus(fd: FormData) { await q("update profile_packs set status=$2 where id=$1", [Number(fd.get("pack")), String(fd.get("status"))]); revalidatePath(`/packs/${fd.get("pack")}`); }
export async function setConsent(fd: FormData) { await q("update candidates set consent=$2 where id=$1", [Number(fd.get("id")), fd.get("consent") === "1"]); revalidatePath("/candidates"); }
