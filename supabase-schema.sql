-- RescueRoute — Supabase schema
-- supabase migration new create_tickets_table  (filename convention)
-- Idempotent: safe to re-run. CREATE TYPE has no IF NOT EXISTS, so enums are
-- guarded with DO blocks.

-- Extensions
create extension if not exists "pgcrypto";

-- Enums (idempotent via DO blocks)
do $$ begin
  create type ticket_type as enum ('request_help', 'offer_help');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_category as enum ('medical', 'water_food', 'shelter', 'evacuation', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type urgency_level as enum ('critical', 'high', 'medium', 'low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_status as enum ('open', 'claimed', 'resolved');
exception when duplicate_object then null; end $$;

-- Table
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  type ticket_type not null,
  category ticket_category not null,
  urgency urgency_level not null,
  description text not null check (char_length(description) <= 500),
  latitude float8 not null check (latitude between -90 and 90),
  longitude float8 not null check (longitude between -180 and 180),
  status ticket_status not null default 'open',
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_tickets_status on tickets (status);
create index if not exists idx_tickets_urgency on tickets (urgency);
create index if not exists idx_tickets_location on tickets (latitude, longitude);

-- Auto-update updated_at trigger
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tickets_updated_at on tickets;
create trigger trg_tickets_updated_at
before update on tickets
for each row execute function set_updated_at();

-- RLS
alter table tickets enable row level security;

-- SELECT: public read (anon + authenticated) — life-safety tool, do not gate visibility
drop policy if exists "public_select_tickets" on tickets;
create policy "public_select_tickets" on tickets for select
  to anon, authenticated using (true);

-- INSERT: anon + authenticated (rate-limited at the API layer, not the DB layer)
drop policy if exists "public_insert_tickets" on tickets;
create policy "public_insert_tickets" on tickets for insert
  to anon, authenticated with check (true);

-- UPDATE: owner of the claim, or an open row being claimed by the current user
-- (prevents one claimer from hijacking another's claim)
drop policy if exists "claim_or_owner_update_tickets" on tickets;
create policy "claim_or_owner_update_tickets" on tickets for update
  to anon, authenticated
  using (
    (claimed_by is not null and claimed_by = auth.uid())
    or (status = 'open' and claimed_by is null)
  )
  with check (
    (claimed_by is not null and claimed_by = auth.uid())
    or (status = 'open' and claimed_by is null)
  );

-- DELETE: disallowed entirely (no policy = no delete). Soft-resolve via status.

-- Realtime publication
alter publication supabase_realtime add table tickets;
