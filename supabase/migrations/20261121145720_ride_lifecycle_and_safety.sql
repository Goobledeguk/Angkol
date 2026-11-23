create extension if not exists pg_cron;

alter table public.bookings
  add column if not exists vehicle_id text references public.vehicles(vehicle_id) on delete set null;

create index if not exists bookings_open_requests_idx
  on public.bookings (request_status, expires_at) where request_status in ('Requested', 'Arrived', 'In progress');
create index if not exists bookings_driver_active_idx
  on public.bookings (driver_id) where request_status in ('Accepted', 'Arrived', 'In progress');
create index if not exists bookings_vehicle_active_idx
  on public.bookings (vehicle_id) where request_status in ('Arrived', 'In progress');

create or replace function public.in_service_area(p_lat double precision, p_lng double precision)
returns boolean language sql immutable set search_path = '' as $$
  select p_lat between 11.93 and 12.32 and p_lng between 124.48 and 124.90;
$$;

create or replace function public.is_approved_driver(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u join public.drivers d on d.user_id = u.user_id
    where u.user_id = p_user and u.verified and u.application_status = 'accepted' and d.verified
  );
$$;

revoke execute on function public.is_approved_driver(uuid) from public, anon;

create or replace function public.can_manage_user(p_target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_target is null then false
    when public.my_role() = 'Administrator' then true
    when public.my_role() = 'Vehicle Owner / Operator' then exists (
      select 1 from public.users me join public.users t on t.franchise_name = me.franchise_name
      where me.user_id = auth.uid() and t.user_id = p_target and coalesce(me.franchise_name, '') <> ''
    ) or p_target = auth.uid()
    else false
  end;
$$;

revoke execute on function public.can_manage_user(uuid) from public, anon;

create or replace function public.expire_stale_bookings()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
  v_now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  perform set_config('angkol.trusted_booking_update', 'on', true);
  update bookings
  set request_status = 'Expired',
      timestamps = coalesce(timestamps, '{}'::jsonb) || jsonb_build_object('Expired', v_now_ms)
  where expires_at < now()
    and (request_status = 'Requested'
         or (service_type = 'PUJ/PUV' and request_status in ('Arrived', 'In progress')));
  get diagnostics v_count = row_count;
  perform set_config('angkol.trusted_booking_update', 'off', true);
  return v_count;
end $$;

revoke execute on function public.expire_stale_bookings() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'angkol-expire-bookings';
select cron.schedule('angkol-expire-bookings', '* * * * *', 'select public.expire_stale_bookings()');

create or replace function public.notify_booking_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_message text;
begin
  if tg_op = 'UPDATE' then
    if new.request_status is not distinct from old.request_status then return new; end if;
  end if;

  v_message := case
    when new.request_status = 'Requested' and tg_op = 'UPDATE'
      then 'Your driver is no longer available. We are finding you another driver.'
    when new.request_status = 'Requested'
      then 'Your ride request was sent. Looking for a nearby available driver.'
    when new.request_status = 'Accepted' then 'A driver accepted your ride request and is on the way.'
    when new.request_status = 'Arrived' and new.service_type = 'PUJ/PUV'
      then 'Your seat is reserved. Board ' || coalesce(nullif(new.driver_plate, ''), 'your PUV') || ' at the terminal.'
    when new.request_status = 'Arrived' then 'Your driver has arrived at the pickup point.'
    when new.request_status = 'In progress' then 'Your trip has started. Track the driver on the map.'
    when new.request_status = 'Completed' then 'Trip completed. Thank you for riding with Angkol.'
    when new.request_status = 'Cancelled' then 'Your ride was cancelled.'
    when new.request_status = 'Expired' and new.service_type = 'PUJ/PUV'
      then 'Your PUV seat reservation has lapsed.'
    when new.request_status = 'Expired'
      then 'No driver accepted your request in time. You can book again.'
    else null end;

  if v_message is not null then
    insert into public.notifications (user_id, message) values (new.user_id, v_message);
  end if;
  return new;
end $$;

create or replace function public.prepare_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  v_straight double precision;
  v_fare numeric;
  v_vehicle public.vehicles%rowtype;
  v_found_any boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  new.user_id := auth.uid();
  new.driver_id := null;
  new.vehicle_id := null;
  new.declined_by := '{}';
  new.rating := null;
  new.created_at := now();
  new.expires_at := now() + interval '10 minutes';

  if not public.in_service_area(new.pickup_latitude, new.pickup_longitude)
     or not public.in_service_area(new.dropoff_latitude, new.dropoff_longitude) then
    raise exception 'Angkol only operates within Calbayog City.';
  end if;

  if public.my_role() <> 'Passenger' then
    raise exception 'Only commuter accounts can book rides.';
  end if;

  perform public.expire_stale_bookings();

  if exists (
    select 1 from bookings b
    where b.user_id = new.user_id
      and b.request_status in ('Requested', 'Accepted', 'Arrived', 'In progress')
  ) then
    raise exception 'You already have an active ride.';
  end if;

  if new.service_type = 'Tricycle' then
    v_straight := public.haversine_km(
      new.pickup_latitude, new.pickup_longitude,
      new.dropoff_latitude, new.dropoff_longitude
    );
    if new.distance_km is null or new.distance_km <= 0 or new.distance_km > 100
       or new.distance_km < v_straight * 0.95 - 0.1
       or new.distance_km > v_straight * 4 + 3 then
      raise exception 'The trip distance does not match the pickup and destination.';
    end if;

    v_fare := public.quote_fare(new.distance_km, 'Tricycle');
    if v_fare is null or v_fare <= 0 then
      raise exception 'No tricycle fare is configured yet.';
    end if;

    new.calculated_fixed_fare := v_fare;
    new.request_status := 'Requested';
    new.routes_id := null;
    new.driver_name := '';
    new.driver_plate := '';
    new.timestamps := jsonb_build_object('Requested', v_now_ms);
  else
    select coalesce(f.base_fare, r.fare) into v_fare
    from public.routes r
    left join public.fare_matrices f
      on f.routes_id = r.routes_id and f.active and f.vehicle_classification in ('PUJ','PUV')
    where r.routes_id = new.routes_id and r.active and r.approved
    order by (f.tariff_tier = 'REGULAR') desc nulls last
    limit 1;

    if v_fare is null or v_fare <= 0 then
      raise exception 'Choose an active PUJ/PUV route.';
    end if;

    select exists (
      select 1 from public.vehicles v
      where v.routes_id = new.routes_id and v.active
        and v.status not in ('Broken / Inactive', 'Decommissioned')
    ) into v_found_any;

    select v.* into v_vehicle
    from public.vehicles v
    left join lateral (
      select r.onboard from public.driver_runs r
      where r.driver_id = v.driver_id and r.status = 'In progress' and r.routes_id = v.routes_id
      order by r.started_at desc limit 1
    ) run on true
    where v.routes_id = new.routes_id and v.active
      and v.status not in ('Broken / Inactive', 'Decommissioned')
      and v.capacity - coalesce(run.onboard, 0) - (
        select count(*) from public.bookings s
        where s.vehicle_id = v.vehicle_id and s.request_status in ('Arrived', 'In progress')
      ) > 0
    order by (run.onboard is not null) desc, (v.status = 'In Terminal') desc,
             v.location_updated_at desc nulls last
    limit 1;

    if not found then
      if v_found_any then
        raise exception 'Every PUV on this route is full right now. Try again shortly.';
      end if;
      raise exception 'No vehicle is running this route right now. Try again shortly.';
    end if;

    new.vehicle_id := v_vehicle.vehicle_id;
    new.driver_id := case when public.is_approved_driver(v_vehicle.driver_id) then v_vehicle.driver_id end;
    new.driver_name := coalesce(nullif(v_vehicle.current_driver, ''), v_vehicle.name);
    new.driver_plate := v_vehicle.plate_number;
    new.calculated_fixed_fare := v_fare;
    new.request_status := 'Arrived';
    new.expires_at := now() + interval '3 hours';
    new.timestamps := jsonb_build_object(
      'Requested', v_now_ms, 'Accepted', v_now_ms, 'Arrived', v_now_ms
    );
  end if;

  return new;
end $$;

revoke execute on function public.prepare_booking() from public, anon, authenticated;

create or replace function public.transition_booking(p_booking_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b bookings;
  v_uid uuid := auth.uid();
  v_role text := public.my_role();
  v_admin boolean := public.is_admin();
  v_now timestamptz := clock_timestamp();
  v_passenger boolean;
  v_driver boolean;
  v_new_driver uuid;
  v_ok boolean := false;
  v_started timestamptz;
begin
  if v_uid is null then
    raise exception 'Sign in first.';
  end if;

  select * into b from bookings where booking_id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.';
  end if;

  v_passenger := b.user_id = v_uid;
  v_driver := coalesce(b.driver_id = v_uid, false);
  v_new_driver := b.driver_id;

  if b.request_status = 'Requested' and b.expires_at is not null and b.expires_at < v_now then
    raise exception 'This ride request has expired.';
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
            case when b.payment_method = 'Cash' then 'unpaid' else 'pending' end,
            greatest(1, round(extract(epoch from (v_now - v_started)) / 60))::int,
            v_started, v_now)
    on conflict (booking_id) do update
      set completed_at = excluded.completed_at, total_duration = excluded.total_duration;
  end if;

  perform set_config('angkol.trusted_booking_update', 'off', true);

  return jsonb_build_object('ok', true, 'booking_id', p_booking_id, 'status', p_status);
end $$;

create or replace function public.release_booking(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b bookings; v_uid uuid := auth.uid();
begin
  if public.my_role() <> 'Tricycle driver' or not public.is_approved_driver(v_uid) then
    raise exception 'Only approved tricycle drivers can pass on a ride.';
  end if;

  select * into b from bookings where booking_id = p_booking_id for update;
  if not found then raise exception 'Booking not found.'; end if;
  if b.driver_id is not null and b.driver_id <> v_uid then
    raise exception 'Assigned to another driver.';
  end if;
  if b.request_status <> 'Requested' then
    raise exception 'This ride is no longer open.';
  end if;

  perform set_config('angkol.trusted_booking_update', 'on', true);

  update bookings set
    driver_id = null,
    declined_by = (select array_agg(distinct x) from unnest(b.declined_by || v_uid) as x),
    timestamps = coalesce(b.timestamps, '{}'::jsonb)
                 || jsonb_build_object('Declined', (extract(epoch from now()) * 1000)::bigint)
  where booking_id = p_booking_id;

  perform set_config('angkol.trusted_booking_update', 'off', true);

  insert into public.notifications (user_id, message)
  values (b.user_id, 'A driver declined your request. We are offering it to the next nearest available driver.');

  return jsonb_build_object('ok', true, 'booking_id', p_booking_id, 'status', 'Requested');
end $$;

create or replace function public.rate_booking(p_booking_id uuid, p_rating int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Choose a rating from 1 to 5.';
  end if;
  if not exists (
    select 1 from bookings
    where booking_id = p_booking_id and user_id = auth.uid() and request_status = 'Completed'
  ) then
    raise exception 'You can only rate your own completed trip.';
  end if;
  if exists (select 1 from bookings where booking_id = p_booking_id and rating is not null) then
    raise exception 'You already rated this trip.';
  end if;

  perform set_config('angkol.trusted_booking_update', 'on', true);
  update bookings set rating = p_rating where booking_id = p_booking_id;
  perform set_config('angkol.trusted_booking_update', 'off', true);

  update trip_records set rating = p_rating where booking_id = p_booking_id;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text := case
    when m->>'role' in ('Passenger','Tricycle driver','PUJ / PUV driver') then m->>'role'
    else 'Passenger'
  end;
  v_driver boolean := v_role in ('Tricycle driver','PUJ / PUV driver');
begin
  insert into public.users (
    user_id, email, name, birthday, phone, consent, assigned_roles,
    admin_level, franchise_name, profile_information, contact_numbers,
    verified, application_status
  ) values (
    new.id, coalesce(new.email,''), coalesce(m->>'name',''),
    case when m->>'birthday' ~ '^\d{4}-\d{2}-\d{2}$'
         then (m->>'birthday')::date else null end,
    coalesce(m->>'phone',''),
    coalesce((m->>'consent')::boolean, false), array[v_role],
    null,
    case when v_role = 'PUJ / PUV driver' then m->>'franchise_name' end,
    m - 'role' - 'admin_level',
    coalesce(m->>'phone',''),
    not v_driver,
    case when v_driver then 'pending' else 'accepted' end
  ) on conflict (user_id) do nothing;

  if v_driver then
    insert into public.drivers (
      user_id, license_number, operational_classification, association,
      permit_number, license_doc_attached, plate_number, capacity, franchise_name,
      verified, availability_status
    ) values (
      new.id, coalesce(m->>'license',''),
      case when v_role = 'Tricycle driver' then 'Tricycle' else 'PUJ' end,
      coalesce(m->>'association',''), coalesce(m->>'permit_no',''),
      false,
      coalesce(m->>'plate',''),
      least(greatest(coalesce((m->>'capacity')::int, 3), 1), 60),
      case when v_role = 'PUJ / PUV driver' then m->>'franchise_name' end,
      false,
      'offline'
    );
  end if;

  insert into public.notifications (user_id, message)
  values (
    new.id,
    case
      when v_role = 'PUJ / PUV driver'
        then 'Welcome to Angkol. Your franchise application is waiting for owner approval.'
      when v_role = 'Tricycle driver'
        then 'Welcome to Angkol. Upload your driver license so the city transport office can verify you.'
      else 'Welcome to Angkol. Your account is ready.'
    end
  );

  return new;
end $$;

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

create or replace function public.guard_driver_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.can_manage_user(old.user_id) then
    new.verified := old.verified;
    new.routes_id := old.routes_id;
  elsif auth.uid() is not null and old.user_id = auth.uid() and public.my_role() <> 'Administrator' then
    new.verified := old.verified;
    new.routes_id := old.routes_id;
  end if;
  if tg_op = 'UPDATE' and new.license_doc_attached is distinct from old.license_doc_attached then
    new.license_doc_attached := exists (
      select 1 from storage.objects o
      where o.bucket_id = 'driver-documents' and o.name = 'license/' || old.user_id::text || '.jpg'
    );
  end if;
  return new;
end $$;

create or replace function public.release_rides_of_deleted_driver() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  perform set_config('angkol.trusted_booking_update', 'on', true);

  update bookings
  set request_status = 'Requested',
      driver_id = null,
      expires_at = now() + interval '10 minutes',
      declined_by = (select array_agg(distinct x) from unnest(declined_by || old.user_id) as x),
      timestamps = coalesce(timestamps, '{}'::jsonb) || jsonb_build_object('Reopened', v_now_ms)
  where driver_id = old.user_id and service_type = 'Tricycle'
    and request_status in ('Accepted', 'Arrived');

  update bookings
  set request_status = 'Cancelled',
      timestamps = coalesce(timestamps, '{}'::jsonb) || jsonb_build_object('Cancelled', v_now_ms)
  where driver_id = old.user_id and service_type = 'Tricycle' and request_status = 'In progress';

  return old;
end $$;

revoke execute on function public.release_rides_of_deleted_driver() from public, anon, authenticated;

drop trigger if exists release_rides_of_deleted_driver on public.users;
create trigger release_rides_of_deleted_driver
before delete on public.users
for each row execute function public.release_rides_of_deleted_driver();

create or replace function public.admin_users() returns setof public.users
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only.';
  end if;
  return query select * from users u where public.can_manage_user(u.user_id) order by u.created_at desc;
end $$;

create or replace function public.admin_drivers() returns setof public.drivers
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only.';
  end if;
  return query select * from drivers d where public.can_manage_user(d.user_id);
end $$;

alter policy update_users_admin on public.users using (public.can_manage_user(user_id));

alter policy read_bookings on public.bookings using (
  user_id = (select auth.uid()) or driver_id = (select auth.uid()) or public.is_admin()
  or (driver_id is null and request_status = 'Requested' and expires_at > now()
      and public.my_role() = 'Tricycle driver'
      and public.is_approved_driver((select auth.uid()))
      and not ((select auth.uid()) = any(declined_by)))
);

drop policy if exists read_license_document on storage.objects;
create policy read_license_document on storage.objects
for select to authenticated
using (
  bucket_id = 'driver-documents'
  and (
    (name = 'license/' || (select auth.uid())::text || '.jpg'
     and (select public.my_role()) in ('Tricycle driver', 'PUJ / PUV driver'))
    or public.can_manage_user(
      nullif(substring(name from '^license/([0-9a-f-]{36})\.jpg$'), '')::uuid
    )
  )
);

drop policy if exists delete_own_license_document on storage.objects;
create policy delete_own_license_document on storage.objects
for delete to authenticated
using (
  bucket_id = 'driver-documents'
  and name = 'license/' || (select auth.uid())::text || '.jpg'
);

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
  new.cash_fares := new.total_boarded * new.fare;
  return new;
end;
$$;

drop policy if exists update_own_driver_runs on public.driver_runs;
drop policy if exists write_runs on public.driver_runs;
create policy write_runs on public.driver_runs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists write_run_events on public.driver_run_events;
create policy write_run_events on public.driver_run_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.run_payload(p_run_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(r) || jsonb_build_object(
    'driver_run_events',
    coalesce((select jsonb_agg(to_jsonb(e) order by e.at, e.event_id)
              from driver_run_events e where e.run_id = r.run_id), '[]'::jsonb)
  )
  from driver_runs r where r.run_id = p_run_id;
$$;

revoke execute on function public.run_payload(uuid) from public, anon, authenticated;

create or replace function public.start_run(p_boarded int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  d drivers;
  r routes;
  v_fare numeric;
  v_run uuid;
  v_boarded int := coalesce(p_boarded, 0);
  v_stops jsonb;
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;
  if public.my_role() <> 'PUJ / PUV driver' or not public.is_approved_driver(v_uid) then
    raise exception 'Only approved PUJ/PUV drivers can start a run.';
  end if;

  select * into d from drivers where user_id = v_uid;
  if d.routes_id is null then
    raise exception 'No route is assigned to you yet.';
  end if;
  select * into r from routes where routes_id = d.routes_id and active;
  if not found then
    raise exception 'Your assigned route is not active.';
  end if;
  if exists (select 1 from driver_runs where driver_id = v_uid and status = 'In progress') then
    raise exception 'Finish your current run before starting another.';
  end if;
  if v_boarded < 0 or v_boarded > d.capacity then
    raise exception 'Boarding would exceed the vehicle''s capacity.';
  end if;

  select coalesce(f.base_fare, r.fare) into v_fare
  from (select 1) x
  left join fare_matrices f
    on f.routes_id = r.routes_id and f.active and f.vehicle_classification in ('PUJ','PUV')
  order by (f.tariff_tier = 'REGULAR') desc nulls last
  limit 1;

  v_stops := case when jsonb_typeof(r.stops) = 'array' then r.stops else '[]'::jsonb end;

  insert into driver_runs (driver_id, routes_id, route_name, plate, capacity, fare, reference,
                           status, stop_index, onboard, total_boarded, revision, stops)
  values (v_uid, r.routes_id, r.route_name, d.plate_number,
          d.capacity, coalesce(v_fare, 0), coalesce(nullif(r.reference, ''), 'Fare matrix'),
          'In progress', 0, v_boarded, v_boarded, 1, v_stops)
  returning run_id into v_run;

  if v_boarded > 0 then
    insert into driver_run_events (run_id, stop, boarded, alighted, onboard, type)
    values (v_run, coalesce(nullif(v_stops->0->>'name', ''), 'Terminal'), v_boarded, 0, v_boarded, 'departure');
  end if;

  return public.run_payload(v_run);
end $$;

revoke execute on function public.start_run(int) from public, anon;
grant execute on function public.start_run(int) to authenticated;

create or replace function public.advance_run(
  p_run_id uuid, p_revision int, p_boarded int, p_alighted int, p_complete boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r driver_runs;
  v_boarded int := case when p_complete then 0 else coalesce(p_boarded, 0) end;
  v_alighted int;
  v_onboard int;
  v_last int;
  v_index int;
begin
  select * into r from driver_runs where run_id = p_run_id for update;
  if not found then raise exception 'Trip record not found.'; end if;
  if r.driver_id <> auth.uid() then
    raise exception 'Only the assigned driver can update this run.';
  end if;
  if r.status = 'Completed' then
    raise exception 'This run is already completed.';
  end if;
  if p_revision is not null and p_revision <> r.revision then
    raise exception 'This run changed. Refresh it before making another update.' using errcode = '40001';
  end if;

  v_alighted := case when p_complete then r.onboard else coalesce(p_alighted, 0) end;
  if v_boarded < 0 or v_alighted < 0 then
    raise exception 'Passenger counts cannot be negative.';
  end if;
  if v_alighted > r.onboard then
    raise exception 'More passengers cannot get off than are on board.';
  end if;
  v_onboard := r.onboard - v_alighted + v_boarded;
  if v_onboard > r.capacity then
    raise exception 'Boarding would exceed the vehicle''s capacity.';
  end if;

  v_last := greatest(0, jsonb_array_length(coalesce(r.stops, '[]'::jsonb)) - 1);
  v_index := r.stop_index;

  update driver_runs set
    status = case when p_complete then 'Completed' else status end,
    ended_at = case when p_complete then now() else ended_at end,
    onboard = v_onboard,
    total_boarded = r.total_boarded + v_boarded,
    stop_index = case when p_complete then v_last else least(v_index + 1, v_last) end,
    revision = r.revision + 1
  where run_id = r.run_id;

  insert into driver_run_events (run_id, stop, boarded, alighted, onboard, type)
  values (
    r.run_id,
    case when p_complete then coalesce(nullif(r.stops->v_last->>'name', ''), 'Final stop')
         else coalesce(nullif(r.stops->v_index->>'name', ''), 'Stop') end,
    v_boarded, v_alighted, v_onboard,
    case when p_complete then 'complete' else 'stop' end
  );

  return public.run_payload(r.run_id);
end $$;

revoke execute on function public.advance_run(uuid, int, int, int, boolean) from public, anon;
grant execute on function public.advance_run(uuid, int, int, int, boolean) to authenticated;

insert into public.vehicles (vehicle_id, routes_id, plate_number, body_number, capacity, vehicle_type,
                             name, status, current_driver, current_lat, current_lng, location_updated_at,
                             registration_details, active)
values
  ('DEMO-PUV-01', 'CB01', 'NDM 1101', 'PUV-01', 22, 'Modern PUV', 'Angkol PUV 01', 'In Terminal',
   'Ramon Dela Cruz', 12.0676, 124.5942, now(), '{"demo": true}', true),
  ('DEMO-PUV-02', 'CB01', 'NDM 1102', 'PUV-02', 22, 'Modern PUV', 'Angkol PUV 02', 'In transit',
   'Lito Abad', 12.0740, 124.5985, now(), '{"demo": true}', true),
  ('DEMO-PUV-03', 'CB02', 'NDM 2201', 'PUV-03', 22, 'Modern PUV', 'Angkol PUV 03', 'In Terminal',
   'Jun Ortega', 12.056276, 124.619675, now(), '{"demo": true}', true),
  ('DEMO-PUV-04', 'CB02', 'NDM 2202', 'PUV-04', 22, 'Modern PUV', 'Angkol PUV 04', 'In transit',
   'Nestor Cabrera', 12.0640, 124.5820, now(), '{"demo": true}', true),
  ('DEMO-PUV-05', 'CB03', 'NDM 3301', 'PUV-05', 22, 'Modern PUV', 'Angkol PUV 05', 'In Terminal',
   'Danilo Uy', 12.063844, 124.601375, now(), '{"demo": true}', true),
  ('DEMO-PUV-06', 'CB03', 'NDM 3302', 'PUV-06', 22, 'Modern PUV', 'Angkol PUV 06', 'In transit',
   'Arnel Sabado', 12.0590, 124.6150, now(), '{"demo": true}', true)
on conflict (vehicle_id) do nothing;
