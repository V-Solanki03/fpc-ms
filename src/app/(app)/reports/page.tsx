import { q } from "@/lib/db";
import { istDate } from "@/lib/dates";
import { buildSdrDaily, buildFpcWeekly } from "@/lib/reports";
import { emailLive } from "@/lib/mail";
import { getSetting } from "@/lib/settings";
import { PageHeader, Card, Table, Badge, Notice } from "@/components/ui";
import { sendOutbox, buildReport } from "@/app/actions";
import { fmtTime } from "@/lib/dates";
import Link from "next/link";

export default async function Reports({ searchParams }: { searchParams: Promise<{ day?: string; view?: string; msg?: string; id?: string }> }) {
  const sp = await searchParams;
  const day = sp.day || istDate();
  const view = sp.view || "sdr";
  const [b, outbox, sdrRec, fpcRec] = await Promise.all([
    view === "fpc" ? buildFpcWeekly(day) : buildSdrDaily(day),
    q("select id, kind, subject, to_list, status, created_at, sent_at, error from email_outbox order by id desc limit 40"),
    getSetting("sdr_report_recipients"), getSetting("fpc_report_recipients"),
  ]);
  const rec = view === "fpc" ? fpcRec : sdrRec;
  const picked = sp.id ? (await q("select subject, html from email_outbox where id=$1", [Number(sp.id)]))[0] : null;
  return (
    <>
      <PageHeader title="Reports" sub="The daily SDR table and the weekly FPC report. They are built from the app's own data and sent on schedule. Until email is switched on they are saved as previews." />
      {sp.msg && <Notice tone="brand">{sp.msg}</Notice>}
      <Notice tone={emailLive() ? "good" : "warn"}>{emailLive() ? "Email sending is ON." : "Email sending is OFF. Reports are saved as previews. Set EMAIL_LIVE=true and the SMTP settings in Vercel to send."} Recipients: {rec.to.length ? rec.to.join(", ") : "none set"}{rec.cc.length ? ` (cc ${rec.cc.length})` : ""}. <Link className="text-brand underline" href="/settings">Change in Settings</Link></Notice>
      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Preview" right={
          <form method="get" className="flex flex-wrap items-center gap-2"><select name="view" defaultValue={view} className="input w-auto"><option value="sdr">SDR daily</option><option value="fpc">FPC weekly</option></select><input type="date" name="day" defaultValue={day} className="input w-auto" /><button className="btn">Show</button></form>}>
          <p className="mb-2 text-sm font-medium">{picked?.subject || b.subject}</p>
          <div className="overflow-x-auto rounded-lg border border-line bg-white p-4 text-black" dangerouslySetInnerHTML={{ __html: picked?.html || b.html }} />
          <form action={buildReport} className="mt-3 flex gap-2"><input type="hidden" name="kind" value={view} /><input type="hidden" name="day" value={day} /><button className="btn btn-primary">Save to outbox{emailLive() ? " and send" : ""}</button></form>
        </Card>
        <Card className="xl:col-span-2" title="Outbox" pad={false}>
          <Table head={["Email", "Status", ""]} empty={outbox.length ? undefined : "Nothing yet."}>
            {outbox.map((o) => (
              <tr key={o.id}><td className="td"><Link className="text-brand" href={`/reports?id=${o.id}&view=${view}`}>{o.subject}</Link><div className="text-xs text-muted">{fmtTime(o.created_at)}{o.error ? " · " + o.error : ""}</div></td>
                <td className="td"><Badge tone={o.status === "sent" ? "good" : o.status === "failed" ? "bad" : "muted"}>{o.status}</Badge></td>
                <td className="td">{o.status !== "sent" && <form action={sendOutbox}><input type="hidden" name="id" value={o.id} /><button className="btn text-xs" disabled={!emailLive()}>Send</button></form>}</td></tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
