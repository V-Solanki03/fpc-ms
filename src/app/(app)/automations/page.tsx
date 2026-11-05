import { q } from "@/lib/db";
import { JOBS } from "@/lib/jobs";
import { PageHeader, Card, Table, Badge, Notice } from "@/components/ui";
import { runJobAction } from "@/app/actions";
import { fmtTime, timeAgo } from "@/lib/dates";

export default async function Automations() {
  const last = await q("select distinct on (job) job, status, started_at, finished_at, summary, error, triggered_by from job_runs order by job, started_at desc");
  const hist = await q("select id, job, status, started_at, finished_at, summary, error, triggered_by from job_runs order by id desc limit 30");
  const L = new Map(last.map((l) => [l.job, l]));
  const tone = (s: string) => (s === "ok" ? "good" : s === "failed" ? "bad" : s === "running" ? "brand" : "muted");
  return (
    <>
      <PageHeader title="Automations" sub="Every scheduled job in one place. Jobs run on Vercel Cron; Run now does the same thing on demand. Failures create a notification and an email to the admin address." />
      <Notice tone="brand">Schedules are in <code>vercel.json</code> (times in UTC). Sub-daily schedules need the Vercel Pro plan; on the free plan, see docs/DEPLOY.md for the fallback.</Notice>
      <Card pad={false} className="mb-5">
        <Table head={["Job", "Schedule (IST)", "Last run", "Result", ""]}>
          {JOBS.map((j) => { const l = L.get(j.name); return (
            <tr key={j.name}>
              <td className="td"><div className="font-medium">{j.title}</div><div className="max-w-md text-xs text-muted">{j.description}</div><code className="text-[11px] text-muted">{j.name}</code></td>
              <td className="td whitespace-nowrap">{j.when}</td>
              <td className="td whitespace-nowrap">{l ? <>{timeAgo(l.started_at)}<div className="text-xs text-muted">{l.triggered_by}</div></> : <span className="text-muted">never</span>}</td>
              <td className="td max-w-sm">{l ? <><Badge tone={tone(l.status)}>{l.status}</Badge> <span className="text-xs text-muted">{l.error || l.summary}</span></> : "—"}</td>
              <td className="td"><form action={runJobAction}><input type="hidden" name="job" value={j.name} /><button className="btn text-xs">Run now</button></form></td>
            </tr>); })}
        </Table>
      </Card>
      <Card title="Recent runs" pad={false}>
        <Table head={["When", "Job", "Status", "By", "Detail"]}>{hist.map((h) => <tr key={h.id}><td className="td whitespace-nowrap">{fmtTime(h.started_at)}</td><td className="td"><code className="text-xs">{h.job}</code></td><td className="td"><Badge tone={tone(h.status)}>{h.status}</Badge></td><td className="td">{h.triggered_by}</td><td className="td max-w-md text-xs text-muted">{h.error || h.summary}</td></tr>)}</Table>
      </Card>
    </>
  );
}
