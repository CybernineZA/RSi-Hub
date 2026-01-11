-- RSi Hub (Reaper Strategic Industries) — Full Schema (Fresh Install)
-- Paste into Supabase SQL Editor and run.
--
-- If you previously ran a schema that errored part-way through, reset the public schema first:
--   begin;
--   drop schema if exists public cascade;
--   create schema public;
--   grant usage on schema public to postgres, anon, authenticated, service_role;
--   grant all on schema public to postgres, service_role;
--   commit;
-- Then run this file.

begin;

-- Extensions
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type member_role as enum ('recruit','member','officer','high_command','commander');
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_status as enum ('pending','accepted','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type war_status as enum ('active','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type location_type as enum ('yard','seaport','depot','facility','front');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_type as enum ('production','shipping','request');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('open','in_progress','ready','complete','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shipment_mode as enum ('truck','train','boat');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shipment_status as enum ('open','in_transit','complete','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type container_state as enum ('filling','ready','in_transit','delivered');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists regiments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active_war_id uuid null,
  created_at timestamptz not null default now()
);

create table if not exists wars (
  id uuid primary key default gen_random_uuid(),
  regiment_id uuid not null references regiments(id) on delete cascade,
  name text not null,
  status war_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table regiments
    add constraint regiments_active_war_fk
    foreign key (active_war_id) references wars(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  regiment_id uuid not null references regiments(id) on delete cascade,
  discord_id text null,
  discord_name text null,
  display_name text null,
  avatar_url text null,
  timezone text null,
  last_seen_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists memberships (
  profile_id uuid primary key references profiles(id) on delete cascade,
  regiment_id uuid not null references regiments(id) on delete cascade,
  role member_role not null default 'member',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (regiment_id, profile_id)
);

create table if not exists recruit_applications (
  id uuid primary key default gen_random_uuid(),
  regiment_id uuid not null references regiments(id) on delete cascade,
  discord_user_id text not null,
  discord_name text not null,
  timezone text null,
  typical_play_times text null,
  experience_level text null,
  notes text null,
  status application_status not null default 'pending',
  reviewed_by uuid null references profiles(id) on delete set null,
  reviewed_at timestamptz null,
  review_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (regiment_id, discord_user_id)
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text null,
  unit text not null default 'crate',
  crate_size int null,
  slot_count int not null default 1,
  is_active boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  war_id uuid not null references wars(id) on delete cascade,
  name text not null,
  type location_type not null,
  region text null,
  grid_ref text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists yards (
  id uuid primary key default gen_random_uuid(),
  war_id uuid not null references wars(id) on delete cascade,
  name text not null,
  location_id uuid not null references locations(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  war_id uuid not null references wars(id) on delete cascade,
  type order_type not null default 'production',
  title text not null,
  status order_status not null default 'open',
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  item_id uuid not null references items(id) on delete restrict,
  qty_required int not null check (qty_required > 0),
  qty_done int not null default 0 check (qty_done >= 0),
  created_at timestamptz not null default now(),
  unique (order_id, item_id)
);

create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  war_id uuid not null references wars(id) on delete cascade,
  mode shipment_mode not null default 'truck',
  status shipment_status not null default 'open',
  from_location_id uuid null references locations(id) on delete set null,
  to_location_id uuid not null references locations(id) on delete restrict,
  route_notes text null,
  created_by uuid not null references profiles(id) on delete restrict,
  departed_at timestamptz null,
  arrived_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  actor_id uuid null references profiles(id) on delete set null,
  event_type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists containers (
  id uuid primary key default gen_random_uuid(),
  war_id uuid not null references wars(id) on delete cascade,
  yard_id uuid null references yards(id) on delete set null,
  label text not null,
  state container_state not null default 'filling',
  max_slots int not null default 60 check (max_slots > 0),
  current_slots int not null default 0 check (current_slots >= 0),
  assigned_shipment_id uuid null references shipments(id) on delete set null,
  archived_at timestamptz null,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (war_id, yard_id, label)
);

create table if not exists container_items (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references containers(id) on delete cascade,
  item_id uuid not null references items(id) on delete restrict,
  qty_required int not null check (qty_required > 0),
  qty_done int not null default 0 check (qty_done >= 0),
  slot_count int not null default 1 check (slot_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (container_id, item_id)
);

-- -----------------------------------------------------------------------------
-- Updated-at trigger
-- -----------------------------------------------------------------------------

drop function if exists public.set_updated_at() cascade;

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers (idempotent)
do $$ begin
  create trigger wars_set_updated_at before update on wars for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger profiles_set_updated_at before update on profiles for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger memberships_set_updated_at before update on memberships for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger recruit_applications_set_updated_at before update on recruit_applications for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger items_set_updated_at before update on items for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger locations_set_updated_at before update on locations for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger orders_set_updated_at before update on orders for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger shipments_set_updated_at before update on shipments for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger containers_set_updated_at before update on containers for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger container_items_set_updated_at before update on container_items for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- GRANTS (IMPORTANT: without these you get "permission denied" even if RLS policy exists)
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

-- Authenticated users can call functions
-- (Functions are used inside RLS policies.)
grant execute on all functions in schema public to anon, authenticated;

-- Broad table privileges; RLS will do the real restricting
grant select, insert, update, delete on all tables in schema public to authenticated;

grant select on table regiments to anon;
grant insert on table recruit_applications to anon;

-- Ensure service_role can do everything
grant all privileges on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Helper functions for RLS (MUST come after tables exist)
-- -----------------------------------------------------------------------------

drop function if exists public.role_rank(text) cascade;
drop function if exists public.rsi_has_min_role(uuid, text) cascade;
drop function if exists public.rsi_can_access_war(uuid) cascade;
drop function if exists public.rsi_can_access_war_role(uuid, text) cascade;
drop function if exists public.rsi_has_global_min_role(text) cascade;

create function public.role_rank(r text)
returns int
language sql
immutable
as $$
  select case lower(r)
    when 'recruit' then 0
    when 'member' then 1
    when 'officer' then 2
    when 'high_command' then 3
    when 'commander' then 4
    else -1
  end;
$$;

-- SECURITY DEFINER prevents RLS recursion problems and lets this be used in policies safely.
create function public.rsi_has_min_role(reg_id uuid, min_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from memberships m
    where m.profile_id = auth.uid()
      and m.regiment_id = reg_id
      and role_rank(m.role::text) >= role_rank(min_role)
  );
$$;

create function public.rsi_can_access_war(war_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from wars w
    join memberships m on m.regiment_id = w.regiment_id
    where w.id = war_id and m.profile_id = auth.uid()
  );
$$;

create function public.rsi_can_access_war_role(war_id uuid, min_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from wars w
    join memberships m on m.regiment_id = w.regiment_id
    where w.id = war_id
      and m.profile_id = auth.uid()
      and role_rank(m.role::text) >= role_rank(min_role)
  );
$$;

create function public.rsi_has_global_min_role(min_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from memberships m
    where m.profile_id = auth.uid()
      and role_rank(m.role::text) >= role_rank(min_role)
  );
$$;

grant execute on function public.role_rank(text) to anon, authenticated;
grant execute on function public.rsi_has_min_role(uuid, text) to anon, authenticated;
grant execute on function public.rsi_can_access_war(uuid) to anon, authenticated;
grant execute on function public.rsi_can_access_war_role(uuid, text) to anon, authenticated;
grant execute on function public.rsi_has_global_min_role(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table regiments enable row level security;
alter table wars enable row level security;
alter table profiles enable row level security;
alter table memberships enable row level security;
alter table recruit_applications enable row level security;
alter table items enable row level security;
alter table locations enable row level security;
alter table yards enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table shipments enable row level security;
alter table shipment_events enable row level security;
alter table containers enable row level security;
alter table container_items enable row level security;

-- regiments: public read (needed for /join)
drop policy if exists regiments_select_public on regiments;
create policy regiments_select_public on regiments
  for select
  to anon, authenticated
  using (true);

-- profiles: self + (officer+) regiment-wide read; self update
drop policy if exists profiles_select_self on profiles;
create policy profiles_select_self on profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_regiment_officer on profiles;
create policy profiles_select_regiment_officer on profiles
  for select
  to authenticated
  using (rsi_has_min_role(regiment_id, 'officer'));

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- memberships: self read; officer+ can read within regiment
-- (write operations are normally done server-side with the service role key)
drop policy if exists memberships_select_self on memberships;
create policy memberships_select_self on memberships
  for select
  to authenticated
  using (profile_id = auth.uid());

drop policy if exists memberships_select_regiment_officer on memberships;
create policy memberships_select_regiment_officer on memberships
  for select
  to authenticated
  using (rsi_has_min_role(regiment_id, 'officer'));

-- wars: members can read wars in their regiment; officer+ can insert/update
drop policy if exists wars_select_regiment on wars;
create policy wars_select_regiment on wars
  for select
  to authenticated
  using (rsi_has_min_role(wars.regiment_id, 'member'));

drop policy if exists wars_insert_officer on wars;
create policy wars_insert_officer on wars
  for insert
  to authenticated
  with check (rsi_has_min_role(wars.regiment_id, 'officer'));

drop policy if exists wars_update_officer on wars;
create policy wars_update_officer on wars
  for update
  to authenticated
  using (rsi_has_min_role(wars.regiment_id, 'officer'))
  with check (rsi_has_min_role(wars.regiment_id, 'officer'));

-- items: authenticated read; officer+ write
drop policy if exists items_select_member on items;
create policy items_select_member on items
  for select
  to authenticated
  using (true);

drop policy if exists items_insert_officer on items;
create policy items_insert_officer on items
  for insert
  to authenticated
  with check (rsi_has_global_min_role('officer'));

drop policy if exists items_update_officer on items;
create policy items_update_officer on items
  for update
  to authenticated
  using (rsi_has_global_min_role('officer'))
  with check (rsi_has_global_min_role('officer'));

-- recruit_applications: anon insert; officer+ read/update
-- Note: INSERT uses anon role, so also requires GRANT INSERT (done above).
drop policy if exists recruit_insert_anon on recruit_applications;
create policy recruit_insert_anon on recruit_applications
  for insert
  to anon
  with check (status = 'pending' and reviewed_by is null and reviewed_at is null);

drop policy if exists recruit_select_officer on recruit_applications;
create policy recruit_select_officer on recruit_applications
  for select
  to authenticated
  using (rsi_has_min_role(regiment_id, 'officer'));

drop policy if exists recruit_update_officer on recruit_applications;
create policy recruit_update_officer on recruit_applications
  for update
  to authenticated
  using (rsi_has_min_role(regiment_id, 'officer'))
  with check (rsi_has_min_role(regiment_id, 'officer'));

-- locations/yards: members read; officer write

drop policy if exists locations_select_member on locations;
create policy locations_select_member on locations
  for select
  to authenticated
  using (rsi_can_access_war(locations.war_id));

drop policy if exists locations_insert_officer on locations;
create policy locations_insert_officer on locations
  for insert
  to authenticated
  with check (rsi_can_access_war_role(locations.war_id, 'officer'));

drop policy if exists locations_update_officer on locations;
create policy locations_update_officer on locations
  for update
  to authenticated
  using (rsi_can_access_war_role(locations.war_id, 'officer'))
  with check (rsi_can_access_war_role(locations.war_id, 'officer'));

drop policy if exists locations_delete_officer on locations;
create policy locations_delete_officer on locations
  for delete
  to authenticated
  using (rsi_can_access_war_role(locations.war_id, 'officer'));

-- yards
drop policy if exists yards_select_member on yards;
create policy yards_select_member on yards
  for select
  to authenticated
  using (rsi_can_access_war(yards.war_id));

drop policy if exists yards_insert_officer on yards;
create policy yards_insert_officer on yards
  for insert
  to authenticated
  with check (rsi_can_access_war_role(yards.war_id, 'officer'));

drop policy if exists yards_delete_officer on yards;
create policy yards_delete_officer on yards
  for delete
  to authenticated
  using (rsi_can_access_war_role(yards.war_id, 'officer'));

-- orders + order_items

drop policy if exists orders_select_member on orders;
create policy orders_select_member on orders
  for select
  to authenticated
  using (rsi_can_access_war(orders.war_id));

drop policy if exists orders_insert_member on orders;
create policy orders_insert_member on orders
  for insert
  to authenticated
  with check (rsi_can_access_war_role(orders.war_id, 'member') and created_by = auth.uid());

drop policy if exists orders_update_member on orders;
create policy orders_update_member on orders
  for update
  to authenticated
  using (rsi_can_access_war_role(orders.war_id, 'member'))
  with check (rsi_can_access_war_role(orders.war_id, 'member'));

-- order_items
drop policy if exists order_items_select_member on order_items;
create policy order_items_select_member on order_items
  for select
  to authenticated
  using (
    exists(
      select 1 from orders o
      where o.id = order_items.order_id
        and rsi_can_access_war(o.war_id)
    )
  );

drop policy if exists order_items_insert_member on order_items;
create policy order_items_insert_member on order_items
  for insert
  to authenticated
  with check (
    exists(
      select 1 from orders o
      where o.id = order_items.order_id
        and rsi_can_access_war_role(o.war_id, 'member')
    )
  );

drop policy if exists order_items_update_member on order_items;
create policy order_items_update_member on order_items
  for update
  to authenticated
  using (
    exists(
      select 1 from orders o
      where o.id = order_items.order_id
        and rsi_can_access_war_role(o.war_id, 'member')
    )
  )
  with check (
    exists(
      select 1 from orders o
      where o.id = order_items.order_id
        and rsi_can_access_war_role(o.war_id, 'member')
    )
  );

-- containers + container_items

drop policy if exists containers_select_member on containers;
create policy containers_select_member on containers
  for select
  to authenticated
  using (rsi_can_access_war(containers.war_id));

drop policy if exists containers_insert_member on containers;
create policy containers_insert_member on containers
  for insert
  to authenticated
  with check (rsi_can_access_war_role(containers.war_id, 'member') and created_by = auth.uid());

drop policy if exists containers_update_member on containers;
create policy containers_update_member on containers
  for update
  to authenticated
  using (rsi_can_access_war_role(containers.war_id, 'member'))
  with check (rsi_can_access_war_role(containers.war_id, 'member'));

-- container_items
drop policy if exists container_items_select_member on container_items;
create policy container_items_select_member on container_items
  for select
  to authenticated
  using (
    exists(
      select 1
      from containers c
      where c.id = container_items.container_id
        and rsi_can_access_war(c.war_id)
    )
  );

drop policy if exists container_items_insert_member on container_items;
create policy container_items_insert_member on container_items
  for insert
  to authenticated
  with check (
    exists(
      select 1
      from containers c
      where c.id = container_items.container_id
        and rsi_can_access_war_role(c.war_id, 'member')
    )
  );

drop policy if exists container_items_update_member on container_items;
create policy container_items_update_member on container_items
  for update
  to authenticated
  using (
    exists(
      select 1
      from containers c
      where c.id = container_items.container_id
        and rsi_can_access_war_role(c.war_id, 'member')
    )
  )
  with check (
    exists(
      select 1
      from containers c
      where c.id = container_items.container_id
        and rsi_can_access_war_role(c.war_id, 'member')
    )
  );

-- shipments + shipment_events

drop policy if exists shipments_select_member on shipments;
create policy shipments_select_member on shipments
  for select
  to authenticated
  using (rsi_can_access_war(shipments.war_id));

drop policy if exists shipments_insert_officer on shipments;
create policy shipments_insert_officer on shipments
  for insert
  to authenticated
  with check (rsi_can_access_war_role(shipments.war_id, 'officer') and created_by = auth.uid());

drop policy if exists shipments_update_officer on shipments;
create policy shipments_update_officer on shipments
  for update
  to authenticated
  using (rsi_can_access_war_role(shipments.war_id, 'officer'))
  with check (rsi_can_access_war_role(shipments.war_id, 'officer'));

-- shipment_events

drop policy if exists shipment_events_select_member on shipment_events;
create policy shipment_events_select_member on shipment_events
  for select
  to authenticated
  using (
    exists(
      select 1
      from shipments s
      where s.id = shipment_events.shipment_id
        and rsi_can_access_war(s.war_id)
    )
  );

drop policy if exists shipment_events_insert_officer on shipment_events;
create policy shipment_events_insert_officer on shipment_events
  for insert
  to authenticated
  with check (
    exists(
      select 1
      from shipments s
      where s.id = shipment_events.shipment_id
        and rsi_can_access_war_role(s.war_id, 'officer')
    )
  );

-- -----------------------------------------------------------------------------
-- Seed regiment row
-- -----------------------------------------------------------------------------
insert into regiments (name, slug)
values ('RSi (Reaper Strategic Industries)', 'rsi')
on conflict (slug) do update set name = excluded.name;

commit;
