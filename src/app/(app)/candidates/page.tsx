import { q } from "@/lib/db";
import { PageHeader, Card, Table, Badge, Notice } from "@/components/ui";
import { packAdd, setConsent } from "@/app/actions";

export default async function Candidates({ searchParams }: { searchParams: Promise<{ s?: string; college?: string; pref?: string; pack?: string }> }) {
  const { s = "", college = "", pref = "", pack = "" } = await searchParams;
  const [rows, colleges, packs] = await Promise.all([
    q(`select * from candidates where ($1='' or name ilike '%'||$1||'%' or skills ilike '%'||$1||'%' or email ilike '%'||$1||'%') and ($2='' or college=$2) and ($3='' or preference=$3) order by assessment_score desc nulls last, name limit 300`, [s, college, pref]),
    q("select distinct college from candidates where college is not null and college<>'' order by 1"),
    q("select id, title from profile_packs where status<>'Closed' order by id desc"),
  ]);
  return (
    <>
      <PageHeader title="Candidates" sub="Talent pool with assessment scores. A candidate can only go into a profile pack after consent is recorded." />
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input className="input max-w-xs" name="s" defaultValue={s} placeholder="Search name, skill or email" aria-label="Search" />
        <select className="input max-w-[220px]" name="college" defaultValue={college} aria-label="College"><option value="">All colleges</option>{colleges.map((c) => <option key={c.college}>{c.college}</option>)}</select>
        <select className="input max-w-[160px]" name="pref" defaultValue={pref} aria-label="Preference"><option value="">Any preference</option><option>Technical</option><option>Tech Support</option><option>Non-Tech</option></select>
        <button className="btn">Filter</button>
      </form>
      {!packs.length && <Notice tone="brand">Create a pack under Profile packs first, then come back here to add candidates to it.</Notice>}
      <form action={packAdd}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select name="pack" className="input max-w-[260px]" required aria-label="Pack">{packs.map((p) => <option key={p.id} value={p.id} selected={String(p.id) === pack}>{p.title}</option>)}</select>
          <button className="btn btn-primary" disabled={!packs.length}>Add selected to pack</button>
          <span className="text-xs text-muted">{rows.length} candidates shown</span>
        </div>
        <Card pad={false}>
          <Table head={["", "Name", "College", "Dept", "Preference", "Skills", "Score", "Tags", "Consent"]} empty={rows.length ? undefined : "No candidates yet. Use Import data to load the talent pool."}>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="td"><input type="checkbox" name="cid" value={c.id} disabled={!c.consent} aria-label={`Select ${c.name}`} /></td>
                <td className="td font-medium">{c.name}<div className="text-xs font-normal text-muted">{c.email}</div></td><td className="td">{c.college || "—"}</td><td className="td">{c.dept || "—"}</td><td className="td">{c.preference || "—"}</td>
                <td className="td max-w-[220px]">{c.skills || "—"}</td><td className="td num">{c.assessment_score ?? "—"}</td><td className="td">{c.tags ? <Badge tone="brand">{c.tags}</Badge> : "—"}</td>
                <td className="td">{c.consent ? <Badge tone="good">Yes</Badge> : <Badge tone="warn">No</Badge>}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </form>
      <details className="mt-4 text-sm"><summary className="cursor-pointer text-brand">Record consent for a candidate</summary>
        <form action={setConsent} className="mt-2 flex flex-wrap items-center gap-2"><select name="id" className="input max-w-xs" aria-label="Candidate">{rows.filter((r) => !r.consent).slice(0, 100).map((r) => <option key={r.id} value={r.id}>{r.name} ({r.email})</option>)}</select><input type="hidden" name="consent" value="1" /><button className="btn">Mark consent given</button></form>
        <p className="mt-1 text-xs text-muted">Only mark this when the candidate has agreed to have their profile shared with employers.</p></details>
    </>
  );
}
