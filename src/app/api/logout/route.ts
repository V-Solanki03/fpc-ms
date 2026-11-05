import { NextRequest, NextResponse } from "next/server";
import { COOKIE } from "@/lib/auth";
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  res.cookies.delete(COOKIE);
  return res;
}
