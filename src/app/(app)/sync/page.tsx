import { q } from "@/lib/db";
import { zohoConfigured, zohoWriteEnabled } from "@/lib/zoho";
import { emailLive } from "@/lib/mail";
import { aiConfigured, aiUsage } from "@/lib/ai";
import { hasDemo } from "@/lib/demo";
import { PageHeader, Card, Table, Badge } from "@/components/ui";
import { syncNow, loadDemoAction, clearDemoAction } from "@/app/actions";
import { timeAgo } from "@/lib/dates";

export default async function Integrations() {
  const st = await q("select * from sync_state order by entity");
  const counts = await q(`select 'accounts' t, count(*)::int c from accounts union all select 'contacts', count(*)::int from contacts union all select 'deals', count(*)::int from deals
    union all select 'calls', count(*)::int from calls union all select 'events', count(*)::int from events union all select 'students', count(*)::int from students
    union all select 'offers', count(*)::int from offers union all select 'drives', count(*)::int from drives union all select 'candidates', count(*)::int from candidates`);
  const demo = await hasDemo(); const ai = await aiUsage();
  const row = (name: string, ok: boolean, detail: string, off = "Not set up") => (
    <tr><td className="td font-medium">{name}</td><td className="td"><Badge tone={ok ? "good" : "warn"}>{ok ? "Connected" : off}</Badge></td><td className="td text-sm text-muted">{detail}</td></tr>
  );
  return (
    <>
      <PageHeader title="Integrations" sub="What the app is connected to, and how fresh the data is." actions={<form action={syncNow}><button className="btn btn-primary" disabled={!zohoConfigured()}>Sync Zoho now</button></form>} />
      <Card title="Connections" pad={false} className="mb-5">
        <Table head={["Service", "Status", "Notes"]}>
          {row("Zoho CRM", zohoConfigured(), zohoConfigured() ? `Read access. Writes are ${zohoWriteEnabled() ? "ON (hygiene reassignments only)" : "OFF"}.` : "Add ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_REFRESH_TOKEN in Vercel. See docs/ZOHO_SETUP.md.")}
          {row("Email", emailLive(), emailLive() ? "Reports are sent for real." : "Reports are saved as previews. Set EMAIL_LIVE=true with SMTP details to send.", "Preview only")}
          {row("AI (Gemini)", aiConfigured(), aiConfigured() ? `${ai.calls} of ${ai.cap} calls used this month.` : "Optional. Add GEMINI_API_KEY to enable summaries.", "Off")}
          {row("Google Sheets", true, "Linked sheets and file upload are under Import data. No Google Cloud setup needed.")}
        </Table>
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Zoho sync status" pad={false}>
          <Table head={["Source", "Last sync", "Records", "Error"]} empty={st.length ? undefined : "No sync has run yet."}>
            {st.map((s) => <tr key={s.entity}><td className="td font-medium">{s.entity}</td><td className="td">{timeAgo(s.last_sync)}</td><td className="td num">{s.record_count}</td><td className="td text-xs text-bad">{s.last_error || ""}</td></tr>)}
          </Table>
        </Card>
        <Card title="Rows in the app" pad={false}>
          <Table head={["Data", "Rows"]}>{counts.map((c) => <tr key={c.t}><td className="td">{c.t}</td><td className="td num">{c.c.toLocaleString("en-IN")}</td></tr>)}</Table>
        </Card>
      </div>
      <Card title="Sample data" className="mt-5">
        <p className="mb-3 text-sm text-muted">Load made-up SDRs, calls, drives and students to explore the app before Zoho is connected. Clearing removes only the sample rows.</p>
        <div className="flex gap-2"><form action={loadDemoAction}><button className="btn" disabled={demo}>Load sample data</button></form><form action={clearDemoAction}><button className="btn btn-danger" disabled={!demo}>Clear sample data</button></form></div>
      </Card>
    </>
  );
}
