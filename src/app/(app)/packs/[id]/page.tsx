import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { q, one } from "@/lib/db";
import { PageHeader, Card, Table, Badge } from "@/components/ui";
import { packRemove, packStatus } from "@/app/actions";
import { fmtTime } from "@/lib/dates";

export default async function Pack({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await one("select * from profile_packs where id=$1", [Number(id) || 0]);
  if (!p) notFound();
  const items = await q("select c.* from pack_items i join candidates c on c.id=i.candidate_id where i.pack_id=$1 order by c.assessment_score desc nulls last", [p.id]);
  const h = await headers(); const host = h.get("x-forwarded-host") || h.get("host");
  const link = `${h.get("x-forwarded-proto") || "https"}://${host}/share/${p.share_token}`;
  return (
    <>
      <PageHeader title={p.title} sub={`${p.company || "No company set"} · link expires ${fmtTime(p.expires_at)}`} actions={<Link className="btn" href={`/candidates?pack=${p.id}`}>Add candidates</Link>} />
      <Card title="Share link" className="mb-5">
        <div className="flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-soft px-3 py-2 text-xs">{link}</code><Badge tone={p.status === "Shared" ? "good" : "muted"}>{p.status}</Badge></div>
        <form action={packStatus} className="mt-3 flex gap-2"><input type="hidden" name="pack" value={p.id} /><button name="status" value="Shared" className="btn">Mark as shared</button><button name="status" value="Closed" className="btn">Close pack</button></form>
        <p className="mt-2 text-xs text-muted">Anyone with this link can see the candidates below until it expires. A closed pack stops working.</p>
      </Card>
      <Card title={`Candidates (${items.length})`} pad={false}>
        <Table head={["Name", "College", "Dept", "Skills", "Score", ""]} empty="No candidates in this pack yet.">
          {items.map((c) => <tr key={c.id}><td className="td font-medium">{c.name}</td><td className="td">{c.college}</td><td className="td">{c.dept}</td><td className="td">{c.skills}</td><td className="td num">{c.assessment_score ?? "—"}</td>
            <td className="td"><form action={packRemove}><input type="hidden" name="pack" value={p.id} /><input type="hidden" name="cid" value={c.id} /><button className="btn btn-danger text-xs">Remove</button></form></td></tr>)}
        </Table>
      </Card>
    </>
  );
}
