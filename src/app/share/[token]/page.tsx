import { one, q } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Candidate profiles", robots: { index: false, follow: false } };
export default async function Share({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await one("select * from profile_packs where share_token=$1", [token]).catch(() => undefined);
  const dead = !p || p.status === "Closed" || (p.expires_at && new Date(p.expires_at) < new Date());
  if (dead) return <div className="mx-auto mt-24 max-w-md p-6 text-center"><h1 className="text-xl font-bold">This link is no longer available</h1><p className="mt-2 text-sm text-muted">It may have expired or been closed. Please ask FACE Prep Campus for a new one.</p></div>;
  const items = await q("select c.name, c.college, c.dept, c.skills, c.assessment_score from pack_items i join candidates c on c.id=i.candidate_id where i.pack_id=$1 and c.consent order by c.assessment_score desc nulls last", [p.id]);
  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="text-2xl font-bold">{p.title}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Pre-assessed candidates shared by FACE Prep Campus{p.company ? ` for ${p.company}` : ""}.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((c, i) => (
          <div key={i} className="card p-4"><div className="flex items-start justify-between gap-2"><div className="font-semibold">{c.name}</div>{c.assessment_score != null && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">Score {c.assessment_score}</span>}</div>
            <div className="mt-1 text-sm text-muted">{c.college}{c.dept ? ` · ${c.dept}` : ""}</div>{c.skills && <div className="mt-2 text-sm">{c.skills}</div>}</div>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted">To request contact details for any candidate, reply to the FACE Prep Campus team that sent you this link.</p>
    </div>
  );
}
