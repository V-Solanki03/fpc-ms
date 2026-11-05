import { getSetting } from "@/lib/settings";
import type { SheetSource } from "@/lib/jobs";
import { IMPORT_LABEL } from "@/lib/importers";
import { PageHeader, Card, Notice } from "@/components/ui";
import { ImportForm } from "./form";
import { saveSheetSources } from "@/app/actions";

export default async function Import() {
  const src = (((await getSetting("sheet_sources" as any)) as unknown as SheetSource[]) || []).concat([{ kind: "roster", url: "" }, { kind: "offers", url: "" }]);
  return (
    <>
      <PageHeader title="Import data" sub="Bring in the FPC roster, offers, campus drive tracker and candidates from Excel or Google Sheets. Re-importing the same file updates records and never duplicates them." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Upload a file"><ImportForm /></Card>
        <Card title="Linked Google Sheets (refreshed hourly)">
          <p className="mb-3 text-sm text-muted">Paste a sheet link and set sharing to <b>Anyone with the link can view</b>. No Google Cloud setup is needed. If your Workspace blocks link sharing, use file upload instead.</p>
          <form action={saveSheetSources} className="space-y-2">
            {src.map((s, i) => (
              <div key={i} className="grid grid-cols-6 gap-2">
                <select name="kind" defaultValue={s.kind} className="input col-span-2" aria-label="Contents">{Object.entries(IMPORT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <input name="url" defaultValue={s.url} placeholder="Sheet link" className="input col-span-3" aria-label="Sheet link" />
                <input name="tab" defaultValue={s.tab || ""} placeholder="Tab" className="input" aria-label="Tab name" />
              </div>
            ))}
            <button className="btn btn-primary">Save links</button>
          </form>
          <Notice tone="brand"><span className="mt-0 block pt-2 text-xs">Known tabs: roster is <code>MASTER SHEET</code>, offers is <code>Sheet1</code> (merged date, owner and company cells are filled down automatically).</span></Notice>
        </Card>
      </div>
      <Card title="What each file needs" className="mt-5">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li><b>Roster:</b> name, email, college, department, PREFERENCE.</li>
          <li><b>Offers:</b> company, student name, email, role, status, joining date (date, owner and company can be merged cells).</li>
          <li><b>Drive tracker:</b> sr, SDR, date, company, role, openings, status, location, stipend, CTC, offers, joined, feedback (the "fb" column) and detail.</li>
          <li><b>Candidates:</b> name, email, college, department, preference, skills, score, consent (yes or no).</li>
          <li>Column names are matched loosely (capital letters and spaces do not matter). The first row with three or more filled cells is read as the header.</li>
        </ul>
      </Card>
    </>
  );
}
