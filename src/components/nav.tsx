"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const GROUPS: { title: string; items: [string, string][] }[] = [
  { title: "Team", items: [["/", "Dashboard"], ["/scoreboard", "Scoreboard"], ["/my-day", "My Day"]] },
  { title: "CRM", items: [["/accounts", "Accounts"], ["/pipeline", "Pipeline"], ["/hygiene", "CRM Hygiene"]] },
  { title: "Campus", items: [["/drives", "Drives"], ["/placement", "FPC Placement"], ["/candidates", "Candidates"], ["/packs", "Profile packs"]] },
  { title: "Operations", items: [["/reports", "Reports"], ["/automations", "Automations"], ["/import", "Import data"], ["/sync", "Integrations"], ["/settings", "Settings"]] },
];
export function Nav({ badge }: { badge: Record<string, number> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <>
      <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-3 md:hidden">
        <span className="font-bold">FPC-MS</span>
        <button className="btn" onClick={() => setOpen(!open)} aria-expanded={open}>Menu</button>
      </div>
      <aside className={`${open ? "block" : "hidden"} w-full shrink-0 border-r border-line bg-panel md:block md:w-56`}>
        <div className="sticky top-0 max-h-screen overflow-y-auto p-3">
          <div className="hidden px-2 pb-3 pt-2 md:block"><div className="text-lg font-bold tracking-tight">FPC-MS</div><div className="text-xs text-muted">FACE Prep Campus</div></div>
          {GROUPS.map((g) => (
            <div key={g.title} className="mb-3">
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</div>
              {g.items.map(([h, l]) => (
                <Link key={h} href={h} onClick={() => setOpen(false)} className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${active(h) ? "bg-brand/15 font-semibold text-brand" : "hover:bg-soft"}`}>
                  <span>{l}</span>{badge[h] ? <span className="rounded-full bg-bad px-1.5 text-[11px] font-semibold text-white">{badge[h]}</span> : null}
                </Link>
              ))}
            </div>
          ))}
          <form action="/api/logout" method="post"><button className="btn mt-2 w-full justify-center text-xs">Sign out</button></form>
        </div>
      </aside>
    </>
  );
}
