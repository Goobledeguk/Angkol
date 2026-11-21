create or replace function public.audit_booking_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.request_status is not distinct from old.request_status then
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_logs (user_id, event_type, event_details)
    values ((select u.user_id from public.users u where u.user_id = auth.uid()), 'booking.delete',
      jsonb_build_object('booking_id', old.booking_id, 'status', old.request_status));
    return old;
  end if;

  insert into public.audit_logs (user_id, event_type, event_details)
  values (auth.uid(), 'booking.' || lower(tg_op),
    jsonb_build_object(
      'booking_id', new.booking_id,
      'status', new.request_status,
      'driver_id', new.driver_id
    ));
  return new;
end $$;

create or replace function public.prepare_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  v_straight double precision;
  v_fare numeric;
  v_vehicle public.vehicles%rowtype;
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

    select v.* into v_vehicle
    from public.vehicles v
    where v.routes_id = new.routes_id and v.active and v.status <> 'Broken / Inactive'
    order by (v.status = 'In Terminal') desc, v.location_updated_at desc nulls last
    limit 1;

    if not found then
      raise exception 'No vehicle is running this route right now. Try again shortly.';
    end if;

    new.driver_name := coalesce(nullif(v_vehicle.current_driver, ''), v_vehicle.name);
    new.driver_plate := v_vehicle.plate_number;
    new.calculated_fixed_fare := v_fare;
    new.request_status := 'Arrived';
    new.timestamps := jsonb_build_object(
      'Requested', v_now_ms, 'Accepted', v_now_ms, 'Arrived', v_now_ms
    );
  end if;

  return new;
end $$;
