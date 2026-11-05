import { NextRequest, NextResponse } from "next/server";
import { runJob } from "@/lib/jobs";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const { job } = await params;
  try { return NextResponse.json(await runJob(job, "schedule")); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
