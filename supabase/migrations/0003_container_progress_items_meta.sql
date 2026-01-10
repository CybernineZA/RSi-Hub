-- 0003_container_progress_items_meta.sql
-- Adds: items metadata + vehicle unit, and container item progress fields.
-- Safe to run multiple times.

-- ITEMS: extend unit check + metadata
do $$
begin
  -- Drop old check constraint if it exists
  if exists (
    select 1 from pg_constraint
    where conname = 'items_unit_check'
  ) then
    alter table public.items drop constraint items_unit_check;
  end if;
exception when undefined_table then
  -- items table might not exist yet in certain flows
  null;
end $$;

alter table public.items
  add column if not exists crate_size integer null,
  add column if not exists api_id text null,
  add column if not exists image_name text null,
  add column if not exists faction text[] not null default '{}';

-- Re-add check constraint (includes 'vehicle')
do $$
begin
  alter table public.items
    add constraint items_unit_check check (unit in ('crate','item','vehicle'));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  -- Optional safety: ensure crate_size positive when present
  if not exists (
    select 1 from pg_constraint where conname = 'items_crate_size_check'
  ) then
    alter table public.items
      add constraint items_crate_size_check check (crate_size is null or crate_size > 0);
  end if;
exception when duplicate_object then
  null;
end $$;

-- CONTAINER ITEMS: rename quantity -> qty_required, add qty_done, constraints
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='container_items' and column_name='quantity'
  ) then
    alter table public.container_items rename column quantity to qty_required;
  end if;
end $$;

alter table public.container_items
  add column if not exists qty_done integer not null default 0;

-- Ensure checks
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'container_items_qty_required_check') then
    alter table public.container_items add constraint container_items_qty_required_check check (qty_required > 0);
  end if;
exception when duplicate_object then null; end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'container_items_qty_done_check') then
    alter table public.container_items add constraint container_items_qty_done_check check (qty_done >= 0);
  end if;
exception when duplicate_object then null; end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'container_items_done_lte_required') then
    alter table public.container_items add constraint container_items_done_lte_required check (qty_done <= qty_required);
  end if;
exception when duplicate_object then null; end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'container_items_unique_item') then
    alter table public.container_items add constraint container_items_unique_item unique (container_id, item_id);
  end if;
exception when duplicate_object then null; end $$;

-- RLS policies for container_items: allow members to read/write within regiment wars.
drop policy if exists "container_items_select_members" on public.container_items;
create policy "container_items_select_members"
on public.container_items for select
to authenticated
using (
  exists (
    select 1
    from public.containers c
    join public.wars w on w.id = c.war_id
    where c.id = container_items.container_id
      and public.is_in_regiment(w.regiment_id)
  )
);

drop policy if exists "container_items_write_officer" on public.container_items;
drop policy if exists "container_items_update_officer" on public.container_items;

drop policy if exists "container_items_insert_member" on public.container_items;
create policy "container_items_insert_member"
on public.container_items for insert
to authenticated
with check (
  public.has_role('member')
  and exists (
    select 1
    from public.containers c
    join public.wars w on w.id = c.war_id
    where c.id = container_items.container_id
      and public.is_in_regiment(w.regiment_id)
  )
);

drop policy if exists "container_items_update_member" on public.container_items;
create policy "container_items_update_member"
on public.container_items for update
to authenticated
using (
  public.has_role('member')
  and exists (
    select 1
    from public.containers c
    join public.wars w on w.id = c.war_id
    where c.id = container_items.container_id
      and public.is_in_regiment(w.regiment_id)
  )
)
with check (
  public.has_role('member')
  and exists (
    select 1
    from public.containers c
    join public.wars w on w.id = c.war_id
    where c.id = container_items.container_id
      and public.is_in_regiment(w.regiment_id)
  )
);
