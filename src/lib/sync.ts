import { q, upsertMany } from "./db";
import { ENTITIES, type EntityName, COMMITMENT_FIELDS, mapCommitment, mapUser } from "./zoho-map";
import { recordPages, listUsers, verifyOrg, zohoConfigured } from "./zoho";
import { SDR_ROLE } from "./team";
import { istDate, addDays } from "./dates";

async function setState(entity: string, patch: { cursor?: string | null; count?: number; error?: string | null; ms?: number }) {
  await q(
    `insert into sync_state(entity,cursor,last_sync,record_count,last_error,last_duration_ms) values($1,$2,now(),$3,$4,$5)
     on conflict(entity) do update set cursor=coalesce($2,sync_state.cursor), last_sync=now(),
       record_count=sync_state.record_count+$3, last_error=$4, last_duration_ms=$5`,
    [entity, patch.cursor ?? null, patch.count ?? 0, patch.error ?? null, patch.ms ?? null]
  );
}

export async function syncUsers() {
  const users = await listUsers();
  const rows = users.map(mapUser).map((u) => [u.zoho_id, u.name, u.email, u.role, u.active, !!(u.role && SDR_ROLE.test(u.role)), "zoho"]);
  // Keep local settings (targets, in_reports) when a user already exists.
  await upsertMany("team_members", ["zoho_id", "name", "email", "zoho_role", "active", "is_sdr", "source"], rows, "zoho_id", { skipUpdate: ["is_sdr"] });
  // New users get is_sdr from role the first time; later edits in Settings are kept.
  await setState("users", { count: 0, error: null });
  return rows.length;
}

export async function syncEntity(name: EntityName, budgetMs = 40000) {
  const e = ENTITIES[name];
  const t0 = Date.now();
  const st = (await q("select cursor from sync_state where entity=$1", [name]))[0];
  const since = st?.cursor || (e.sinceDays ? new Date(Date.now() - e.sinceDays * 86400000).toISOString().replace(/\.\d+Z$/, "+00:00") : undefined);
  let cursor: string | undefined = st?.cursor || undefined;
  let count = 0;
  try {
    for await (const page of recordPages(e.module, [...e.fields], since, 25)) {
      const rows = page.data.map((r: any) => (e.map as any)(r));
      await upsertMany(e.table, [...e.cols], rows, "zoho_id");
      count += rows.length;
      const last = page.data[page.data.length - 1]?.Modified_Time;
      if (last) cursor = last;
      if (Date.now() - t0 > budgetMs) break;
    }
    await setState(name, { cursor: cursor ?? null, count, error: null, ms: Date.now() - t0 });
    return count;
  } catch (err: any) {
    await setState(name, { count, error: String(err.message || err).slice(0, 500), ms: Date.now() - t0 });
    throw err;
  }
}

/** Pull the existing Zoho Commitments module so history carries over. App-entered rows are never overwritten. */
export async function syncCommitments(budgetMs = 20000) {
  const t0 = Date.now();
  let count = 0;
  try {
    const since = new Date(Date.now() - 60 * 86400000).toISOString().replace(/\.\d+Z$/, "+00:00");
    for await (const page of recordPages("SDR_Commitments", COMMITMENT_FIELDS, since, 5)) {
      const rows = page.data.map(mapCommitment).filter((r: any[]) => r[0] && r[1]);
      for (const r of rows) {
        await q(
          `insert into commitments(owner_id,day,calls,connected,meetings_scheduled,meetings_to_conduct,upcoming_deals,offer_letters,kind,source)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           on conflict(owner_id,day) do update set calls=excluded.calls, connected=excluded.connected, meetings_scheduled=excluded.meetings_scheduled,
             meetings_to_conduct=excluded.meetings_to_conduct, upcoming_deals=excluded.upcoming_deals, offer_letters=excluded.offer_letters, kind=excluded.kind
           where commitments.source='zoho'`, r);
      }
      count += rows.length;
      if (Date.now() - t0 > budgetMs) break;
    }
    await setState("commitments", { count, error: null, ms: Date.now() - t0 });
  } catch (err: any) {
    await setState("commitments", { error: String(err.message || err).slice(0, 500), ms: Date.now() - t0 });
    // The Commitments module is optional; other syncs carry on.
  }
  return count;
}

export async function syncAll(totalBudgetMs = 45000) {
  if (!zohoConfigured()) throw new Error("Zoho is not connected yet. Add the ZOHO_* settings in Vercel and redeploy.");
  const t0 = Date.now();
  const org = await verifyOrg();
  const summary: string[] = [`org ${org.name}`];
  summary.push(`users ${await syncUsers()}`);
  const order: EntityName[] = ["accounts", "contacts", "deals", "calls", "events"];
  for (const name of order) {
    const left = totalBudgetMs - (Date.now() - t0);
    if (left < 8000) { summary.push(`${name} skipped (time)`); continue; }
    try { summary.push(`${name} ${await syncEntity(name, Math.min(left - 4000, 60000))}`); }
    catch (e: any) { summary.push(`${name} FAILED: ${e.message}`); }
  }
  summary.push(`commitments ${await syncCommitments()}`);
  return summary.join(", ");
}
