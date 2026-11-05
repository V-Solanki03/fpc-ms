import { NextResponse } from "next/server";
import { q } from "@/lib/db";
export const dynamic = "force-dynamic";
/** For uptime monitors. Reveals nothing but whether the app and database answer. */
export async function GET() {
  try { await q("select 1"); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ ok: false }, { status: 503 }); }
}
