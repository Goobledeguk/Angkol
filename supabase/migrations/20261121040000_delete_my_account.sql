create or replace function public.delete_my_account() returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to delete your account.';
  end if;

  perform set_config('angkol.trusted_booking_update', 'on', true);
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
