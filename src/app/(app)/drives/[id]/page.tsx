import { notFound } from "next/navigation";
import { q, one } from "@/lib/db";
import { PageHeader, Card, Table, Badge } from "@/components/ui";

export default async function Drive({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await one("select *, drive_date::text dd from drives where id=$1", [Number(id) || 0]);
  if (!d) notFound();
  const [roles, offers] = await Promise.all([
    q("select * from drive_roles where drive_id=$1 order by id", [d.id]),
    q("select * from offers where lower(company)=lower($1) order by student_name", [d.company]),
  ]);
  return (
    <>
      <PageHeader title={d.company} sub={`${d.dd} · SDR ${d.sdr || "—"} · ${d.location || "location not recorded"} · ${d.ctc || d.stipend || "pay not recorded"}`} />
      <div className="mb-5 flex flex-wrap gap-2"><Badge tone={d.result === "Won" ? "good" : d.result === "Lost" ? "bad" : "brand"}>{d.result}</Badge>{d.owner_team && <Badge>Owner: {d.owner_team}</Badge>}{d.loss_category && <Badge tone="warn">{d.loss_category}</Badge>}<Badge>{d.offers} offers</Badge><Badge>{d.joined} joined</Badge></div>
      {d.loss_reason && <Card title="Why it was lost" className="mb-5"><p className="text-sm">{d.loss_reason}</p>{d.outcome && <p className="mt-2 text-sm text-muted">Tracker feedback: {d.outcome}</p>}{d.summary && <p className="mt-2 text-sm text-muted">{d.summary}</p>}</Card>}
      <Card title="Roles" pad={false} className="mb-5"><Table head={["Role", "Type", "Openings", "Status", "Offers", "Joined", "Feedback"]} empty={roles.length ? undefined : "No roles recorded."}>{roles.map((r) => <tr key={r.id}><td className="td">{r.role || "—"}</td><td className="td">{r.role_type || "—"}</td><td className="td num">{r.openings}</td><td className="td">{r.status || "—"}</td><td className="td num">{r.offers}</td><td className="td num">{r.joined}</td><td className="td">{r.feedback || "—"}</td></tr>)}</Table></Card>
      <Card title="Offers to students" pad={false}><Table head={["Student", "College", "Role", "Status", "Joining date"]} empty="No offer rows matched this company yet.">{offers.map((o) => <tr key={o.id}><td className="td">{o.student_name}</td><td className="td">{o.college || "—"}</td><td className="td">{o.role || "—"}</td><td className="td">{o.status}</td><td className="td">{o.join_date ? String(o.join_date).slice(0, 10) : "—"}</td></tr>)}</Table></Card>
    </>
  );
}
