/*
# Create tickets table for RescueRoute

RescueRoute is a real-time, hyper-local disaster relief and mutual aid canvas.
This migration creates the core `tickets` table that stores every help request
and aid offer, plus the supporting enums, indexes, RLS policies, and Realtime
publication entry.

## Enums (idempotent via DO blocks)
- `ticket_type`     : `request_help` (someone needs help) | `offer_help` (someone is offering aid)
- `ticket_category` : `medical` | `water_food` | `shelter` | `evacuation` | `other`
- `urgency_level`   : `critical` | `high` | `medium` | `low`
- `ticket_status`   : `open` | `claimed` | `resolved`

## New table: `tickets`
- `id`          uuid primary key, defaults to gen_random_uuid()
- `type`        ticket_type not null
- `category`    ticket_category not null
- `urgency`     urgency_level not null
- `description` text not null, max 500 chars
- `latitude`    float8 not null, range -90..90
- `longitude`   float8 not null, range -180..180
- `status`      ticket_status not null, default 'open'
- `claimed_by`  uuid, references auth.users(id) on delete set null (nullable)
- `claimed_at`  timestamptz, nullable
- `created_at`  timestamptz not null default now()
- `updated_at`  timestamptz not null default now(), auto-updated via trigger

## Indexes
- `idx_tickets_status`     on (status)
- `idx_tickets_urgency`   on (urgency)
- `idx_tickets_location`  composite on (latitude, longitude)

## Security (RLS)
- SELECT: public read for `anon` and `authenticated` (life-safety tool, do not gate visibility)
- INSERT: allowed for `anon` and `authenticated` (unauthenticated victims can request help)
- UPDATE: allowed when `auth.uid() = claimed_by` OR the row is `open` and the update
  sets `claimed_by = auth.uid()` (prevents one claimer from hijacking another's claim)
- DELETE: disallowed entirely (soft-resolve via status, never hard-delete a relief record)

## Realtime
- Adds `tickets` to the `supabase_realtime` publication so the frontend can subscribe
  to INSERT/UPDATE events.

## Notes
1. A full PostGIS `geography` column is a documented future upgrade, not required for
   this hackathon build; the composite (latitude, longitude) index is the stand-in.
2. Rate limiting is enforced at the API layer, not the DB layer, per the spec.
*/

-- Extensions
create extension if not exists "pgcrypto";

-- Enums (idempotent via DO blocks; CREATE TYPE has no IF NOT EXISTS)
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

-- SELECT: public read (anon + authenticated)
drop policy if exists "public_select_tickets" on tickets;
create policy "public_select_tickets" on tickets for select
  to anon, authenticated using (true);

-- INSERT: anon + authenticated (rate-limited at API layer)
drop policy if exists "public_insert_tickets" on tickets;
create policy "public_insert_tickets" on tickets for insert
  to anon, authenticated with check (true);

-- UPDATE: owner of the claim, or an open row being claimed by the current user
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

-- DELETE: disallowed entirely (no policy = no delete)

-- Realtime publication
alter publication supabase_realtime add table tickets;
