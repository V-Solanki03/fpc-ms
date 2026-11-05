import { q } from "@/lib/db";
import { allMembers } from "@/lib/team";
import { getSetting } from "@/lib/settings";
import { DEFINITIONS } from "@/lib/metrics";
import { PageHeader, Card, Table, Badge } from "@/components/ui";
import { saveMember, saveSettings, addHoliday, removeHoliday } from "@/app/actions";

export default async function Settings() {
  const [members, sdr, fpc, admin, orphan, stale, holidays] = await Promise.all([
    allMembers(), getSetting("sdr_report_recipients"), getSetting("fpc_report_recipients"), getSetting("admin_email"), getSetting("orphan_default_owner_id"), getSetting("stale_days"),
    q("select day::text d, name from holidays order by day"),
  ]);
  const join = (a: string[]) => a.join(", ");
  return (
    <>
      <PageHeader title="Settings" sub="Team, targets, report recipients and the written definition of every number." />
      <Card title="Team and targets" pad={false} className="mb-5">
        <p className="px-4 pt-3 text-xs text-muted">Users come from Zoho. Tick <b>SDR</b> for people who make calls. Untick <b>In reports</b> to leave someone out of the daily email and scoreboard (for example a person who should not be reported on). Targets are per working day.</p>
        <Table head={["Name", "Zoho role", "SDR", "In reports", "In commitments", "Calls", "Connected", "Meetings", ""]} empty={members.length ? undefined : "No users yet. They appear after the first Zoho sync, or load sample data."}>
          {members.map((m) => (
            <tr key={m.zoho_id} className={m.active ? "" : "opacity-60"}>
              <td className="td font-medium" colSpan={1}>{m.name} {!m.active && <Badge tone="bad">inactive</Badge>}</td><td className="td text-xs text-muted">{m.zoho_role || "—"}</td>
              <td className="td" colSpan={7}>
                <form action={saveMember} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="id" value={m.zoho_id} />
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="is_sdr" defaultChecked={m.is_sdr} /> SDR</label>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="in_reports" defaultChecked={m.in_reports} /> In reports</label>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="in_commitments" defaultChecked={m.in_commitments} /> Commitments</label>
                  <input className="input w-16" type="number" name="tc" defaultValue={m.target_calls} aria-label="Calls target" /><input className="input w-16" type="number" name="tk" defaultValue={m.target_connected} aria-label="Connected target" /><input className="input w-16" type="number" name="tm" defaultValue={m.target_meetings} aria-label="Meetings target" />
                  <button className="btn text-xs">Save</button>
                </form>
              </td><td className="td" />
            </tr>
          ))}
        </Table>
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Reports and rules">
          <form action={saveSettings} className="space-y-3 text-sm">
            {[["sdr_to", "SDR daily: to", join(sdr.to)], ["sdr_cc", "SDR daily: cc", join(sdr.cc)], ["fpc_to", "FPC weekly: to", join(fpc.to)], ["fpc_cc", "FPC weekly: cc", join(fpc.cc)]].map(([n, l, v]) => (
              <label key={n} className="block"><span className="mb-1 block text-xs font-medium text-muted">{l} (separate with commas)</span><textarea className="input" rows={2} name={n} defaultValue={v} /></label>
            ))}
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Admin email (failure alerts)</span><input className="input" name="admin_email" defaultValue={admin} /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Default owner for orphaned records</span>
              <select className="input" name="orphan" defaultValue={orphan}><option value="">None (fix by hand)</option>{members.filter((m) => m.active).map((m) => <option key={m.zoho_id} value={m.zoho_id}>{m.name}</option>)}</select></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Days without an update before a deal is stale</span><input className="input w-24" type="number" name="stale" defaultValue={stale} min={3} /></label>
            <button className="btn btn-primary">Save settings</button>
          </form>
        </Card>
        <div className="space-y-5">
          <Card title="Holidays (not counted as working days)">
            <form action={addHoliday} className="mb-3 flex gap-2"><input className="input w-40" type="date" name="day" required aria-label="Date" /><input className="input" name="name" placeholder="Name" aria-label="Name" /><button className="btn">Add</button></form>
            <ul className="space-y-1 text-sm">{holidays.map((h) => <li key={h.d} className="flex justify-between"><span>{h.d} · {h.name}</span><form action={removeHoliday}><input type="hidden" name="day" value={h.d} /><button className="text-xs text-bad">Remove</button></form></li>)}{!holidays.length && <li className="text-muted">None added.</li>}</ul>
          </Card>
          <Card title="How each number is counted">
            <dl className="space-y-2 text-sm">{DEFINITIONS.map((d) => <div key={d.name}><dt className="font-semibold">{d.name}</dt><dd className="text-muted">{d.rule}</dd></div>)}</dl>
          </Card>
        </div>
      </div>
    </>
  );
}
