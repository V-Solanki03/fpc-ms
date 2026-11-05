"use client";
import { useActionState } from "react";
import { uploadImport } from "@/app/actions";

export function ImportForm() {
  const [res, action, pending] = useActionState(uploadImport, null);
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm"><span className="mb-1 block text-xs font-medium text-muted">This file contains</span>
        <select name="kind" className="input" required defaultValue="roster"><option value="roster">FPC student roster</option><option value="offers">Offers</option><option value="drives">Campus drive tracker</option><option value="candidates">Candidates (talent pool)</option></select></label>
      <label className="block text-sm"><span className="mb-1 block text-xs font-medium text-muted">Excel or CSV file</span><input className="input" type="file" name="file" accept=".xlsx,.xls,.csv" required /></label>
      <label className="block text-sm"><span className="mb-1 block text-xs font-medium text-muted">Tab name (optional, first tab is used if empty)</span><input className="input" name="tab" placeholder="MASTER SHEET" /></label>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Importing…" : "Import"}</button>
      {res && "error" in res && <p className="rounded-lg bg-bad/10 p-3 text-sm text-bad">{res.error}</p>}
      {res && "saved" in res && (
        <div className="rounded-lg bg-good/10 p-3 text-sm"><b>Imported {res.saved} records</b> from {res.rows} rows{res.skipped ? `, skipped ${res.skipped}` : ""}.
          {res.warnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-muted">{res.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}</div>
      )}
    </form>
  );
}
