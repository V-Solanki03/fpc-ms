import Link from "next/link";
import { q, one } from "@/lib/db";
import { istDate, addDays, shortDate, timeAgo } from "@/lib/dates";
import { scoreboard, trend } from "@/lib/metrics";
import { commitmentSdrs } from "@/lib/team";
import { getSetting } from "@/lib/settings";
import { aiConfigured } from "@/lib/ai";
import { zohoConfigured } from "@/lib/zoho";
import { PageHeader, Card, Stat, Table, Badge, Progress, Notice } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import { SERIES } from "@/components/data";
import { aiSummary } from "@/app/actions";
import { pct } from "@/lib/util";

export default async function Dashboard() {
  const today = istDate();
  const [sb, tr, sdrs, hy, fails, sync, previews, ai, commitsToday] = await Promise.all([
    scoreboard(today, today), trend(addDays(today, -13), today), commitmentSdrs(),
    q("select kind, count(*)::int c from hygiene_issues where status='open' group by 1 order by 2 desc"),
    q("select job, error, started_at from job_runs where status='failed' and started_at > now() - interval '24 hours' order by started_at desc limit 3"),
    one("select max(last_sync) t, count(*) filter (where last_error is not null)::int errs from sync_state"),
    one("select count(*)::int c from email_outbox where status='preview'"),
    getSetting("ai_summary" as any) as Promise<any>,
    q("select owner_id from commitments where day=$1 and calls is not null", [today]),
  ]);
  const t = sb.total;
  const targetCalls = sb.rows.reduce((a, r) => a + r.target_calls, 0);
  const done = new Set(commitsToday.map((c) => c.owner_id));
  const missing = sdrs.filter((s) => !done.has(s.zoho_id));
  const hyTotal = hy.reduce((a, r) => a + r.c, 0);
  const attention: { tone: string; text: string; href: string }[] = [];
  if (!zohoConfigured()) attention.push({ tone: "warn", text: "Zoho is not connected yet, so numbers come from stored or sample data.", href: "/sync" });
  else if (sync?.t && Date.now() - new Date(sync.t).getTime() > 3600000) attention.push({ tone: "bad", text: `Zoho data is stale (last sync ${timeAgo(sync.t)}).`, href: "/sync" });
  if (sync?.errs) attention.push({ tone: "bad", text: `${sync.errs} sync source(s) reported an error.`, href: "/sync" });
  fails.forEach((f) => attention.push({ tone: "bad", text: `${f.job} failed ${timeAgo(f.started_at)}: ${String(f.error).slice(0, 90)}`, href: "/automations" }));
  if (missing.length) attention.push({ tone: "warn", text: `${missing.length} SDR(s) have not entered today's commitments.`, href: "/my-day" });
  if (hyTotal) attention.push({ tone: "warn", text: `${hyTotal} CRM data issues waiting for review.`, href: "/hygiene" });
  if (previews?.c) attention.push({ tone: "muted", text: `${previews.c} email(s) saved as previews and not sent.`, href: "/reports" });

  return (
    <>
      <PageHeader title="Dashboard" sub={`Today, ${shortDate(today)} (India time). Numbers update every 15 minutes from Zoho.`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Calls" value={t.calls} sub={`target ${targetCalls || "—"}`} tone={targetCalls && t.calls >= targetCalls ? "good" : undefined} href="/scoreboard" />
        <Stat label="Connected" value={t.connected} sub={`${pct(t.connected, t.calls)}% connect rate`} href="/scoreboard" />
        <Stat label="Meetings scheduled" value={t.scheduled} href="/scoreboard" />
        <Stat label="Meetings held" value={t.held} href="/scoreboard" />
        <Stat label="Deals created" value={t.deals} href="/pipeline" />
        <Stat label="Offers" value={t.offers} sub="from Closed Won" href="/pipeline" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="Needs attention" className="xl:col-span-1">
          {attention.length === 0 ? <p className="text-sm text-good">Nothing needs attention right now.</p> : (
            <ul className="space-y-2">{attention.map((a, i) => (
              <li key={i}><Link href={a.href} className="flex items-start gap-2 rounded-lg p-2 text-sm hover:bg-soft"><Badge tone={a.tone}>{a.tone === "bad" ? "Fix" : a.tone === "warn" ? "Check" : "Info"}</Badge><span>{a.text}</span></Link></li>
            ))}</ul>
          )}
        </Card>
        <Card title="Last 14 days" className="xl:col-span-2" right={<Link href="/scoreboard" className="text-xs text-brand">Open scoreboard</Link>}>
          <TrendChart data={tr.map((d) => ({ ...d, label: shortDate(d.day) }))} lines={[{ key: "calls", label: "Calls", color: SERIES.calls }, { key: "connected", label: "Connected", color: SERIES.connected }, { key: "scheduled", label: "Meetings scheduled", color: SERIES.scheduled }]} />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="Today by SDR" className="xl:col-span-2" pad={false} right={<Link href="/scoreboard" className="text-xs text-brand">Details</Link>}>
          <Table head={["SDR", "Calls", "Connected", "Meetings", "Progress to target"]} empty={sb.rows.length ? undefined : "No SDRs yet. Connect Zoho or load sample data under Integrations."}>
            {sb.rows.map((r) => (
              <tr key={r.member.zoho_id}>
                <td className="td font-medium">{r.member.name}</td><td className="td num">{r.calls}</td><td className="td num">{r.connected}</td><td className="td num">{r.scheduled}</td>
                <td className="td min-w-[140px]"><Progress value={r.calls} max={r.target_calls} /><div className="mt-1 text-xs text-muted">{r.calls}/{r.target_calls} calls</div></td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Day summary (AI)" right={aiConfigured() ? undefined : <Badge>Off</Badge>}>
          {ai?.text && ai.day === today ? <div className="whitespace-pre-wrap text-sm">{ai.text}</div> : ai?.error ? <p className="text-sm text-bad">{ai.error}</p> : (
            <p className="text-sm text-muted">{aiConfigured() ? "Generate a short plain-language read of today's numbers." : "Add GEMINI_API_KEY to turn this on. Only team totals are sent, never student or contact details."}</p>
          )}
          {aiConfigured() && <form action={aiSummary} className="mt-3"><button className="btn">Generate summary</button></form>}
        </Card>
      </div>
    </>
  );
}
