import Link from "next/link";
import { q } from "@/lib/db";
import { PageHeader, Card, Table, Badge } from "@/components/ui";
import { createPack } from "@/app/actions";
import { fmtTime } from "@/lib/dates";

export default async function Packs() {
  const rows = await q(`select p.*, (select count(*)::int from pack_items i where i.pack_id=p.id) n from profile_packs p order by id desc`);
  return (
    <>
      <PageHeader title="Profile packs" sub="Pick candidates for a company and share a link that expires. The link shows name, college, department, skills and score only; never email or phone." />
      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="New pack">
          <form action={createPack} className="space-y-3">
            <input className="input" name="title" placeholder="Title, e.g. Python interns for Acme" required aria-label="Title" />
            <input className="input" name="company" placeholder="Company" aria-label="Company" />
            <label className="block text-sm"><span className="mb-1 block text-xs text-muted">Link valid for (days)</span><input className="input" type="number" name="days" defaultValue={14} min={1} max={90} /></label>
            <button className="btn btn-primary">Create pack</button>
          </form>
        </Card>
        <Card title="All packs" className="xl:col-span-2" pad={false}>
          <Table head={["Title", "Company", "Candidates", "Status", "Expires"]} empty={rows.length ? undefined : "No packs yet."}>
            {rows.map((p) => <tr key={p.id}><td className="td"><Link className="font-medium text-brand" href={`/packs/${p.id}`}>{p.title}</Link></td><td className="td">{p.company || "—"}</td><td className="td num">{p.n}</td><td className="td"><Badge tone={p.status === "Shared" ? "good" : "muted"}>{p.status}</Badge></td><td className="td">{fmtTime(p.expires_at)}</td></tr>)}
          </Table>
        </Card>
      </div>
    </>
  );
}
