import Link from "next/link";
import { q } from "@/lib/db";
import { fpcMetrics } from "@/lib/placement";
import { PageHeader, Card, Table, Stat, Notice, Badge, Tabs } from "@/components/ui";
import { pct } from "@/lib/util";

export default async function Placement({ searchParams }: { searchParams: Promise<{ st?: string }> }) {
  const { st = "all" } = await searchParams;
  const m = await fpcMetrics();
  const cell = (p: [number, number]) => (p[1] ? <>{p[0]}/{p[1]} <span className="text-xs text-muted">{pct(p[0], p[1])}%</span></> : <span className="text-muted">-</span>);
  const statuses = await q("select status, count(*)::int c from offers group by 1 order by 2 desc");
  const offers = await q(`select student_name, college, company, role, status, join_date::text jd from offers where ($1='all' or status=$1) order by join_date nulls last, company limit 200`, [st === "all" ? "all" : st]);
  return (
    <>
      <PageHeader title="FPC placement" sub="Final-year campus placements by college. Placed means a row exists in the Offers data. The roster's own PLACED column and PREFERENCE CATEGORY are ignored." actions={<Link className="btn" href="/api/export/offers">Download offers CSV</Link>} />
      {m.mismatch > 2 && <Notice tone="bad"><b>Check the data.</b> {m.placed} students matched as placed, but the Offers data has {m.distinctOfferStudents} distinct students. A gap of {m.mismatch} usually means emails differ between sheets.</Notice>}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Students" value={m.total} /><Stat label="Placed" value={m.placed} tone="good" sub={`${pct(m.placed, m.total)}%`} /><Stat label="Offer rows" value={m.offerRows} /><Stat label="Colleges" value={m.rows.length} /></div>
      <Card title="FPC placement metrics by college" pad={false} className="mb-5">
        <Table head={["College", "Total", "Placed", "Technical", "Tech Support", "Non-Tech"]} empty={m.rows.length ? undefined : "No students yet. Use Import data to load the roster and offers."}>
          {m.rows.map((r) => <tr key={r.college}><td className="td font-medium">{r.college}</td><td className="td num">{r.total}</td><td className="td num">{r.placed} <span className="text-xs text-muted">{pct(r.placed, r.total)}%</span></td><td className="td num">{cell(r.tech)}</td><td className="td num">{cell(r.support)}</td><td className="td num">{cell(r.nontech)}</td></tr>)}
          {m.rows.length > 0 && <tr className="font-semibold"><td className="td">Total</td><td className="td num">{m.total}</td><td className="td num">{m.placed}</td><td className="td" /><td className="td" /><td className="td" /></tr>}
        </Table>
      </Card>
      <Card title="Offers and joining" pad={false}>
        <div className="p-3"><Tabs current={st} items={[{ key: "all", label: "All", href: "/placement" }, ...statuses.map((s) => ({ key: s.status, label: `${s.status} (${s.c})`, href: `/placement?st=${encodeURIComponent(s.status)}` }))]} /></div>
        <Table head={["Student", "College", "Company", "Role", "Status", "Joining"]} empty="No offers.">{offers.map((o, i) => <tr key={i}><td className="td">{o.student_name}</td><td className="td">{o.college || "—"}</td><td className="td">{o.company}</td><td className="td">{o.role || "—"}</td><td className="td"><Badge tone={/joined/i.test(o.status) && !/not/i.test(o.status) ? "good" : /did not|declin/i.test(o.status) ? "bad" : "brand"}>{o.status}</Badge></td><td className="td">{o.jd || "—"}</td></tr>)}</Table>
      </Card>
    </>
  );
}
