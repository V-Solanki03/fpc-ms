import { Nav } from "@/components/nav";
import { q } from "@/lib/db";
import { hasDemo } from "@/lib/demo";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Run now and Sync now can take a while

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let badge: Record<string, number> = {}; let demo = false; let dbError = "";
  try {
    const [h] = await q("select count(*)::int c from hygiene_issues where status='open'");
    const [f] = await q("select count(*)::int c from job_runs where status='failed' and started_at > now() - interval '24 hours'");
    badge = { "/hygiene": h.c, "/automations": f.c };
    demo = await hasDemo();
  } catch (e: any) { dbError = e.message; }
  return (
    <>
        <div className="flex min-h-screen flex-col md:flex-row">
          <Nav badge={badge} />
          <main className="min-w-0 flex-1 p-4 md:p-8">
            {dbError ? <Notice tone="bad"><b>The database is not reachable.</b> {dbError}</Notice> : (
              <>
                {demo && <Notice tone="brand"><b>Sample data is loaded.</b> Everything you see is made up. Connect Zoho under Integrations, then clear the sample data there.</Notice>}
                {children}
              </>
            )}
          </main>
        </div>
    </>
  );
}
