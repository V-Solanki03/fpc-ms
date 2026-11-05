import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
process.env.PGLITE_DIR = "memory";
process.env.ZOHO_CLIENT_ID = "id"; process.env.ZOHO_CLIENT_SECRET = "secret"; process.env.ZOHO_REFRESH_TOKEN = "refresh"; process.env.ZOHO_ORG_ID = "1363009000000020813";
import { q } from "../src/lib/db";
import { syncAll } from "../src/lib/sync";
import { scoreboard } from "../src/lib/metrics";
import { runJob } from "../src/lib/jobs";

const realFetch = globalThis.fetch;
const calls: string[] = [];
const FIELDS: Record<string, string[]> = {
  Accounts: ["Account_Name", "Owner", "Website", "Industry", "Phone", "Created_Time", "Modified_Time"],
  Contacts: ["Full_Name", "Email", "Account_Name", "Owner", "Created_Time", "Modified_Time"], // Phone and Title missing on purpose
  Deals: ["Deal_Name", "Account_Name", "Owner", "Stage", "Amount", "Closing_Date", "Created_Time", "Modified_Time"],
  Calls: ["Subject", "Call_Type", "Call_Start_Time", "Call_Connected", "Call_Result", "Owner", "Created_Time", "Modified_Time"],
  Events: ["Event_Title", "Start_DateTime", "Owner", "Created_Time", "Modified_Time", "Check_In_Status"],
  SDR_Commitments: ["Commitment_Date", "Calls_Committed", "Owner"],
};
const owner = { id: "100", name: "Asha" };
const DATA: Record<string, any[]> = {
  Accounts: [{ id: "a1", Account_Name: "Acme Pvt Ltd", Owner: owner, Modified_Time: "2026-11-05T09:00:00+05:30", Created_Time: "2026-01-01T09:00:00+05:30" }],
  Contacts: [{ id: "k1", Full_Name: "Hira HR", Email: "hr@acme.com", Account_Name: { id: "a1", name: "Acme" }, Owner: owner, Modified_Time: "2026-11-05T09:00:00+05:30" }],
  Deals: [{ id: "d1", Deal_Name: "Acme drive", Account_Name: { id: "a1", name: "Acme" }, Owner: owner, Stage: "Closed Won", Amount: 2, Created_Time: "2026-11-05T09:30:00+05:30", Modified_Time: "2026-11-05T12:00:00+05:30" }],
  Calls: [{ id: "c1", Call_Start_Time: "2026-11-05T10:00:00+05:30", Call_Connected: "Yes", Call_Result: "Interested", Owner: owner, Modified_Time: "2026-11-05T10:05:00+05:30" },
          { id: "c2", Call_Start_Time: "2026-11-05T10:30:00+05:30", Call_Connected: "No", Call_Result: "Busy", Owner: owner, Modified_Time: "2026-11-05T10:35:00+05:30" }],
  Events: [{ id: "e1", Event_Title: "Meet", Start_DateTime: "2026-11-05T15:00:00+05:30", Created_Time: "2026-11-05T09:00:00+05:30", Check_In_Status: "VISITED", Owner: owner, Modified_Time: "2026-11-05T09:00:00+05:30" }],
  SDR_Commitments: [{ id: "m1", Commitment_Date: "2026-11-05", Calls_Committed: 60, Owner: owner }],
};
let orgId = "1363009000000020813";
function json(body: any, status = 200) { return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })); }

beforeAll(() => {
  globalThis.fetch = vi.fn(async (input: any, init?: any) => {
    const url = new URL(String(input)); calls.push(url.pathname + url.search);
    if (url.pathname === "/oauth/v2/token") return json({ access_token: "tok", expires_in: 3600 });
    if (url.pathname === "/crm/v6/org") return json({ org: [{ id: orgId, company_name: "FACE prep" }] });
    if (url.pathname === "/crm/v6/users") return json({ users: [{ id: "100", full_name: "Asha", email: "a@x.com", role: { name: "ER Associate" }, status: "active" }, { id: "101", full_name: "Boss", role: { name: "Manager" }, status: "active" }] });
    if (url.pathname === "/crm/v6/settings/fields") return json({ fields: (FIELDS[url.searchParams.get("module")!] || []).map((api_name) => ({ api_name })) });
    const m = url.pathname.match(/^\/crm\/v6\/(\w+)$/);
    if (m && DATA[m[1]]) {
      const asked = (url.searchParams.get("fields") || "").split(",");
      const bad = asked.filter((f) => !FIELDS[m[1]].includes(f));
      if (bad.length) return json({ code: "INVALID_DATA", message: "invalid field " + bad[0] }, 400); // proves we only ask for fields that exist
      return json({ data: DATA[m[1]], info: { more_records: false } });
    }
    return json({ error: "unexpected " + url.pathname }, 404);
  }) as any;
});
afterAll(() => { globalThis.fetch = realFetch; });

describe("Zoho sync against a mock Zoho", () => {
  it("syncs every module, tolerating missing fields, and the numbers add up", async () => {
    const summary = await syncAll(60000);
    expect(summary).toContain("org FACE prep"); expect(summary).not.toContain("FAILED");
    const [a] = await q("select * from accounts"); expect(a).toMatchObject({ zoho_id: "a1", owner_id: "100", name_key: "acme" });
    expect((await q("select is_sdr from team_members where zoho_id='100'"))[0].is_sdr).toBe(true);
    expect((await q("select is_sdr from team_members where zoho_id='101'"))[0].is_sdr).toBe(false);
    const sb = await scoreboard("2026-11-05", "2026-11-05");
    expect(sb.rows).toHaveLength(1);
    expect(sb.rows[0]).toMatchObject({ calls: 2, connected: 1, scheduled: 1, held: 1, deals: 1, offers: 2, commit_calls: 60 });
  });
  it("is safe to run twice (no duplicates) and uses the saved cursor", async () => {
    await syncAll(60000);
    expect((await q("select count(*)::int c from calls"))[0].c).toBe(2);
    const cur = (await q("select cursor from sync_state where entity='calls'"))[0].cursor;
    expect(cur).toBe("2026-11-05T10:35:00+05:30");
  });
  it("refuses a different Zoho organisation", async () => {
    orgId = "999";
    await expect(syncAll(10000)).rejects.toThrow(/expected 1363009000000020813/);
    orgId = "1363009000000020813";
  });
  it("records failed jobs and does not crash the runner", async () => {
    orgId = "999";
    const r = await runJob("sync.zoho", "manual");
    expect(r.status).toBe("failed");
    expect((await q("select status from job_runs where job='sync.zoho' order by id desc limit 1"))[0].status).toBe("failed");
    orgId = "1363009000000020813";
  });
});
