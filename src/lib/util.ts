export const n = (v: any) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
export const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
/** Normalised company key so "Acme Pvt. Ltd" and "ACME Private Limited" match. */
export function nameKey(s: string | null | undefined) {
  return String(s || "")
    .toLowerCase()
    .replace(/^dup\s*-\s*/, "")
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(private|pvt|limited|ltd|llp|inc|llc|technologies|technology|solutions|software|systems|services|india|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}
export function safeJson<T>(s: string | null | undefined, d: T): T { try { return s ? JSON.parse(s) : d; } catch { return d; } }
export function csvCell(v: any) { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
