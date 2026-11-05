import { q } from "@/lib/db";
import { KIND_LABEL } from "@/lib/hygiene";
import { PageHeader, Card, Table, Badge, Notice, Tabs, Stat } from "@/components/ui";
import { hygieneApprove, hygieneReject, hygieneScan } from "@/app/actions";
import { zohoWriteEnabled } from "@/lib/zoho";
import { nameMap } from "@/lib/team";
import { timeAgo } from "@/lib/dates";

export default async function Hygiene({ searchParams }: { searchParams: Promise<{ kind?: string; note?: string; st?: string }> }) {
  const { kind = "all", note, st = "open" } = await searchParams;
  const names = await nameMap();
  const counts = await q("select kind, count(*)::int c from hygiene_issues where status='open' group by 1");
  const total = counts.reduce((a, r) => a + r.c, 0);
  const rows = await q(`select * from hygiene_issues where status=$1 and ($2='all' or kind=$2) order by first_seen desc, id desc limit 200`, [st, kind]);
  const last = (await q("select max(started_at) t from job_runs where job='hygiene.scan' and status='ok'"))[0]?.t;
  return (
    <>
      <PageHeader title="CRM hygiene" sub="Data problems found in Zoho. Nothing is changed without your approval. Approving a fix either applies it (owner reassignment, when Zoho writes are on) or marks it for manual fixing; the next scan closes it once Zoho is fixed."
        actions={<form action={hygieneScan}><button className="btn btn-primary">Scan now</button></form>} />
      {note && <Notice tone="brand">{note}</Notice>}
      <Notice tone={zohoWriteEnabled() ? "warn" : "brand"}>{zohoWriteEnabled() ? "Zoho writes are ON: approving an owner reassignment changes records in Zoho." : "Zoho writes are OFF: approvals are recorded but nothing is changed in Zoho."} Last scan {timeAgo(last)}.</Notice>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat label="Open issues" value={total} tone={total ? "warn" : "good"} />
        {Object.entries(KIND_LABEL).map(([k, l]) => <Stat key={k} label={l} value={counts.find((c) => c.kind === k)?.c ?? 0} href={`/hygiene?kind=${k}`} />)}
      </div>
      <Tabs current={st} items={[["open", "Open"], ["approved", "Approved"], ["dismissed", "Dismissed"], ["resolved", "Resolved"]].map(([k, l]) => ({ key: k, label: l, href: `/hygiene?st=${k}&kind=${kind}` }))} />
      <Card pad={false}>
        <Table head={["Issue", "Type", "Owner", "Proposed fix", "First seen", ""]} empty={rows.length ? undefined : "Nothing here."}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="td max-w-md">{r.summary}</td><td className="td"><Badge tone="brand">{KIND_LABEL[r.kind] || r.kind}</Badge></td>
              <td className="td">{names.get(r.owner_id) || r.owner_id || "—"}</td>
              <td className="td max-w-xs text-xs text-muted">{r.fix?.type === "reassign_owner" ? `Move all ${r.fix.module.toLowerCase()} to ${r.fix.toName}` : r.fix?.note}</td>
              <td className="td whitespace-nowrap text-xs text-muted">{timeAgo(r.first_seen)}</td>
              <td className="td whitespace-nowrap">
                {r.status === "open" && <div className="flex gap-1"><form action={hygieneApprove}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="kind" value={kind} /><button className="btn text-xs">Approve</button></form>
                  <form action={hygieneReject}><input type="hidden" name="id" value={r.id} /><button className="btn text-xs">Dismiss</button></form></div>}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
