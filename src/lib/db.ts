import { MIGRATIONS } from "./schema";

type Db = { query: (sql: string, params?: any[]) => Promise<any[]>; exec: (sql: string) => Promise<void>; kind: "pg" | "pglite" };
const g = globalThis as any;

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
    return { kind: "pg", query: async (s, p) => (await pool.query(s, p)).rows, exec: async (s) => { await pool.query(s); } };
  }
  if (process.env.VERCEL) throw new Error("DATABASE_URL is not set. Add a Postgres connection string in Vercel > Settings > Environment Variables.");
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR === "memory" ? undefined : process.env.PGLITE_DIR || ".data/pglite";
  if (dir) (await import("fs")).mkdirSync(dir, { recursive: true });
  const lite = dir ? new PGlite(dir) : new PGlite();
  await lite.waitReady;
  return { kind: "pglite", query: async (s, p) => (await lite.query(s, p)).rows as any[], exec: async (s) => { await lite.exec(s); } };
}

async function init(): Promise<Db> {
  const db = await open();
  await db.exec("create table if not exists _migrations(id text primary key, at timestamptz default now())");
  const done = new Set((await db.query("select id from _migrations")).map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await db.exec(m.sql);
    await db.query("insert into _migrations(id) values($1) on conflict do nothing", [m.id]);
  }
  return db;
}

export function getDb(): Promise<Db> {
  if (!g.__fpcms_db) {
    g.__fpcms_db = init().catch((e) => { g.__fpcms_db = null; throw e; });
  }
  return g.__fpcms_db;
}

export async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return (await getDb()).query(sql, params) as Promise<T[]>;
}
export async function one<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return (await q<T>(sql, params))[0];
}

/** Multi-row upsert. `cols` are column names, rows are arrays in the same order. */
export async function upsertMany(table: string, cols: string[], rows: any[][], conflict: string | string[], opts: { skipUpdate?: string[]; chunk?: number } = {}) {
  if (!rows.length) return 0;
  const chunk = opts.chunk ?? Math.max(1, Math.floor(30000 / cols.length));
  const keys = Array.isArray(conflict) ? conflict : [conflict];
  const upd = cols.filter((c) => !keys.includes(c) && !(opts.skipUpdate || []).includes(c));
  let n = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params: any[] = [];
    const values = part.map((r) => "(" + r.map((v) => { params.push(v === undefined ? null : v); return "$" + params.length; }).join(",") + ")").join(",");
    const set = upd.length ? "do update set " + upd.map((c) => `${c}=excluded.${c}`).join(",") : "do nothing";
    await q(`insert into ${table}(${cols.join(",")}) values ${values} on conflict(${keys.join(",")}) ${set}`, params);
    n += part.length;
  }
  return n;
}
