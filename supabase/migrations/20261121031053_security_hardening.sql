create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text := case
    when m->>'role' in ('Passenger','Tricycle driver','PUJ / PUV driver') then m->>'role'
    else 'Passenger'
  end;
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
    v_role <> 'PUJ / PUV driver',
    case when v_role = 'PUJ / PUV driver' then 'pending' else 'accepted' end
  ) on conflict (user_id) do nothing;

  if v_role in ('Tricycle driver','PUJ / PUV driver') then
    insert into public.drivers (
      user_id, license_number, operational_classification, association,
      permit_number, license_doc_attached, plate_number, capacity, franchise_name,
      verified, availability_status
    ) values (
      new.id, coalesce(m->>'license',''),
      case when v_role = 'Tricycle driver' then 'Tricycle' else 'PUJ' end,
      coalesce(m->>'association',''), coalesce(m->>'permit_no',''),
      coalesce((m->>'license_doc_attached')::boolean, false),
      coalesce(m->>'plate',''),
      least(greatest(coalesce((m->>'capacity')::int, 3), 1), 60),
      case when v_role = 'PUJ / PUV driver' then m->>'franchise_name' end,
      v_role = 'Tricycle driver',
      'offline'
    );
  end if;

  insert into public.notifications (user_id, message)
  values (
    new.id,
    case when v_role = 'PUJ / PUV driver'
      then 'Welcome to Angkol. Your franchise application is waiting for owner approval.'
      else 'Welcome to Angkol. Your account is ready.'
    end
  );

  return new;
end $$;

alter function public.quote_fare(numeric, text) set search_path = public;

create or replace function public.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql immutable set search_path = '' as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

alter table public.bookings
  add constraint bookings_request_status_check
  check (request_status in ('Requested','Accepted','Arrived','In progress','Completed','Cancelled'));

create or replace function public.prepare_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  v_straight double precision;
  v_fare numeric;
begin
  if auth.uid() is null then
    return new;
  end if;

  new.user_id := auth.uid();
  new.driver_id := null;
  new.declined_by := '{}';
  new.rating := null;
  new.created_at := now();
  new.expires_at := now() + interval '10 minutes';

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

    if v_fare is null then
      raise exception 'Choose an active PUJ/PUV route.';
    end if;

    new.calculated_fixed_fare := v_fare;
    new.request_status := 'Arrived';
    new.timestamps := jsonb_build_object(
      'Requested', v_now_ms, 'Accepted', v_now_ms, 'Arrived', v_now_ms
    );
  end if;

  return new;
end $$;

create trigger prepare_booking
before insert on public.bookings
for each row execute function public.prepare_booking();

create or replace function public.guard_booking_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and current_setting('angkol.trusted_booking_update', true) is distinct from 'on' then
    raise exception 'Bookings can only be changed through the app.';
  end if;
  return new;
end $$;

create trigger guard_booking_update
before update on public.bookings
for each row execute function public.guard_booking_update();

create or replace function public.transition_booking(p_booking_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b bookings;
  v_uid uuid := auth.uid();
  v_role text := public.my_role();
  v_admin boolean := public.is_admin();
  v_now timestamptz := now();
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

  if b.request_status = 'Requested' and p_status = 'Accepted' then
    if v_role <> 'Tricycle driver' or b.service_type <> 'Tricycle' then
      raise exception 'Only tricycle drivers can accept tricycle rides.';
    end if;
    if not exists (
      select 1 from users u join drivers d on d.user_id = u.user_id
      where u.user_id = v_uid and u.verified and u.application_status = 'accepted' and d.verified
    ) then
      raise exception 'Your driver account is not approved yet.';
    end if;
    if b.driver_id is not null and b.driver_id <> v_uid then
      raise exception 'This ride was taken by another driver.';
    end if;
    if v_uid = any(b.declined_by) then
      raise exception 'You already passed on this ride.';
    end if;
    if b.expires_at is not null and b.expires_at < v_now then
      raise exception 'This ride request has expired.';
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
    v_ok := v_passenger;
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
      else v_now
    end;
    insert into trip_records (booking_id, driver_id, user_id, actual_distance,
                              payment_status, total_duration, started_at, completed_at)
    values (p_booking_id, v_new_driver, b.user_id, b.distance_km,
            case when b.payment_method = 'Cash' then 'unpaid' else 'paid' end,
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
  b bookings; v_uid uuid := auth.uid(); v_role text := public.my_role();
begin
  if v_role not in ('Tricycle driver','PUJ / PUV driver') then
    raise exception 'Only drivers can decline a ride.';
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
  if not exists (
    select 1 from bookings
    where booking_id = p_booking_id
      and user_id = auth.uid()
      and request_status = 'Completed'
  ) then
    raise exception 'You can only rate your own completed trip.';
  end if;

  perform set_config('angkol.trusted_booking_update', 'on', true);

  update bookings set rating = greatest(1, least(5, p_rating))
  where booking_id = p_booking_id;

  perform set_config('angkol.trusted_booking_update', 'off', true);

  update trip_records set rating = greatest(1, least(5, p_rating))
  where booking_id = p_booking_id;
end $$;

create or replace function public.shares_booking_with(p_other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings
    where (user_id = auth.uid() and driver_id = p_other)
       or (driver_id = auth.uid() and user_id = p_other)
  );
$$;

alter policy read_users on public.users using (
  user_id = (select auth.uid())
  or public.is_admin()
  or assigned_roles[1] in ('Tricycle driver','PUJ / PUV driver')
  or public.shares_booking_with(user_id)
);

revoke select on public.users from anon, authenticated;
grant select (
  user_id, name, phone, contact_numbers, photo, assigned_roles, admin_level,
  franchise_name, verified, application_status, created_at
) on public.users to authenticated;

alter policy read_drivers on public.drivers using (
  user_id = (select auth.uid())
  or public.is_admin()
  or (verified and availability_status = 'available')
  or public.shares_booking_with(user_id)
);

revoke select on public.drivers from anon, authenticated;
grant select (
  driver_id, user_id, operational_classification, availability_status, association,
  plate_number, capacity, franchise_name, routes_id, verified,
  current_lat, current_lng, location_updated_at
) on public.drivers to authenticated;

create or replace function public.my_profile() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'user', (select to_jsonb(u) from users u where u.user_id = auth.uid()),
    'driver', (select to_jsonb(d) from drivers d where d.user_id = auth.uid())
  );
$$;

create or replace function public.admin_users() returns setof public.users
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only.';
  end if;
  return query select * from users order by created_at desc;
end $$;

create or replace function public.admin_drivers() returns setof public.drivers
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only.';
  end if;
  return query select * from drivers;
end $$;

alter policy read_vehicle_locations on public.vehicle_locations using (
  driver_id = (select auth.uid()) or public.is_admin()
);

alter policy delete_stop_requests on public.stop_requests using (
  user_id = (select auth.uid())
  or public.is_admin()
  or exists (
    select 1 from public.drivers d
    where d.user_id = (select auth.uid()) and d.routes_id = stop_requests.routes_id
  )
);

alter policy insert_reports on public.reports
  with check (reporter_id = (select auth.uid()) and status = 'open');

revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;

grant execute on function
  public.my_role(),
  public.is_admin(),
  public.shares_booking_with(uuid),
  public.quote_fare(numeric, text),
  public.transition_booking(uuid, text),
  public.release_booking(uuid),
  public.rate_booking(uuid, int),
  public.my_profile(),
  public.admin_users(),
  public.admin_drivers()
to authenticated;
