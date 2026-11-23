create or replace function public.guard_driver_run() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.status = 'Completed' and new is distinct from old then
    raise exception 'This run is already completed.' using errcode = '23514';
  end if;
  if new.onboard < 0 or new.onboard > new.capacity then
    raise exception 'The onboard count must be between zero and the vehicle capacity.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_driver_run() from public, anon, authenticated;

create or replace trigger guard_driver_run
before insert or update on public.driver_runs
for each row execute function public.guard_driver_run();

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policy
    where polrelid = 'public.driver_runs'::regclass and polname = 'update_own_driver_runs'
  ) then
    create policy update_own_driver_runs on public.driver_runs
      as restrictive for update to authenticated
      using (driver_id = (select auth.uid()))
      with check (driver_id = (select auth.uid()));
  end if;
end;
$$;
