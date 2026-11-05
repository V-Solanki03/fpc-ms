import { q } from "@/lib/db";
import { allMembers } from "@/lib/team";
import { PageHeader, Badge } from "@/components/ui";
import { fmtTime } from "@/lib/dates";
import Link from "next/link";

const STAGES = ["Drive Identified", "Profiles Sent", "Interview", "Closed Won", "Closed Lost"];
export default async function Pipeline({ searchParams }: { searchParams: Promise<{ owner?: string }> }) {
  const { owner = "" } = await searchParams;
  const members = await allMembers();
  const deals = await q(`select d.zoho_id, d.name, d.account_id, d.account_name, d.stage, d.amount, d.modified_time, m.name owner_name, (current_date - d.modified_time::date)::int age
    from deals d left join team_members m on m.zoho_id=d.owner_id where ($1='' or d.owner_id=$1) and (d.stage !~* '^closed' or d.modified_time > now() - interval '30 days') order by d.modified_time desc limit 600`, [owner]);
  const other = [...new Set(deals.map((d) => d.stage).filter((s) => s && !STAGES.includes(s)))];
  const cols = [...STAGES, ...other];
  return (
    <>
      <PageHeader title="Pipeline" sub="Deals by stage. Closed deals show only the last 30 days. Cards turn amber after 7 days and red after 14 days without an update." />
      <form className="mb-4 flex gap-2" method="get"><select className="input max-w-[220px]" name="owner" defaultValue={owner} aria-label="Owner"><option value="">All owners</option>{members.filter((m) => m.is_sdr).map((m) => <option key={m.zoho_id} value={m.zoho_id}>{m.name}</option>)}</select><button className="btn">Filter</button></form>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {cols.map((c) => {
          const list = deals.filter((d) => (d.stage || "") === c);
          return (
            <div key={c} className="w-72 shrink-0 rounded-xl bg-soft p-2">
              <div className="mb-2 flex items-center justify-between px-1"><span className="text-sm font-semibold">{c}</span><Badge>{list.length}</Badge></div>
              <div className="max-h-[70vh] space-y-2 overflow-y-auto">
                {list.slice(0, 40).map((d) => {
                  const closed = /^closed/i.test(c); const tone = closed ? "border-line" : d.age >= 14 ? "border-bad" : d.age >= 7 ? "border-warn" : "border-line";
                  return (
                    <div key={d.zoho_id} className={`card border-l-4 p-3 ${tone}`}>
                      <div className="text-sm font-medium">{d.name || d.account_name}</div>
                      {d.account_id && <Link className="text-xs text-brand" href={`/accounts/${d.account_id}`}>{d.account_name}</Link>}
                      <div className="mt-1 flex justify-between text-xs text-muted"><span>{d.owner_name || "—"}</span><span>{closed ? fmtTime(d.modified_time) : `${d.age}d idle`}</span></div>
                    </div>
                  );
                })}
                {list.length > 40 && <p className="p-2 text-center text-xs text-muted">+{list.length - 40} more</p>}
                {!list.length && <p className="p-4 text-center text-xs text-muted">Empty</p>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
