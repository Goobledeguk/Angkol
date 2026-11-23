alter table public.notifications
  add column if not exists booking_id uuid references public.bookings(booking_id) on delete set null;

create index if not exists notifications_booking_id_idx on public.notifications(booking_id);

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
    insert into public.notifications (user_id, message, booking_id)
    values (new.user_id, v_message, new.booking_id);
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
    join lateral (
      select r.onboard from public.driver_runs r
      where r.driver_id = v.driver_id and r.status = 'In progress' and r.routes_id = v.routes_id
      order by r.started_at desc limit 1
    ) run on run.onboard is not null
    where v.routes_id = new.routes_id and v.active
      and v.status not in ('Broken / Inactive', 'Decommissioned')
      and v.capacity - run.onboard - (
        select count(*) from public.bookings s
        where s.vehicle_id = v.vehicle_id and s.request_status in ('Arrived', 'In progress')
      ) > 0
    order by (v.status = 'In Terminal') desc,
             v.location_updated_at desc nulls last
    limit 1;

    if not found then
      if not v_found_any then
        raise exception 'No vehicle is running this route right now. Try again shortly.';
      end if;
      if not exists (
        select 1
        from public.vehicles v
        join public.driver_runs r on r.driver_id = v.driver_id and r.routes_id = v.routes_id
        where v.routes_id = new.routes_id and v.active
          and v.status not in ('Broken / Inactive', 'Decommissioned')
          and r.status = 'In progress' and r.onboard is not null
      ) then
        raise exception 'Every jeepney on this route is still at the terminal. Go to the terminal and ride the next one.';
      end if;
      raise exception 'Every PUV on this route is full right now. Try again shortly.';
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
