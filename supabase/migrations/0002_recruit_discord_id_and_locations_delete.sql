-- Adds Discord User ID to join applications, and enables officer deletes for locations.
-- Safe to run multiple times.

alter table public.recruit_applications
  add column if not exists discord_user_id text;

create index if not exists recruit_applications_discord_user_id_idx
  on public.recruit_applications (discord_user_id);

-- Allow officers/high command/commander to delete destinations
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='locations' and policyname='locations_delete_officer'
  ) then
    execute $$create policy locations_delete_officer on public.locations for delete using (public.has_role('officer'))$$;
  end if;
end $$;
