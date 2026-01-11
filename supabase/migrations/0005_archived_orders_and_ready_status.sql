-- 0005: Add 'ready' order status + archive tables for production orders

-- Add the missing status used by the production board
do $$ begin
  alter type public.order_status add value if not exists 'ready';
exception when duplicate_object then null; end $$;

-- Archived production orders (completed orders are moved here)
create table if not exists public.archived_orders (
  id uuid primary key,
  war_id uuid not null references public.wars(id) on delete cascade,
  type public.order_type not null,
  order_no bigint null,
  title text not null,
  status public.order_status not null default 'complete',
  created_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz not null default now(),
  archived_by uuid null references public.profiles(id) on delete set null
);

create index if not exists archived_orders_war_id_idx on public.archived_orders(war_id);
create index if not exists archived_orders_archived_at_idx on public.archived_orders(archived_at desc);

create table if not exists public.archived_order_items (
  id uuid primary key,
  order_id uuid not null references public.archived_orders(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  qty_required int not null default 0,
  qty_done int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists archived_order_items_order_id_idx on public.archived_order_items(order_id);
create index if not exists archived_order_items_item_id_idx on public.archived_order_items(item_id);

-- RLS
alter table public.archived_orders enable row level security;
alter table public.archived_order_items enable row level security;

-- Access policies: allow regiment members to read archived production for their war.
drop policy if exists archived_orders_select on public.archived_orders;
create policy archived_orders_select on public.archived_orders
  for select to authenticated
  using (public.rsi_can_access_war(war_id));

drop policy if exists archived_order_items_select on public.archived_order_items;
create policy archived_order_items_select on public.archived_order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.archived_orders ao
      where ao.id = archived_order_items.order_id
        and public.rsi_can_access_war(ao.war_id)
    )
  );

-- Writes are performed by service_role (server-side archiving), so we don't expose insert/update to clients.
