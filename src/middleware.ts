import { NextRequest, NextResponse } from "next/server";
import { COOKIE, authRequired, sessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (p.startsWith("/api/cron/") || p.startsWith("/share/") || p === "/login") return NextResponse.next(); // cron has its own secret, share links have tokens
  if (!authRequired()) {
    if (process.env.VERCEL) return new NextResponse("FPC-MS is locked: set APP_PASSWORD in Vercel > Settings > Environment Variables, then redeploy.", { status: 503 });
    return NextResponse.next();
  }
  const ok = req.cookies.get(COOKIE)?.value === (await sessionToken());
  if (ok) return NextResponse.next();
  if (p.startsWith("/api/")) return new NextResponse("Unauthorized", { status: 401 });
  const url = req.nextUrl.clone(); url.pathname = "/login"; url.search = "";
  return NextResponse.redirect(url);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
