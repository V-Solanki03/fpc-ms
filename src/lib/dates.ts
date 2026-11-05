export const TZ = "Asia/Kolkata";
export const istDate = (d: Date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
export function addDays(ymd: string, n: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export const dow = (ymd: string) => new Date(ymd + "T00:00:00Z").getUTCDay(); // 0=Sun
export const isWeekend = (ymd: string) => [0, 6].includes(dow(ymd));
export const startOfWeek = (ymd: string) => addDays(ymd, -((dow(ymd) + 6) % 7));
export const startOfMonth = (ymd: string) => ymd.slice(0, 8) + "01";
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}
export function longDate(ymd: string) {
  return new Date(ymd + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}
export function shortDate(ymd: string) {
  return new Date(ymd + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
export type Period = "today" | "yesterday" | "week" | "month" | "30d" | "custom";
export function rangeFor(period: Period, today = istDate(), from?: string, to?: string): { from: string; to: string; label: string } {
  switch (period) {
    case "yesterday": { const y = addDays(today, -1); return { from: y, to: y, label: "Yesterday" }; }
    case "week": return { from: startOfWeek(today), to: today, label: "This week" };
    case "month": return { from: startOfMonth(today), to: today, label: "This month" };
    case "30d": return { from: addDays(today, -29), to: today, label: "Last 30 days" };
    case "custom": return { from: from || today, to: to || today, label: `${from} to ${to}` };
    default: return { from: today, to: today, label: "Today" };
  }
}
export function timeAgo(d: Date | string | null | undefined) {
  if (!d) return "never";
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  return Math.floor(s / 86400) + " d ago";
}
export function fmtTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
