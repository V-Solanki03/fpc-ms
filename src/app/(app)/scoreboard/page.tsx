import Link from "next/link";
import { rangeFor, istDate, addDays, shortDate, type Period } from "@/lib/dates";
import { scoreboard, trend } from "@/lib/metrics";
import { PageHeader, Card, Table, Tabs, Progress, Badge, Stat } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import { SERIES } from "@/components/data";
import { pct } from "@/lib/util";

export default async function Scoreboard({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const p = ((await searchParams).p || "today") as Period;
  const today = istDate();
  const r = rangeFor(p, today);
  const [sb, tr] = await Promise.all([scoreboard(r.from, r.to), trend(p === "today" || p === "yesterday" ? addDays(today, -13) : r.from, r.to === r.from ? today : r.to)]);
  const t = sb.total;
  const funnel = [["Calls", t.calls], ["Connected", t.connected], ["Meetings scheduled", t.scheduled], ["Meetings held", t.held], ["Deals created", t.deals], ["Offers", t.offers]] as [string, number][];
  return (
    <>
      <PageHeader title="Scoreboard" sub={`${r.label}: ${shortDate(r.from)}${r.from !== r.to ? " to " + shortDate(r.to) : ""}. ${sb.workingDays} working day(s). Targets scale with working days.`}
        actions={<Link className="btn" href={`/api/export/scoreboard?p=${p}`}>Download CSV</Link>} />
      <Tabs current={p} items={[["today", "Today"], ["yesterday", "Yesterday"], ["week", "This week"], ["month", "This month"], ["30d", "Last 30 days"]].map(([k, l]) => ({ key: k, label: l, href: `/scoreboard?p=${k}` }))} />
      <Card title="Leaderboard" pad={false}>
        <Table head={["#", "SDR", "Calls", "Committed", "Target", "Connected", "Connect %", "Scheduled", "Held", "Deals", "Offers"]} empty={sb.rows.length ? undefined : "No SDRs found. Connect Zoho or load sample data under Integrations."}>
          {sb.rows.map((x) => (
            <tr key={x.member.zoho_id}>
              <td className="td num">{x.rank}</td><td className="td font-medium">{x.member.name}</td>
              <td className="td num">{x.calls}<div className="mt-1"><Progress value={x.calls} max={x.target_calls} /></div></td>
              <td className="td num text-muted">{x.commit_calls || "—"}</td><td className="td num text-muted">{x.target_calls}</td>
              <td className="td num">{x.connected}</td><td className="td num">{x.connect_rate}%</td>
              <td className="td num">{x.scheduled}</td><td className="td num">{x.held}</td><td className="td num">{x.deals}</td><td className="td num">{x.offers}</td>
            </tr>
          ))}
          {sb.rows.length > 0 && <tr className="font-semibold"><td className="td" /><td className="td">Total</td><td className="td num">{t.calls}</td><td className="td" /><td className="td num">{sb.rows.reduce((a, x) => a + x.target_calls, 0)}</td><td className="td num">{t.connected}</td><td className="td num">{pct(t.connected, t.calls)}%</td><td className="td num">{t.scheduled}</td><td className="td num">{t.held}</td><td className="td num">{t.deals}</td><td className="td num">{t.offers}</td></tr>}
        </Table>
      </Card>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="Funnel" className="xl:col-span-1">
          <div className="space-y-3">{funnel.map(([l, v], i) => (
            <div key={l}><div className="flex justify-between text-sm"><span>{l}</span><span className="tabular-nums font-semibold">{v}{i > 0 && i <= 3 && funnel[i - 1][1] ? <span className="ml-2 text-xs font-normal text-muted">{pct(v, funnel[i - 1][1])}% of previous</span> : null}</span></div>
              <div className="mt-1 h-2 rounded-full bg-soft"><div className="h-2 rounded-full bg-brand" style={{ width: `${funnel[0][1] ? Math.max(2, Math.round((v / funnel[0][1]) * 100)) : 0}%` }} /></div></div>
          ))}</div>
          <p className="mt-3 text-xs text-muted">Bars are scaled to total calls. Offers and deals are counted by their own dates, so the funnel is a guide and not a strict cohort.</p>
        </Card>
        <Card title="Trend" className="xl:col-span-2">
          <TrendChart data={tr.map((d) => ({ ...d, label: shortDate(d.day) }))} lines={[{ key: "calls", label: "Calls", color: SERIES.calls }, { key: "connected", label: "Connected", color: SERIES.connected }, { key: "scheduled", label: "Meetings scheduled", color: SERIES.scheduled }, { key: "held", label: "Meetings held", color: SERIES.held }]} />
        </Card>
      </div>
    </>
  );
}
