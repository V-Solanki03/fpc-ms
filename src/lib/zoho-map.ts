import { nameKey } from "./util";

const own = (r: any) => (r.Owner && typeof r.Owner === "object" ? String(r.Owner.id) : r.Owner ? String(r.Owner) : null);
const lk = (v: any) => (v && typeof v === "object" ? { id: v.id ? String(v.id) : null, name: v.name ?? null } : { id: null, name: v ?? null });
const yes = (v: any) => v === true || /^(yes|true|connected)$/i.test(String(v ?? ""));
const ts = (v: any) => (v ? String(v) : null);

export const ENTITIES = {
  accounts: {
    module: "Accounts", table: "accounts", sinceDays: 0,
    fields: ["Account_Name", "Owner", "Website", "Industry", "Phone", "Created_Time", "Modified_Time"],
    cols: ["zoho_id", "name", "name_key", "owner_id", "website", "industry", "phone", "created_time", "modified_time", "source"],
    map: (r: any) => [String(r.id), r.Account_Name ?? "(no name)", nameKey(r.Account_Name), own(r), r.Website ?? null, r.Industry ?? null, r.Phone ?? null, ts(r.Created_Time), ts(r.Modified_Time), "zoho"],
  },
  contacts: {
    module: "Contacts", table: "contacts", sinceDays: 0,
    fields: ["Full_Name", "Email", "Phone", "Title", "Account_Name", "Owner", "Created_Time", "Modified_Time"],
    cols: ["zoho_id", "name", "email", "phone", "title", "account_id", "owner_id", "created_time", "modified_time", "source"],
    map: (r: any) => [String(r.id), r.Full_Name ?? null, r.Email ?? null, r.Phone ?? null, r.Title ?? null, lk(r.Account_Name).id, own(r), ts(r.Created_Time), ts(r.Modified_Time), "zoho"],
  },
  deals: {
    module: "Deals", table: "deals", sinceDays: 0,
    fields: ["Deal_Name", "Account_Name", "Owner", "Stage", "Amount", "Closing_Date", "Created_Time", "Modified_Time"],
    cols: ["zoho_id", "name", "account_id", "account_name", "owner_id", "stage", "amount", "closing_date", "created_time", "modified_time", "source"],
    map: (r: any) => [String(r.id), r.Deal_Name ?? null, lk(r.Account_Name).id, lk(r.Account_Name).name, own(r), r.Stage ?? null, r.Amount ?? null, r.Closing_Date ?? null, ts(r.Created_Time), ts(r.Modified_Time), "zoho"],
  },
  calls: {
    module: "Calls", table: "calls", sinceDays: 120,
    fields: ["Subject", "Call_Type", "Call_Start_Time", "Call_Connected", "Call_Result", "Who_Id", "Owner", "Created_Time", "Modified_Time"],
    cols: ["zoho_id", "owner_id", "subject", "call_type", "start_time", "connected", "result", "who_name", "created_time", "modified_time", "source"],
    map: (r: any) => [String(r.id), own(r), r.Subject ?? null, r.Call_Type ?? null, ts(r.Call_Start_Time ?? r.Created_Time), yes(r.Call_Connected), r.Call_Result ?? null, lk(r.Who_Id).name, ts(r.Created_Time), ts(r.Modified_Time), "zoho"],
  },
  events: {
    module: "Events", table: "events", sinceDays: 120,
    fields: ["Event_Title", "Start_DateTime", "End_DateTime", "Check_In_Status", "Owner", "Created_Time", "Modified_Time"],
    cols: ["zoho_id", "owner_id", "title", "start_time", "end_time", "created_time", "modified_time", "check_in_status", "source"],
    map: (r: any) => [String(r.id), own(r), r.Event_Title ?? null, ts(r.Start_DateTime), ts(r.End_DateTime), ts(r.Created_Time), ts(r.Modified_Time), r.Check_In_Status ?? null, "zoho"],
  },
} as const;
export type EntityName = keyof typeof ENTITIES;

export const COMMITMENT_FIELDS = ["Commitment_Date", "Calls_Committed", "Connected_Committed", "Meetings_Scheduled", "Meetings_To_Conduct", "Upcoming_Deals_Today", "Offer_Letters_Committed", "Commitment_Type", "Owner"];
export function mapCommitment(r: any) {
  const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));
  return [own(r), r.Commitment_Date, num(r.Calls_Committed), num(r.Connected_Committed), num(r.Meetings_Scheduled), num(r.Meetings_To_Conduct), num(r.Upcoming_Deals_Today), num(r.Offer_Letters_Committed), r.Commitment_Type ?? "Daily", "zoho"];
}

export function mapUser(u: any) {
  const role = u.role?.name ?? null;
  return { zoho_id: String(u.id), name: u.full_name || u.first_name || u.email, email: u.email ?? null, role, active: String(u.status).toLowerCase() === "active" };
}
