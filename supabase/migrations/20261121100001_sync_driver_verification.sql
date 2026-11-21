create or replace function public.sync_driver_verification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.drivers
  set verified = new.verified
  where user_id = new.user_id and verified is distinct from new.verified;
  return new;
end;
$$;

revoke execute on function public.sync_driver_verification() from public, anon, authenticated;

create or replace trigger sync_driver_verification
after update of verified on public.users
for each row
when (old.verified is distinct from new.verified)
execute function public.sync_driver_verification();

create or replace function public.use_user_verification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select verified into new.verified from public.users where user_id = new.user_id;
  return new;
end;
$$;

revoke execute on function public.use_user_verification() from public, anon, authenticated;

create or replace trigger use_user_verification
before update of verified on public.drivers
for each row execute function public.use_user_verification();
