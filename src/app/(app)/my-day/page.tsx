import Link from "next/link";
import { q, one } from "@/lib/db";
import { istDate, addDays, dow, fmtTime, shortDate } from "@/lib/dates";
import { commitmentSdrs } from "@/lib/team";
import { metricsByDay } from "@/lib/metrics";
import { PageHeader, Card, Notice, Table, Badge, Progress, Empty } from "@/components/ui";
import { saveCommitment } from "@/app/actions";

export default async function MyDay({ searchParams }: { searchParams: Promise<{ sdr?: string; day?: string; saved?: string }> }) {
  const sp = await searchParams;
  const today = istDate();
  const day = sp.day || today;
  const sdrs = await commitmentSdrs();
  if (!sdrs.length) return (<><PageHeader title="My Day" /><Notice>No SDRs yet. Connect Zoho under Integrations, or load sample data.</Notice></>);
  const me = sdrs.find((s) => s.zoho_id === sp.sdr) || sdrs[0];
  const c = await one("select * from commitments where owner_id=$1 and day=$2", [me.zoho_id, day]);
  const prev = c ? null : await one("select * from commitments where owner_id=$1 and day<$2 order by day desc limit 1", [me.zoho_id, day]);
  const base = c || prev;
  const actual = (await metricsByDay(day, day)).find((m) => m.owner_id === me.zoho_id);
  const weekly = dow(day) === 1;
  const [untouched, stale, meetings] = await Promise.all([
    q(`select a.zoho_id, a.name, a.modified_time from accounts a where a.owner_id=$1 and a.name not ilike 'DUP -%' and a.modified_time < now() - interval '7 days' order by a.modified_time limit 12`, [me.zoho_id]),
    q(`select zoho_id, name, account_name, stage, modified_time from deals where owner_id=$1 and coalesce(stage,'') !~* '^closed' order by modified_time limit 8`, [me.zoho_id]),
    q(`select title, start_time, check_in_status from events where owner_id=$1 and (start_time at time zone 'Asia/Kolkata')::date between $2 and $3 order by start_time limit 10`, [me.zoho_id, day, addDays(day, 1)]),
  ]);
  const F = (name: string, label: string, val: any, target?: number) => (
    <label className="block text-sm"><span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input className="input" type="number" min={0} name={name} defaultValue={val ?? target ?? ""} required={name !== "ol"} />
    </label>
  );
  return (
    <>
      <PageHeader title="My Day" sub="Enter today's commitments, then work the call list. Pick the SDR until personal sign-in is added." />
      {sp.saved && <Notice tone="good">Commitments saved.</Notice>}
      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted">SDR</span>
          <select name="sdr" defaultValue={me.zoho_id} className="input w-48">{sdrs.map((s) => <option key={s.zoho_id} value={s.zoho_id}>{s.name}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted">Day</span><input type="date" name="day" defaultValue={day} className="input w-44" /></label>
        <button className="btn">Show</button>
      </form>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card title={`Commitments for ${shortDate(day)}`} right={c?.submitted_at ? <Badge tone="good">Saved {fmtTime(c.submitted_at)}</Badge> : <Badge tone="warn">Not entered</Badge>}>
          <form action={saveCommitment} className="grid grid-cols-2 gap-3">
            <input type="hidden" name="owner" value={me.zoho_id} /><input type="hidden" name="day" value={day} /><input type="hidden" name="kind" value={weekly ? "Daily + Weekly" : "Daily"} />
            {F("calls", "Total calls", base?.calls, me.target_calls)}{F("connected", "Calls connected", base?.connected, me.target_connected)}
            {F("ms", "Meetings scheduled", base?.meetings_scheduled, me.target_meetings)}{F("mc", "Meetings to conduct today", base?.meetings_to_conduct, 0)}
            {F("ud", "Upcoming deals today", base?.upcoming_deals, 0)}
            {weekly ? F("ol", "Offer letters committed (week)", base?.offer_letters) : <input type="hidden" name="ol" value={base?.offer_letters ?? ""} />}
            <div className="col-span-2 flex items-center justify-between"><span className="text-xs text-muted">{c ? "Editing saved values." : prev ? "Pre-filled from your last entry." : "Pre-filled from your targets."}{weekly ? " Monday: weekly offer letters included." : ""}</span><button className="btn btn-primary">Save</button></div>
          </form>
        </Card>
        <Card title="Today so far (live from Zoho)">
          {[["Calls", actual?.calls ?? 0, c?.calls ?? me.target_calls], ["Connected", actual?.connected ?? 0, c?.connected ?? me.target_connected], ["Meetings scheduled", actual?.scheduled ?? 0, c?.meetings_scheduled ?? me.target_meetings]].map(([l, v, t]) => (
            <div key={l as string} className="mb-3"><div className="flex justify-between text-sm"><span>{l}</span><span className="tabular-nums font-semibold">{v as number} <span className="font-normal text-muted">of {t as number}</span></span></div><Progress value={v as number} max={t as number} /></div>
          ))}
          <p className="text-xs text-muted">Held: {actual?.held ?? 0}. Deals created: {actual?.deals ?? 0}. Log calls and meetings in Zoho as usual; they appear here after the next sync.</p>
        </Card>
        <Card title="Meetings (today and tomorrow)" pad={false}>
          {meetings.length ? <Table head={["Meeting", "When", "Status"]}>{meetings.map((m, i) => <tr key={i}><td className="td">{m.title}</td><td className="td">{fmtTime(m.start_time)}</td><td className="td">{m.check_in_status === "VISITED" ? <Badge tone="good">Visited</Badge> : <Badge>Planned</Badge>}</td></tr>)}</Table> : <Empty>No meetings in this window.</Empty>}
        </Card>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Accounts untouched for 7+ days" pad={false}>
          {untouched.length ? <Table head={["Account", "Last touched"]}>{untouched.map((a) => <tr key={a.zoho_id}><td className="td"><Link className="text-brand" href={`/accounts/${a.zoho_id}`}>{a.name}</Link></td><td className="td">{fmtTime(a.modified_time)}</td></tr>)}</Table> : <Empty>Every account was touched in the last 7 days.</Empty>}
        </Card>
        <Card title="Open deals waiting longest" pad={false}>
          {stale.length ? <Table head={["Deal", "Stage", "Last update"]}>{stale.map((d) => <tr key={d.zoho_id}><td className="td">{d.name || d.account_name}</td><td className="td">{d.stage}</td><td className="td">{fmtTime(d.modified_time)}</td></tr>)}</Table> : <Empty>No open deals.</Empty>}
        </Card>
      </div>
    </>
  );
}
