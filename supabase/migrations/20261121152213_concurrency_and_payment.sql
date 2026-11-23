create unique index if not exists bookings_one_active_per_passenger
  on public.bookings (user_id) where request_status in ('Requested', 'Accepted', 'Arrived', 'In progress');

create unique index if not exists bookings_one_active_per_driver
  on public.bookings (driver_id)
  where service_type = 'Tricycle' and request_status in ('Accepted', 'Arrived', 'In progress');

create unique index if not exists driver_runs_one_active_per_driver
  on public.driver_runs (driver_id) where status = 'In progress';

create or replace function public.serialize_booking() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('angkol:passenger:' || auth.uid()::text));
  if new.service_type = 'PUJ/PUV' and new.routes_id is not null then
    perform pg_advisory_xact_lock(hashtext('angkol:route:' || new.routes_id));
  end if;
  return new;
end $$;

revoke execute on function public.serialize_booking() from public, anon, authenticated;

drop trigger if exists a_serialize_booking on public.bookings;
create trigger a_serialize_booking
before insert on public.bookings
for each row execute function public.serialize_booking();

create or replace function public.transition_booking(p_booking_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b bookings;
  v_uid uuid := auth.uid();
  v_role text := public.my_role();
  v_admin boolean := public.is_admin();
  v_now timestamptz;
  v_passenger boolean;
  v_driver boolean;
  v_new_driver uuid;
  v_ok boolean := false;
  v_started timestamptz;
begin
  if v_uid is null then
    raise exception 'Sign in first.';
  end if;

  if p_status = 'Accepted' then
    perform pg_advisory_xact_lock(hashtext('angkol:driver:' || v_uid::text));
  end if;

  select * into b from bookings where booking_id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.';
  end if;
  v_now := clock_timestamp();

  v_passenger := b.user_id = v_uid;
  v_driver := coalesce(b.driver_id = v_uid, false);
  v_new_driver := b.driver_id;

  if b.request_status = 'Requested' and b.expires_at is not null and b.expires_at < v_now then
    raise exception 'This ride request has expired.';
  end if;
  if b.service_type = 'PUJ/PUV' and b.request_status in ('Arrived', 'In progress')
     and b.expires_at is not null and b.expires_at < v_now and p_status <> 'Cancelled' then
    raise exception 'This seat reservation has lapsed. Book the route again.';
  end if;

  if b.request_status = 'Requested' and p_status = 'Accepted' then
    if v_role <> 'Tricycle driver' or b.service_type <> 'Tricycle' then
      raise exception 'Only tricycle drivers can accept tricycle rides.';
    end if;
    if not public.is_approved_driver(v_uid) then
      raise exception 'Your driver account is not approved yet.';
    end if;
    if not exists (select 1 from drivers where user_id = v_uid and availability_status = 'available') then
      raise exception 'Go online before accepting rides.';
    end if;
    if b.driver_id is not null and b.driver_id <> v_uid then
      raise exception 'This ride was taken by another driver.';
    end if;
    if v_uid = any(b.declined_by) then
      raise exception 'You already passed on this ride.';
    end if;
    if exists (
      select 1 from bookings o
      where o.driver_id = v_uid and o.booking_id <> b.booking_id
        and o.request_status in ('Accepted', 'Arrived', 'In progress')
    ) then
      raise exception 'Finish your current ride before accepting another.';
    end if;
    v_new_driver := v_uid;
    v_ok := true;
  elsif p_status = 'Cancelled' and b.request_status in ('Requested','Accepted','Arrived') then
    v_ok := v_passenger or v_admin or (v_driver and b.request_status <> 'Requested');
  elsif b.request_status = 'Accepted' and p_status = 'Arrived' then
    v_ok := v_driver;
  elsif b.request_status = 'Arrived' and p_status = 'In progress' then
    v_ok := v_driver or v_passenger;
  elsif b.request_status = 'Arrived' and p_status = 'Completed' and b.service_type = 'PUJ/PUV' then
    v_ok := v_passenger or v_driver;
  elsif b.request_status = 'In progress' and p_status = 'Completed' then
    v_ok := v_driver or v_passenger;
  end if;

  if not v_ok then
    raise exception 'You can''t change this ride from % to %.', b.request_status, p_status;
  end if;

  perform set_config('angkol.trusted_booking_update', 'on', true);

  update bookings set
    request_status = p_status,
    driver_id = v_new_driver,
    timestamps = coalesce(b.timestamps, '{}'::jsonb)
                 || jsonb_build_object(p_status, (extract(epoch from v_now) * 1000)::bigint)
  where booking_id = p_booking_id;

  if p_status = 'Completed' then
    v_started := case
      when b.timestamps ? 'In progress'
      then to_timestamp((b.timestamps->>'In progress')::bigint / 1000.0)
      when b.timestamps ? 'Arrived'
      then to_timestamp((b.timestamps->>'Arrived')::bigint / 1000.0)
      else v_now
    end;
    insert into trip_records (booking_id, driver_id, user_id, actual_distance,
                              payment_status, total_duration, started_at, completed_at)
    values (p_booking_id, v_new_driver, b.user_id, b.distance_km,
            case when b.payment_method = 'Cash' then 'paid' else 'pending' end,
            greatest(1, round(extract(epoch from (v_now - v_started)) / 60))::int,
            v_started, v_now)
    on conflict (booking_id) do update
      set completed_at = excluded.completed_at, total_duration = excluded.total_duration;
  end if;

  perform set_config('angkol.trusted_booking_update', 'off', true);

  return jsonb_build_object('ok', true, 'booking_id', p_booking_id, 'status', p_status);
end $$;

create or replace function public.can_manage_user(p_target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_target is null then false
    when public.my_role() = 'Administrator' then true
    when public.my_role() = 'Vehicle Owner / Operator' then p_target = auth.uid() or exists (
      select 1 from public.users me join public.users t on t.franchise_name = me.franchise_name
      where me.user_id = auth.uid() and t.user_id = p_target
        and coalesce(me.franchise_name, '') <> ''
        and t.assigned_roles[1] = 'PUJ / PUV driver'
    )
    else false
  end;
$$;

create or replace function public.guard_user_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.my_role() <> 'Administrator' then
    new.assigned_roles := old.assigned_roles;
    new.admin_level := old.admin_level;
    new.email := old.email;
    new.franchise_name := old.franchise_name;
    if not public.can_manage_user(old.user_id) or old.user_id = auth.uid() then
      new.verified := old.verified;
      new.application_status := old.application_status;
    end if;
  end if;

  if new.verified and not old.verified
     and old.assigned_roles[1] in ('Tricycle driver', 'PUJ / PUV driver')
     and not exists (
       select 1 from storage.objects o
       where o.bucket_id = 'driver-documents' and o.name = 'license/' || old.user_id::text || '.jpg'
     ) then
    raise exception 'This driver has not uploaded a license photo yet.';
  end if;

  if new.verified and not old.verified then
    new.application_status := 'accepted';
  end if;

  return new;
end $$;

update public.users u
set verified = false, application_status = 'pending'
where u.assigned_roles[1] = 'Tricycle driver'
  and u.verified
  and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'driver-documents' and o.name = 'license/' || u.user_id::text || '.jpg'
  );

update public.drivers d
set license_doc_attached = exists (
  select 1 from storage.objects o
  where o.bucket_id = 'driver-documents' and o.name = 'license/' || d.user_id::text || '.jpg'
);
