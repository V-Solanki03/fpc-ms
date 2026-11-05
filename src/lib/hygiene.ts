import { q } from "./db";
import { audit, getSetting } from "./settings";
import { updateRecords, zohoWriteEnabled } from "./zoho";
import { nameMap } from "./team";

type Issue = { kind: string; key: string; entity: string; owner_id: string | null; summary: string; detail?: any; fix?: any };
export const KIND_LABEL: Record<string, string> = {
  dup_account: "Duplicate account with deals", stale_deal: "Stale open deal", contradictory_call: "Contradictory call outcome",
  orphan: "Records owned by an inactive user", silent_sdr: "Silent SDR", dup_deal: "Duplicate open deals",
};

export async function detect(): Promise<Issue[]> {
  const out: Issue[] = [];
  const names = await nameMap();
  const nm = (id: string | null) => (id ? names.get(id) || id : "Unassigned");
  const staleDays = await getSetting("stale_days");

  for (const r of await q(`select a.zoho_id, a.name, a.owner_id, count(d.zoho_id)::int deals from accounts a join deals d on d.account_id=a.zoho_id where a.name ilike 'DUP -%' group by 1,2,3`))
    out.push({ kind: "dup_account", key: "dup_account:" + r.zoho_id, entity: "Accounts", owner_id: r.owner_id, summary: `${r.name} still has ${r.deals} deal(s) attached`, detail: r, fix: { type: "manual", note: "Merge into the original account in Zoho, then delete the DUP record." } });

  for (const r of await q(`select zoho_id, name, account_name, owner_id, stage, modified_time, (current_date - modified_time::date)::int age from deals
      where coalesce(stage,'') !~* '^closed' and modified_time < now() - ($1 || ' days')::interval order by modified_time limit 500`, [String(staleDays)]))
    out.push({ kind: "stale_deal", key: "stale_deal:" + r.zoho_id, entity: "Deals", owner_id: r.owner_id, summary: `${r.name || r.account_name} untouched for ${r.age} days (${r.stage})`, detail: r, fix: { type: "nudge", note: "Owner to update or close the deal." } });

  for (const r of await q(`select owner_id, count(*)::int c from calls where connected and result ilike 'invalid number' group by 1`))
    out.push({ kind: "contradictory_call", key: "contradictory_call:" + r.owner_id, entity: "Calls", owner_id: r.owner_id, summary: `${nm(r.owner_id)} has ${r.c} calls marked Invalid number but also Connected`, detail: r, fix: { type: "manual", note: "Set Call_Connected to No, or fix the result." } });

  const def = await getSetting("orphan_default_owner_id");
  for (const ent of [["accounts", "Accounts"], ["deals", "Deals"], ["contacts", "Contacts"]] as const) {
    for (const r of await q(`select t.owner_id, count(*)::int c from ${ent[0]} t left join team_members m on m.zoho_id=t.owner_id where t.owner_id is not null and (m.zoho_id is null or not m.active) group by 1`))
      out.push({ kind: "orphan", key: `orphan:${ent[0]}:${r.owner_id}`, entity: ent[1], owner_id: r.owner_id, summary: `${r.c} ${ent[1].toLowerCase()} owned by ${nm(r.owner_id)} (inactive or unknown)`, detail: r, fix: def ? { type: "reassign_owner", module: ent[1], table: ent[0], from: r.owner_id, to: def, toName: nm(def) } : { type: "manual", note: "Choose a default owner in Settings to enable one-click reassignment." } });
  }

  for (const r of await q(`select m.zoho_id, m.name from team_members m where m.active and m.is_sdr and m.in_reports
      and not exists (select 1 from calls c where c.owner_id=m.zoho_id and c.start_time > now() - interval '7 days')
      and not exists (select 1 from events e where e.owner_id=m.zoho_id and (e.created_time > now() - interval '7 days'))
      and not exists (select 1 from deals d where d.owner_id=m.zoho_id and d.modified_time > now() - interval '7 days')`))
    out.push({ kind: "silent_sdr", key: "silent_sdr:" + r.zoho_id, entity: "Team", owner_id: r.zoho_id, summary: `${r.name} has logged no calls, meetings or deal updates in 7 days`, fix: { type: "nudge", note: "Manager to check in." } });

  for (const r of await q(`select d.account_id, a.name acc, min(lower(coalesce(d.name,''))) nm, count(*)::int c, array_agg(d.zoho_id) ids, min(d.owner_id) owner_id
      from deals d left join accounts a on a.zoho_id=d.account_id where coalesce(d.stage,'') !~* '^closed' and d.account_id is not null
      group by d.account_id, a.name, regexp_replace(lower(coalesce(d.name,'')), '[^a-z0-9]+', '', 'g') having count(*)>1`))
    out.push({ kind: "dup_deal", key: `dup_deal:${r.account_id}:${r.nm}`, entity: "Deals", owner_id: r.owner_id, summary: `${r.c} open deals named like "${r.nm}" on ${r.acc || r.account_id}`, detail: r, fix: { type: "manual", note: "Keep one deal and close or merge the rest." } });
  return out;
}

export async function scan() {
  const issues = await detect();
  const seen = new Set<string>();
  let fresh = 0;
  for (const i of issues) {
    seen.add(i.key);
    const r = await q(
      `insert into hygiene_issues(kind,key,entity,owner_id,summary,detail,fix) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
       on conflict(key) do update set summary=excluded.summary, detail=excluded.detail, fix=excluded.fix, last_seen=now(),
         status=case when hygiene_issues.status='resolved' then 'open' else hygiene_issues.status end,
         resolved_at=case when hygiene_issues.status='resolved' then null else hygiene_issues.resolved_at end
       returning (xmax = 0) as inserted`,
      [i.kind, i.key, i.entity, i.owner_id, i.summary, JSON.stringify(i.detail ?? null), JSON.stringify(i.fix ?? null)]
    );
    if (r[0]?.inserted) fresh++;
  }
  const open = await q("select key from hygiene_issues where status in ('open','approved')");
  let resolved = 0;
  for (const o of open) if (!seen.has(o.key)) { await q("update hygiene_issues set status='resolved', resolved_at=now() where key=$1", [o.key]); resolved++; }
  return { found: issues.length, fresh, resolved };
}

/** Approve a fix. Only owner reassignments can be written to Zoho, and only when writes are enabled. */
export async function approve(id: number, actor: string) {
  const [iss] = await q("select * from hygiene_issues where id=$1", [id]);
  if (!iss) throw new Error("Issue not found");
  const fix = iss.fix || {};
  let note = "Marked as approved. Fix it in Zoho, the next scan will close it.";
  if (fix.type === "reassign_owner") {
    if (!zohoWriteEnabled()) note = "Approved, but writes to Zoho are switched off. Set ZOHO_WRITE_ENABLED=true to apply.";
    else {
      const ids = (await q(`select zoho_id from ${fix.table} where owner_id=$1`, [fix.from])).map((r) => ({ id: r.zoho_id as string, Owner: { id: fix.to as string } }));
      const res = await updateRecords(fix.module, ids);
      const ok = res.filter((r) => r.code === "SUCCESS").length;
      await q(`update ${fix.table} set owner_id=$1 where owner_id=$2`, [fix.to, fix.from]);
      note = `Reassigned ${ok} of ${ids.length} ${fix.module.toLowerCase()} to ${fix.toName}.`;
      await audit(actor, "reassign_owner", fix.module, String(fix.from), { owner: fix.from, count: ids.length }, { owner: fix.to, ok });
    }
  }
  await q("update hygiene_issues set status='approved', decided_by=$2, decided_at=now() where id=$1", [id, actor]);
  return note;
}
export async function reject(id: number, actor: string) {
  await q("update hygiene_issues set status='dismissed', decided_by=$2, decided_at=now() where id=$1", [id, actor]);
  await audit(actor, "dismiss_issue", "hygiene", String(id), null, null);
}
