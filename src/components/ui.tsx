import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0"><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{sub && <p className="mt-1 max-w-3xl text-sm text-muted">{sub}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export function Card({ title, right, children, className = "", pad = true }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card min-w-0 ${className}`}>
      {(title || right) && <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3"><h2 className="text-sm font-semibold">{title}</h2>{right}</div>}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}
export function Stat({ label, value, sub, tone, href }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "warn" | "bad"; href?: string }) {
  const c = tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "";
  const inner = (<div className="card p-4 h-full"><div className="text-xs font-medium text-muted">{label}</div><div className={`mt-1 text-3xl font-bold tabular-nums ${c}`}>{value}</div>{sub && <div className="mt-1 text-xs text-muted">{sub}</div>}</div>);
  return href ? <Link href={href} className="block hover:opacity-90">{inner}</Link> : inner;
}
const TONES: Record<string, string> = {
  good: "bg-good/15 text-good", warn: "bg-warn/15 text-warn", bad: "bg-bad/15 text-bad", brand: "bg-brand/15 text-brand", muted: "bg-soft text-muted",
};
export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: keyof typeof TONES | string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[tone] || TONES.muted}`}>{children}</span>;
}
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse">
        <thead><tr>{head.map((h, i) => <th key={i} className={`th ${typeof h === "string" && /^[#%]|calls|conn|rate|total|target|goal|count|offers|joined|open/i.test(h) && !/stage|owner|name|college|company/i.test(h) ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <p className="p-6 text-center text-sm text-muted">{empty}</p>}
    </div>
  );
}
export function Progress({ value, max, tone }: { value: number; max: number; tone?: string }) {
  const p = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const c = tone || (p >= 100 ? "bg-good" : p >= 60 ? "bg-brand" : "bg-warn");
  return <div className="h-1.5 w-full rounded-full bg-soft"><div className={`h-1.5 rounded-full ${c}`} style={{ width: p + "%" }} /></div>;
}
export function Tabs({ items, current }: { items: { href: string; label: string; key: string }[]; current: string }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1">
      {items.map((t) => <Link key={t.key} href={t.href} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${t.key === current ? "bg-brand text-white" : "bg-panel border border-line hover:bg-soft"}`}>{t.label}</Link>)}
    </div>
  );
}
export function Notice({ tone = "warn", children }: { tone?: "warn" | "bad" | "good" | "brand"; children: ReactNode }) {
  const c = tone === "bad" ? "border-bad/40 bg-bad/10" : tone === "good" ? "border-good/40 bg-good/10" : tone === "brand" ? "border-brand/40 bg-brand/10" : "border-warn/40 bg-warn/10";
  return <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${c}`}>{children}</div>;
}
export function Empty({ children }: { children: ReactNode }) { return <p className="py-8 text-center text-sm text-muted">{children}</p>; }
export const fmt = (v: any) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("en-IN"));
