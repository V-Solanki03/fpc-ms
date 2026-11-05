import Link from "next/link";
import { q } from "@/lib/db";
import { allMembers } from "@/lib/team";
import { PageHeader, Card, Table, Badge } from "@/components/ui";
import { fmtTime } from "@/lib/dates";

export default async function Accounts({ searchParams }: { searchParams: Promise<{ s?: string; owner?: string }> }) {
  const { s = "", owner = "" } = await searchParams;
  const members = await allMembers();
  const rows = await q(`select a.zoho_id, a.name, a.owner_id, a.modified_time, m.name owner_name, m.active,
      (select count(*)::int from deals d where d.account_id=a.zoho_id) deals,
      (select count(*)::int from deals d where d.account_id=a.zoho_id and d.stage ilike 'closed won') won,
      (select count(*)::int from contacts c where c.account_id=a.zoho_id) contacts
    from accounts a left join team_members m on m.zoho_id=a.owner_id
    where ($1='' or a.name ilike '%'||$1||'%') and ($2='' or a.owner_id=$2) order by a.modified_time desc nulls last limit 200`, [s, owner]);
  return (
    <>
      <PageHeader title="Accounts" sub="Companies from Zoho. Showing the 200 most recently touched." />
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input className="input max-w-xs" name="s" defaultValue={s} placeholder="Search company" aria-label="Search company" />
        <select className="input max-w-[200px]" name="owner" defaultValue={owner} aria-label="Owner"><option value="">All owners</option>{members.map((m) => <option key={m.zoho_id} value={m.zoho_id}>{m.name}</option>)}</select>
        <button className="btn">Filter</button>
      </form>
      <Card pad={false}>
        <Table head={["Account", "Owner", "Deals", "Won", "Contacts", "Last touched"]} empty={rows.length ? undefined : "No accounts found."}>
          {rows.map((a) => (
            <tr key={a.zoho_id}>
              <td className="td"><Link className="font-medium text-brand" href={`/accounts/${a.zoho_id}`}>{a.name}</Link></td>
              <td className="td">{a.owner_name || "—"} {a.owner_name && !a.active && <Badge tone="bad">inactive</Badge>}</td>
              <td className="td num">{a.deals}</td><td className="td num">{a.won}</td><td className="td num">{a.contacts}</td><td className="td">{fmtTime(a.modified_time)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
