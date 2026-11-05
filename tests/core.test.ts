import { describe, it, expect, beforeAll } from "vitest";
process.env.PGLITE_DIR = "memory";
import * as XLSX from "xlsx";
import { q } from "../src/lib/db";
import { nameKey } from "../src/lib/util";
import { addDays, startOfWeek, rangeFor, isWeekend } from "../src/lib/dates";
import { classifyLoss, fpcMetrics, prefGroup } from "../src/lib/placement";
import { importWorkbook } from "../src/lib/importers";
import { scoreboard, metricsByDay, workingDays } from "../src/lib/metrics";
import { scan } from "../src/lib/hygiene";
import { buildSdrDaily, sendSdrDaily } from "../src/lib/reports";
import { queueEmail } from "../src/lib/mail";

function wb(rows: any[][], sheet = "Sheet1") {
  const w = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet(rows), sheet);
  return XLSX.write(w, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("helpers", () => {
  it("matches company spelling variants", () => {
    expect(nameKey("Acme Pvt. Ltd")).toBe(nameKey("ACME Private Limited"));
    expect(nameKey("DUP - Acme Technologies")).toBe(nameKey("Acme"));
  });
  it("does date maths in whole days", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(startOfWeek("2026-11-05")).toBe("2026-11-02");
    expect(isWeekend("2026-11-07")).toBe(true);
    expect(rangeFor("week", "2026-11-05")).toMatchObject({ from: "2026-11-02", to: "2026-11-05" });
  });
  it("groups preferences without trusting PREFERENCE CATEGORY", () => {
    expect(prefGroup("Non-Technical")).toBe("Non-Tech"); expect(prefGroup("Tech Support")).toBe("Tech Support"); expect(prefGroup("Technical")).toBe("Technical");
  });
  it("classifies drive losses from feedback", () => {
    expect(classifyLoss("College rejected.").team).toBe("Academic");
    expect(classifyLoss("Company didn't respond.", "followup through whatsapp").team).toBe("Company");
    expect(classifyLoss("Company didn't respond.").team).toBe("ERT");
    expect(classifyLoss("Company rejected candidates.").team).toBe("Delivery");
  });
});

describe("metrics on known data", () => {
  beforeAll(async () => {
    await q("insert into team_members(zoho_id,name,is_sdr,in_reports,active) values('u1','Asha',true,true,true),('u2','Ben',true,true,true),('u3','Old',true,true,false)");
    // IST day boundary: 23:50 IST on the 4th belongs to the 4th, 00:10 IST on the 5th belongs to the 5th.
    await q(`insert into calls(zoho_id,owner_id,start_time,connected,result) values
      ('c1','u1','2026-11-04T23:50:00+05:30',true,'Interested'),('c2','u1','2026-11-05T00:10:00+05:30',true,'Interested'),
      ('c3','u1','2026-11-05T10:00:00+05:30',false,'Busy'),('c4','u2','2026-11-05T11:00:00+05:30',true,'Invalid number')`);
    await q(`insert into events(zoho_id,owner_id,start_time,created_time,check_in_status) values
      ('e1','u1','2026-11-05T15:00:00+05:30','2026-11-02T10:00:00+05:30','VISITED'),('e2','u1','2026-11-06T15:00:00+05:30','2026-11-05T09:00:00+05:30',null)`);
    await q(`insert into deals(zoho_id,name,account_id,owner_id,stage,amount,created_time,modified_time) values
      ('d1','Acme drive','a1','u1','Closed Won',3,'2026-10-20T10:00:00+05:30','2026-11-05T12:00:00+05:30'),
      ('d2','Beta drive','a2','u2','Drive Identified',null,'2026-11-05T10:00:00+05:30','2026-11-05T10:00:00+05:30'),
      ('d3','Old drive','a3','u1','Interview',null,'2026-08-01T10:00:00+05:30','2026-08-01T10:00:00+05:30'),
      ('d4','Gamma - Drive','a4','u1','Drive Identified',null,'2026-08-01T10:00:00+05:30','2026-11-01T10:00:00+05:30'),
      ('d5','Gamma Drive','a4','u1','Drive Identified',null,'2026-08-01T10:00:00+05:30','2026-11-01T10:00:00+05:30')`);
    await q(`insert into accounts(zoho_id,name,name_key,owner_id) values('a1','Acme','acme','u3'),('dup','DUP - Acme','acme','u1')`);
    await q(`insert into deals(zoho_id,name,account_id,owner_id,stage,created_time,modified_time) values('dd','Acme dup deal','dup','u1','Interview','2026-09-01T10:00:00+05:30','2026-11-05T09:00:00+05:30')`);
  });
  it("counts calls by India calendar day", async () => {
    const rows = await metricsByDay("2026-11-05", "2026-11-05");
    const asha = rows.find((r) => r.owner_id === "u1")!;
    expect(asha.calls).toBe(2); expect(asha.connected).toBe(1);
    expect((await metricsByDay("2026-11-04", "2026-11-04")).find((r) => r.owner_id === "u1")!.calls).toBe(1);
  });
  it("counts meetings scheduled by created date and held by start date and VISITED", async () => {
    const a = (await metricsByDay("2026-11-05", "2026-11-05")).find((r) => r.owner_id === "u1")!;
    expect(a.scheduled).toBe(1); expect(a.held).toBe(1);
  });
  it("counts deals created and offers from closed-won deals", async () => {
    const t = (await scoreboard("2026-11-05", "2026-11-05")).total;
    expect(t.deals).toBe(1); expect(t.offers).toBe(3);
  });
  it("skips weekends and holidays in working days", async () => {
    await q("insert into holidays(day,name) values('2026-11-05','Test')");
    expect(await workingDays("2026-11-02", "2026-11-08")).toBe(4);
    await q("delete from holidays");
    expect(await workingDays("2026-11-02", "2026-11-08")).toBe(5);
  });
  it("leaves inactive people out of the scoreboard", async () => {
    const sb = await scoreboard("2026-11-05", "2026-11-05");
    expect(sb.rows.map((r) => r.member.name).sort()).toEqual(["Asha", "Ben"]);
  });
  it("finds the six kinds of hygiene issue and resolves them when fixed", async () => {
    const r = await scan();
    const kinds = (await q("select distinct kind from hygiene_issues")).map((x) => x.kind);
    expect(kinds).toEqual(expect.arrayContaining(["dup_account", "stale_deal", "contradictory_call", "orphan", "dup_deal"]));
    expect(r.found).toBeGreaterThan(4);
    await q("delete from calls where zoho_id='c4'");
    const r2 = await scan();
    expect(r2.resolved).toBeGreaterThanOrEqual(1);
  });
  it("builds the daily email with a total row and saves it once per day", async () => {
    const b = await buildSdrDaily("2026-11-05");
    expect(b.subject).toBe("DAILY SDR DASHBOARD 5 November (FACEPREP)"); expect(b.html).toContain("Total");
    const first = await sendSdrDaily("2026-11-05"); const second = await sendSdrDaily("2026-11-05");
    expect(first.status).toBe("preview"); expect(second.status).toBe("duplicate");
  });
});

describe("imports", () => {
  it("imports roster, offers with merged cells, and matches placed by email", async () => {
    await importWorkbook("roster", wb([["Name", "Email", "College", "Department", "PREFERENCE", "PREFERENCE CATEGORY", "PLACED"],
      ["Ravi K", "ravi@x.com", "Alpha College", "BCA", "Non-Technical", "TECH", "No"], ["Sita M", "sita@x.com", "Alpha College", "BCA", "Technical", "TECH", "Yes"], ["Tom P", "tom@x.com", "Beta College", "MCA", "Tech Support", "TECH", "No"]], "MASTER SHEET"));
    await importWorkbook("offers", wb([["Date", "Owner", "Company", "Student Name", "Email", "Role", "Status"],
      ["2026-10-01", "Armaan", "Acme", "Ravi K", "RAVI@x.com", "QA", "Joined"], ["", "", "", "Tom P", "", "Support", "Offered"]]));
    const m = await fpcMetrics();
    const alpha = m.rows.find((r) => r.college === "Alpha College")!;
    expect(alpha.total).toBe(2); expect(alpha.placed).toBe(1); // Sita's own PLACED=Yes is ignored; Ravi matched by email
    expect(alpha.nontech).toEqual([1, 1]); // PREFERENCE used, not the category column
    expect(m.rows.find((r) => r.college === "Beta College")!.placed).toBe(1); // matched by name because the offer row has no email
    const again = await importWorkbook("offers", wb([["Date", "Owner", "Company", "Student Name", "Email", "Role", "Status"], ["2026-10-01", "Armaan", "Acme", "Ravi K", "ravi@x.com", "QA", "Joined"]]));
    expect(again.saved).toBe(1); expect((await q("select count(*)::int c from offers where student_email='ravi@x.com'"))[0].c).toBe(1);
  });
  it("imports the drive tracker, fills merged cells, groups roles and classifies results", async () => {
    const rep = await importWorkbook("drives", wb([
      ["Sr", "SDR", "Date", "Company", "Type", "Role", "Openings", "Status", "Location", "Stipend", "CTC", "Offers", "Joined", "FB", "Detail"],
      ["1", "Armaan", "2026-07-16", "Stellaraa", "Non - Technical", "Sales", 3, "Offers Received", "Salem", 21000, "3 - 6 LPA", 4, 0, "Candidate refused to join", ""],
      ["", "", "", "", "Technical", "Web Intern", 5, "Close", "", 12000, "", "", "", "Company rejected candidates.", ""],
      ["2", "Ipshita", "17/07/2026", "Chez IT", "Non - Technical", "Digital Marketing", 1, "Close", "Chennai", 12000, "", "", "", "College rejected.", "did not want digital marketing"]]));
    expect(rep.saved).toBe(2);
    const d = await q("select company,result,offers,openings,owner_team from drives order by company");
    expect(d.find((x) => x.company === "Stellaraa")).toMatchObject({ result: "Won", offers: 4, openings: 8 });
    expect(d.find((x) => x.company === "Chez IT")).toMatchObject({ result: "Lost", owner_team: "Academic" });
    expect((await q("select count(*)::int c from drive_roles"))[0].c).toBe(3);
  });
});
