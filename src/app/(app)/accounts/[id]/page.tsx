import { notFound } from "next/navigation";
import { q, one } from "@/lib/db";
import { PageHeader, Card, Table, Badge } from "@/components/ui";
import { fmtTime } from "@/lib/dates";

export default async function Account({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await one("select a.*, m.name owner_name from accounts a left join team_members m on m.zoho_id=a.owner_id where a.zoho_id=$1", [id]);
  if (!a) notFound();
  const [contacts, deals, drives, jobs] = await Promise.all([
    q("select * from contacts where account_id=$1 order by name", [id]),
    q("select * from deals where account_id=$1 order by modified_time desc", [id]),
    q("select id, drive_date::text d, result, offers, joined, owner_team from drives where lower(regexp_replace(company,'[^a-zA-Z0-9]','','g')) like '%'||$1||'%' or $1 like '%'||lower(regexp_replace(company,'[^a-zA-Z0-9]','','g'))||'%' order by drive_date desc limit 10", [a.name_key || "zzzz"]),
    q("select 1 where false"),
  ]);
  void jobs;
  const timeline = [
    ...deals.map((d) => ({ at: d.modified_time, text: `Deal "${d.name}" is ${d.stage}` })),
    ...contacts.map((c) => ({ at: c.modified_time, text: `Contact ${c.name} updated` })),
  ].sort((x, y) => +new Date(y.at) - +new Date(x.at)).slice(0, 12);
  const won = deals.filter((d) => /closed won/i.test(d.stage || ""));
  return (
    <>
      <PageHeader title={a.name} sub={<>Owner {a.owner_name || "—"} · {a.industry || "Industry not set"} · last touched {fmtTime(a.modified_time)} {a.website && <> · <a className="text-brand" href={a.website} target="_blank" rel="noreferrer">website</a></>}</>} />
      <div className="mb-5 flex flex-wrap gap-2"><Badge tone="brand">{deals.length} deals</Badge><Badge tone="good">{won.length} won</Badge><Badge>{contacts.length} contacts</Badge><Badge>{drives.length} campus drives</Badge></div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Deals" pad={false}><Table head={["Deal", "Stage", "Offers", "Updated"]} empty={deals.length ? undefined : "No deals."}>{deals.map((d) => <tr key={d.zoho_id}><td className="td">{d.name}</td><td className="td">{d.stage}</td><td className="td num">{d.amount ?? "—"}</td><td className="td">{fmtTime(d.modified_time)}</td></tr>)}</Table></Card>
        <Card title="Contacts" pad={false}><Table head={["Name", "Title", "Email"]} empty={contacts.length ? undefined : "No contacts."}>{contacts.map((c) => <tr key={c.zoho_id}><td className="td">{c.name}</td><td className="td">{c.title || "—"}</td><td className="td">{c.email || "—"}</td></tr>)}</Table></Card>
        <Card title="Campus drives with this company" pad={false}><Table head={["Date", "Result", "Offers", "Joined"]} empty={drives.length ? undefined : "No drives matched by name."}>{drives.map((d) => <tr key={d.id}><td className="td">{d.d}</td><td className="td">{d.result}</td><td className="td num">{d.offers}</td><td className="td num">{d.joined}</td></tr>)}</Table></Card>
        <Card title="Recent activity"><ul className="space-y-2 text-sm">{timeline.length ? timeline.map((t, i) => <li key={i} className="flex justify-between gap-3"><span>{t.text}</span><span className="shrink-0 text-xs text-muted">{fmtTime(t.at)}</span></li>) : <li className="text-muted">Nothing yet.</li>}</ul></Card>
      </div>
    </>
  );
}
