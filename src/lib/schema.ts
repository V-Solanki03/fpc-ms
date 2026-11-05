// All tables live here. Migrations are idempotent so a cold start can run them safely.
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_core",
    sql: `
create table if not exists settings(key text primary key, value jsonb not null, updated_at timestamptz default now());

create table if not exists team_members(
  zoho_id text primary key, name text not null, email text, zoho_role text,
  active boolean default true, is_sdr boolean default false,
  in_reports boolean default true, in_commitments boolean default true,
  target_calls int default 60, target_connected int default 15, target_meetings int default 2,
  source text default 'zoho');

create table if not exists accounts(
  zoho_id text primary key, name text not null, name_key text, owner_id text, website text, industry text, phone text,
  created_time timestamptz, modified_time timestamptz, source text default 'zoho', raw jsonb);
create index if not exists accounts_owner on accounts(owner_id);
create index if not exists accounts_key on accounts(name_key);

create table if not exists contacts(
  zoho_id text primary key, name text, email text, phone text, title text, account_id text, owner_id text,
  created_time timestamptz, modified_time timestamptz, source text default 'zoho', raw jsonb);
create index if not exists contacts_account on contacts(account_id);

create table if not exists deals(
  zoho_id text primary key, name text, account_id text, account_name text, owner_id text, stage text, amount numeric,
  closing_date date, created_time timestamptz, modified_time timestamptz, source text default 'zoho', raw jsonb);
create index if not exists deals_owner on deals(owner_id);
create index if not exists deals_created on deals(created_time);
create index if not exists deals_account on deals(account_id);

create table if not exists calls(
  zoho_id text primary key, owner_id text, subject text, call_type text, start_time timestamptz,
  connected boolean default false, result text, who_name text, created_time timestamptz, modified_time timestamptz,
  source text default 'zoho');
create index if not exists calls_owner_time on calls(owner_id, start_time);

create table if not exists events(
  zoho_id text primary key, owner_id text, title text, start_time timestamptz, end_time timestamptz,
  created_time timestamptz, modified_time timestamptz, check_in_status text, source text default 'zoho');
create index if not exists events_owner_start on events(owner_id, start_time);
create index if not exists events_owner_created on events(owner_id, created_time);

create table if not exists commitments(
  id serial primary key, owner_id text not null, day date not null,
  calls int, connected int, meetings_scheduled int, meetings_to_conduct int, upcoming_deals int, offer_letters int,
  kind text default 'Daily', source text default 'app', submitted_at timestamptz, updated_at timestamptz default now(),
  unique(owner_id, day));

create table if not exists holidays(day date primary key, name text);

create table if not exists sync_state(
  entity text primary key, cursor text, last_sync timestamptz, record_count int default 0, last_error text, last_duration_ms int);

create table if not exists job_runs(
  id serial primary key, job text not null, triggered_by text, started_at timestamptz default now(), finished_at timestamptz,
  status text default 'running', summary text, error text);
create index if not exists job_runs_job on job_runs(job, started_at desc);

create table if not exists email_outbox(
  id serial primary key, created_at timestamptz default now(), kind text, to_list text[], cc_list text[],
  subject text, html text, body text, status text default 'preview', sent_at timestamptz, error text, dedupe_key text unique);

create table if not exists notifications(
  id serial primary key, created_at timestamptz default now(), kind text, title text, body text, link text, read boolean default false);

create table if not exists audit_log(
  id serial primary key, at timestamptz default now(), actor text, action text, entity text, entity_id text, before jsonb, after jsonb);

create table if not exists hygiene_issues(
  id serial primary key, kind text not null, key text unique not null, entity text, owner_id text, summary text,
  detail jsonb, fix jsonb, status text default 'open', first_seen timestamptz default now(), last_seen timestamptz default now(),
  resolved_at timestamptz, decided_by text, decided_at timestamptz);
`,
  },
  {
    id: "002_placement",
    sql: `
create table if not exists students(
  email text primary key, name text, phone text, college text, dept text, preference text, batch text, sheet_placed boolean,
  source text default 'import');
create index if not exists students_college on students(college);

create table if not exists drives(
  id serial primary key, drive_date date, company text not null, sdr text, result text default 'Open', outcome text,
  owner_team text, loss_category text, loss_reason text, summary text, location text, ctc text, stipend text,
  openings int default 0, offers int default 0, joined int default 0, notes text, source text default 'import',
  unique(company, drive_date));

create table if not exists drive_roles(
  id serial primary key, drive_id int references drives(id) on delete cascade, role text, role_type text,
  openings int, status text, offers int, joined int, feedback text, detail text);

create table if not exists offers(
  id serial primary key, student_email text, student_name text, college text, company text not null, role text,
  ctc text, stipend text, offer_date date, join_date date, status text default 'Offered', owner text, drive_id int,
  source text default 'import', unique(student_email, company, role));
create index if not exists offers_email on offers(student_email);

create table if not exists candidates(
  id serial primary key, email text unique, name text, phone text, college text, dept text, preference text,
  skills text, assessment_score numeric, consent boolean default false, status text default 'Available', tags text,
  notes text, source text default 'import', created_at timestamptz default now());

create table if not exists profile_packs(
  id serial primary key, title text, company text, created_at timestamptz default now(), share_token text unique,
  expires_at timestamptz, status text default 'Draft', created_by text);
create table if not exists pack_items(pack_id int references profile_packs(id) on delete cascade, candidate_id int references candidates(id) on delete cascade, primary key(pack_id, candidate_id));
`,
  },
];
