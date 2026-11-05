import { q } from "./db";

export type Member = {
  zoho_id: string; name: string; email: string | null; zoho_role: string | null; active: boolean; is_sdr: boolean;
  in_reports: boolean; in_commitments: boolean; target_calls: number; target_connected: number; target_meetings: number; source: string;
};
export const allMembers = () => q<Member>("select * from team_members order by active desc, is_sdr desc, name");
export const reportSdrs = () => q<Member>("select * from team_members where active and is_sdr and in_reports order by name");
export const commitmentSdrs = () => q<Member>("select * from team_members where active and is_sdr and in_commitments order by name");
export async function nameMap() {
  const m = new Map<string, string>();
  for (const r of await q<{ zoho_id: string; name: string }>("select zoho_id,name from team_members")) m.set(r.zoho_id, r.name);
  return m;
}
/** Zoho roles that count as SDRs. 'ER Associate' is the current one. */
export const SDR_ROLE = /er associate/i;
