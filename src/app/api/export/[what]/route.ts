import { NextRequest, NextResponse } from "next/server";
import { scoreboard } from "@/lib/metrics";
import { rangeFor, istDate, type Period } from "@/lib/dates";
import { csvCell } from "@/lib/util";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";
const csv = (name: string, rows: any[][]) => new NextResponse(rows.map((r) => r.map(csvCell).join(",")).join("\n"), { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${name}.csv"` } });
export async function GET(req: NextRequest, { params }: { params: Promise<{ what: string }> }) {
  const { what } = await params;
  const p = (req.nextUrl.searchParams.get("p") || "today") as Period;
  if (what === "scoreboard") {
    const r = rangeFor(p, istDate()); const sb = await scoreboard(r.from, r.to);
    return csv(`scoreboard-${r.from}-${r.to}`, [["SDR", "Calls", "Connected", "Meetings scheduled", "Meetings held", "Deals", "Offers"], ...sb.rows.map((x) => [x.member.name, x.calls, x.connected, x.scheduled, x.held, x.deals, x.offers])]);
  }
  if (what === "drives") {
    const rows = await q("select drive_date::text d, company, sdr, result, owner_team, loss_category, loss_reason, location, ctc, openings, offers, joined from drives order by drive_date desc");
    return csv("drives", [["Date", "Company", "SDR", "Result", "Owner team", "Loss category", "Loss reason", "Location", "CTC", "Openings", "Offers", "Joined"], ...rows.map((x) => Object.values(x))]);
  }
  if (what === "offers") {
    const rows = await q("select student_name, student_email, college, company, role, ctc, status, join_date::text from offers order by company");
    return csv("offers", [["Student", "Email", "College", "Company", "Role", "CTC", "Status", "Join date"], ...rows.map((x) => Object.values(x))]);
  }
  return new NextResponse("Not found", { status: 404 });
}
