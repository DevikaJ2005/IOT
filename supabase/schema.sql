-- Run this once in the Supabase SQL editor to set up the required tables.
--
-- Supabase's newer default (rolled out May 2026) no longer auto-exposes
-- tables created via the SQL editor to the Data API, and any table the
-- API can reach must have Row Level Security enabled. The GRANT and
-- POLICY statements below are what let the Python app actually read and
-- write these tables with your anon key - without them you'll get a
-- "permission denied" or "table not found" error even though the table
-- exists.

create table employees (
    id bigint generated always as identity primary key,
    name text not null,
    encoding jsonb not null,
    created_at timestamptz not null default now()
);

create table access_log (
    id bigint generated always as identity primary key,
    identity text not null default '',
    status text not null,
    alarm text not null,
    event_time timestamptz not null default now()
);

-- Expose both tables to the Data API roles that supabase-py uses.
grant select, insert, update, delete on employees to anon, authenticated;
grant select, insert, update, delete on access_log to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Supabase requires RLS on any table reachable through the Data API.
-- A single permissive policy is fine here - this is a single-device
-- college prototype using one shared anon key, not a multi-user app.
-- Tighten these policies before using the project beyond a personal demo.
alter table employees enable row level security;
alter table access_log enable row level security;

create policy "Allow all access (prototype)" on employees
    for all using (true) with check (true);

create policy "Allow all access (prototype)" on access_log
    for all using (true) with check (true);
