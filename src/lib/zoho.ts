// Direct Zoho CRM connection (India data centre). Read by default; writes only when ZOHO_WRITE_ENABLED=true.
const env = () => ({
  id: process.env.ZOHO_CLIENT_ID, secret: process.env.ZOHO_CLIENT_SECRET, refresh: process.env.ZOHO_REFRESH_TOKEN,
  accounts: (process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.in").replace(/\/$/, ""),
  api: (process.env.ZOHO_API_URL || "https://www.zohoapis.in").replace(/\/$/, ""),
  org: process.env.ZOHO_ORG_ID || "",
});
export const zohoConfigured = () => { const c = env(); return !!(c.id && c.secret && c.refresh); };
export const zohoWriteEnabled = () => process.env.ZOHO_WRITE_ENABLED === "true";

const g = globalThis as any;
async function accessToken(): Promise<string> {
  const c = env();
  if (g.__zt && g.__zt.exp > Date.now() + 60000) return g.__zt.token;
  const body = new URLSearchParams({ refresh_token: c.refresh!, client_id: c.id!, client_secret: c.secret!, grant_type: "refresh_token" });
  const res = await fetch(`${c.accounts}/oauth/v2/token`, { method: "POST", body });
  const j: any = await res.json();
  if (!j.access_token) throw new Error("Zoho sign-in failed: " + (j.error || JSON.stringify(j)));
  g.__zt = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return g.__zt.token;
}

export class ZohoError extends Error { constructor(public status: number, msg: string) { super(msg); } }

export async function zfetch(path: string, opts: { method?: string; params?: Record<string, string>; headers?: Record<string, string>; body?: any } = {}) {
  const c = env();
  const url = new URL(c.api + path);
  Object.entries(opts.params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: opts.method || "GET",
      headers: { Authorization: `Zoho-oauthtoken ${await accessToken()}`, "Content-Type": "application/json", ...(opts.headers || {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 204) return { data: [], info: {} } as any;
    if (res.status === 401) { g.__zt = null; continue; }
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
    const text = await res.text();
    let j: any; try { j = JSON.parse(text); } catch { j = { raw: text }; }
    if (!res.ok) throw new ZohoError(res.status, `Zoho ${res.status} on ${path}: ${j.message || j.code || text.slice(0, 200)}`);
    return j;
  }
  throw new ZohoError(429, "Zoho is rate limiting requests. Try again later.");
}

/** Confirms we are talking to the FACE prep org and not another one (for example Kalvium's). */
export async function verifyOrg() {
  const j = await zfetch("/crm/v6/org");
  const o = j.org?.[0] || {};
  const expected = env().org;
  if (expected && String(o.id) !== expected) throw new Error(`Connected Zoho org is ${o.id} (${o.company_name}), expected ${expected}. Sync stopped.`);
  return { id: String(o.id), name: o.company_name as string };
}

const fieldCache = new Map<string, Set<string>>();
export async function moduleFields(module: string) {
  if (fieldCache.has(module)) return fieldCache.get(module)!;
  const j = await zfetch("/crm/v6/settings/fields", { params: { module } });
  const s = new Set<string>((j.fields || []).map((f: any) => f.api_name));
  fieldCache.set(module, s);
  return s;
}

/** Pages of records changed since `since`, oldest first. Only requests fields that exist in the module. */
export async function* recordPages(module: string, wanted: string[], since?: string, maxPages = 10) {
  const have = await moduleFields(module);
  const fields = wanted.filter((f) => have.has(f));
  if (!fields.length) throw new Error(`No usable fields found for Zoho module ${module}`);
  let pageToken: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const params: Record<string, string> = { fields: fields.join(","), per_page: "200", sort_by: "Modified_Time", sort_order: "asc" };
    if (pageToken) params.page_token = pageToken;
    const j = await zfetch(`/crm/v6/${module}`, { params, headers: since ? { "If-Modified-Since": since } : {} });
    const data = j.data || [];
    if (data.length) yield { data, more: !!j.info?.more_records };
    if (!j.info?.more_records || !j.info?.next_page_token) return;
    pageToken = j.info.next_page_token;
  }
}

export async function listUsers() {
  const j = await zfetch("/crm/v6/users", { params: { type: "AllUsers" } });
  return (j.users || []) as any[];
}

export async function updateRecords(module: string, rows: { id: string; [k: string]: any }[]) {
  if (!zohoWriteEnabled()) throw new Error("Writes to Zoho are switched off (ZOHO_WRITE_ENABLED is not true).");
  const out: any[] = [];
  for (let i = 0; i < rows.length; i += 100) {
    const j = await zfetch(`/crm/v6/${module}`, { method: "PUT", body: { data: rows.slice(i, i + 100) } });
    out.push(...(j.data || []));
  }
  return out;
}
