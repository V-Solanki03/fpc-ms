import Link from "next/link";
import { q } from "@/lib/db";
import { driveStats } from "@/lib/placement";
import { PageHeader, Card, Table, Badge, Stat, Tabs } from "@/components/ui";
import { BarsChart } from "@/components/charts";
import { pct } from "@/lib/util";

export default async function Drives({ searchParams }: { searchParams: Promise<{ r?: string; s?: string }> }) {
  const { r = "all", s = "" } = await searchParams;
  const [st, rows, loss, byTeam] = await Promise.all([
    driveStats(),
    q(`select id, drive_date::text d, company, sdr, result, owner_team, loss_category, location, ctc, openings, offers, joined from drives
       where ($1='all' or lower(result)=$1) and ($2='' or company ilike '%'||$2||'%') order by drive_date desc limit 300`, [r, s]),
    q(`select coalesce(loss_category,'—') k, count(*)::int c from drives where result='Lost' group by 1 order by 2 desc`),
    q(`select coalesce(owner_team,'—') k, count(*)::int c from drives where result='Lost' group by 1 order by 2 desc`),
  ]);
  const tone = (x: string) => (x === "Won" ? "good" : x === "Lost" ? "bad" : "brand");
  return (
    <>
      <PageHeader title="Campus drives" sub="Every company drive from first contact to offers and joining. Load the tracker from Import data; reasons are classified from the feedback text and can be reviewed." actions={<Link className="btn" href="/api/export/drives">Download CSV</Link>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Drives" value={st.drives} /><Stat label="Won" value={st.won} tone="good" sub={`${pct(st.won, st.drives)}% of drives`} /><Stat label="Lost" value={st.lost} tone="bad" />
        <Stat label="Open" value={st.open} /><Stat label="Offers" value={st.offers} /><Stat label="Joined" value={st.joined} sub={`${pct(st.joined, st.offers)}% of offers`} />
      </div>
      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <Card title="Why drives were lost (category)"><BarsChart data={loss.map((x) => ({ label: x.k, Drives: x.c }))} bars={[{ key: "Drives", label: "Drives", color: "#d0503a" }]} /></Card>
        <Card title="Who owns the loss"><BarsChart data={byTeam.map((x) => ({ label: x.k, Drives: x.c }))} bars={[{ key: "Drives", label: "Drives", color: "#2f6fd0" }]} /></Card>
      </div>
      <Tabs current={r} items={[["all", "All"], ["won", "Won"], ["lost", "Lost"], ["open", "Open"]].map(([k, l]) => ({ key: k, label: l, href: `/drives?r=${k}` }))} />
      <form className="mb-3" method="get"><input type="hidden" name="r" value={r} /><input className="input max-w-xs" name="s" defaultValue={s} placeholder="Search company" aria-label="Search company" /></form>
      <Card pad={false}>
        <Table head={["Date", "Company", "SDR", "Result", "Owner team", "Reason", "Openings", "Offers", "Joined"]} empty={rows.length ? undefined : "No drives yet. Use Import data to load the Campus Drive Tracker."}>
          {rows.map((x) => (
            <tr key={x.id}>
              <td className="td whitespace-nowrap">{x.d}</td><td className="td"><Link className="font-medium text-brand" href={`/drives/${x.id}`}>{x.company}</Link></td><td className="td">{x.sdr}</td>
              <td className="td"><Badge tone={tone(x.result)}>{x.result}</Badge></td><td className="td">{x.owner_team || "—"}</td><td className="td">{x.loss_category || "—"}</td>
              <td className="td num">{x.openings}</td><td className="td num">{x.offers}</td><td className="td num">{x.joined}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
