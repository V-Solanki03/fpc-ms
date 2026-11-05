import { q, one } from "./db";

export type Recipients = { to: string[]; cc: string[] };
export const DEFAULTS = {
  sdr_report_recipients: { to: [], cc: [] } as Recipients,
  fpc_report_recipients: { to: [], cc: [] } as Recipients,
  admin_email: process.env.ADMIN_EMAIL || "",
  orphan_default_owner_id: "",
  stale_days: 14,
  commitment_cutoff_hour: 11,
  zoho_org_name: "FACE prep",
};
export type SettingKey = keyof typeof DEFAULTS;

export async function getSetting<K extends SettingKey>(key: K): Promise<(typeof DEFAULTS)[K]> {
  const r = await one<{ value: any }>("select value from settings where key=$1", [key]);
  return (r ? r.value : DEFAULTS[key]) as any;
}
export async function setSetting(key: string, value: any) {
  await q("insert into settings(key,value,updated_at) values($1,$2::jsonb,now()) on conflict(key) do update set value=excluded.value, updated_at=now()", [key, JSON.stringify(value)]);
}
export async function audit(actor: string, action: string, entity: string, entityId: string, before: any, after: any) {
  await q("insert into audit_log(actor,action,entity,entity_id,before,after) values($1,$2,$3,$4,$5::jsonb,$6::jsonb)", [actor, action, entity, entityId, JSON.stringify(before ?? null), JSON.stringify(after ?? null)]);
}
export async function notify(kind: string, title: string, body = "", link = "") {
  await q("insert into notifications(kind,title,body,link) values($1,$2,$3,$4)", [kind, title, body, link]);
}
