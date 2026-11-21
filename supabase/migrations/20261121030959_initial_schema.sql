-- Angkol live schema (Supabase / PostgreSQL)
-- Run once in the Supabase SQL editor on a fresh project.
-- Tables follow rdbm.drawio.png. Columns marked "+" are required by the
-- existing UI and are additive, never renamed.

-- ---------------------------------------------------------------- routes
create table if not exists public.routes (
  routes_id             text primary key,
  route_name            text not null,
  route_polyline        jsonb,                                  -- GeoJSON LineString
  start_location        jsonb,                                  -- { name, latitude, longitude }
  end_location          jsonb,
  ltfrb_route_definition text not null default '',
  transport_type        text not null default 'PUJ / PUV',
  destination           text not null default '',               -- +
  stops                 jsonb not null default '[]'::jsonb,     -- + Point[] in order
  fare                  numeric(10,2) not null default 0,       -- + display fare
  interval_minutes      int not null default 15,                -- +
  starts_at             time not null default '06:00',          -- +
  ends_at               time not null default '20:00',          -- +
  scheduled             boolean not null default true,          -- +
  active                boolean not null default true,          -- +
  approved              boolean not null default false,         -- +
  reference             text not null default 'LTFRB'
);

create table if not exists public.terminals (
  terminal_id          text primary key,
  routes_id            text references public.routes(routes_id) on delete cascade,
  station_name         text not null,
  physical_information jsonb not null default '{}'::jsonb,
  latitude             double precision not null,
  longitude            double precision not null,
  active               boolean not null default true           -- +
);

create table if not exists public.terminal_schedules (
  sched_id                uuid primary key default gen_random_uuid(),
  terminal_id             text references public.terminals(terminal_id) on delete cascade,
  routes_id               text references public.routes(routes_id) on delete cascade,
  estimated_departure_time time not null default '06:00',
  target_dispatch_interval int not null default 15,
  operational_time_window  text not null default '06:00-20:00'
);

create table if not exists public.fare_matrices (
  fare_id               uuid primary key default gen_random_uuid(),
  routes_id             text references public.routes(routes_id) on delete cascade,
  base_fare             numeric(10,2) not null default 0,
  per_kilometer_rate    numeric(10,2) not null default 0,
  included_km           numeric(10,2) not null default 0,       -- + used by the stated formula
  tariff_tier           text not null default 'REGULAR',
  vehicle_classification text not null default 'Tricycle',
  active                boolean not null default true
);

-- ---------------------------------------------------------------- users
create table if not exists public.users (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  credentials         text not null default 'supabase-auth',
  profile_information jsonb not null default '{}'::jsonb,
  contact_numbers     text not null default '',
  assigned_roles      text[] not null default array['Passenger'],
  -- registration form fields (commuter + driver) -------------------------
  email               text not null unique,
  name                text not null default '',
  birthday            date,
  phone               text not null default '',
  consent             boolean not null default false,
  photo               text,
  -- role / admin / franchise --------------------------------------------
  admin_level         text,
  franchise_name      text,
  verified            boolean not null default false,
  application_status  text not null default 'accepted'
                      check (application_status in ('pending','accepted','declined')),
  created_at          timestamptz not null default now()
);

create table if not exists public.drivers (
  driver_id                 uuid primary key default gen_random_uuid(),
  user_id                   uuid not null unique references public.users(user_id) on delete cascade,
  verification_details      jsonb not null default '{}'::jsonb,
  license_number            text not null default '',
  operational_classification text not null default 'Tricycle'
                            check (operational_classification in ('Tricycle','PUJ','PUV')),
  availability_status       text not null default 'offline',
  association               text not null default '',           -- + tricycle form
  permit_number             text not null default '',           -- + prangkisa
  license_doc_attached      boolean not null default false,     -- + form checkbox
  plate_number              text not null default '',           -- + tricycle form
  capacity                  int not null default 3,             -- + form field
  franchise_name            text,                               -- + PUJ form
  routes_id                 text references public.routes(routes_id) on delete set null,
  verified                  boolean not null default false,
  current_lat               double precision,
  current_lng               double precision,
  location_updated_at       timestamptz
);

create table if not exists public.vehicles (
  vehicle_id           text primary key,
  driver_id            uuid references public.users(user_id) on delete set null,
  routes_id            text references public.routes(routes_id) on delete set null,
  registration_details jsonb not null default '{}'::jsonb,
  plate_number         text not null unique,
  body_number          text not null default '',
  capacity             int not null default 18,
  vehicle_type         text not null default 'Jeepney',
  name                 text not null default '',                -- +
  status               text not null default 'In Terminal',     -- +
  owner_id             uuid references public.users(user_id) on delete set null,
  current_driver       text not null default '',                -- +
  current_lat          double precision,
  current_lng          double precision,
  location_updated_at  timestamptz,
  active               boolean not null default true
);

-- ---------------------------------------------------------------- bookings
create table if not exists public.bookings (
  booking_id            uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(user_id) on delete cascade,
  driver_id             uuid references public.users(user_id) on delete set null,
  declined_by           uuid[] not null default '{}',            -- + drivers who passed
  routes_id             text references public.routes(routes_id) on delete set null,
  pickup_latitude       double precision not null,
  pickup_longitude      double precision not null,
  dropoff_latitude      double precision not null,
  dropoff_longitude     double precision not null,
  pickup_name           text not null default '',               -- +
  dropoff_name          text not null default '',               -- +
  calculated_fixed_fare numeric(10,2) not null default 0,
  request_status        text not null default 'Requested',     -- + Status union
  service_type          text not null default 'Tricycle'
                        check (service_type in ('Tricycle','PUJ/PUV')),
  payment_method        text not null default 'Cash',           -- +
  distance_km           numeric(10,2) not null default 0,       -- +
  duration_min          int not null default 0,                 -- +
  route_polyline        jsonb,                                  -- + GeoJSON
  pickup_note           text,                                   -- +
  driver_name           text not null default '',               -- + PUJ walk-up trips
  driver_plate          text not null default '',               -- + PUJ walk-up trips
  rating                int check (rating between 1 and 5),     -- + passenger rating
  timestamps            jsonb not null default '{}'::jsonb,     -- + epoch ms per status
  expires_at            timestamptz,
  created_at            timestamptz not null default now()
);

-- Safe to re-run on an existing project.
alter table public.bookings add column if not exists declined_by uuid[] not null default '{}';

create table if not exists public.trip_records (
  trip_id        uuid primary key default gen_random_uuid(),
  booking_id     uuid not null unique references public.bookings(booking_id) on delete cascade,
  driver_id      uuid references public.users(user_id) on delete set null,
  user_id        uuid references public.users(user_id) on delete set null,
  actual_distance numeric(10,2) not null default 0,
  payment_status text not null default 'unpaid',
  total_duration int not null default 0,
  started_at     timestamptz,
  completed_at   timestamptz,
  rating         int check (rating between 1 and 5),             -- +
  created_at     timestamptz not null default now()
);

create table if not exists public.vehicle_locations (
  loc_id      bigserial primary key,
  vehicle_id  text references public.vehicles(vehicle_id) on delete cascade,
  driver_id   uuid references public.users(user_id) on delete cascade,
  latitude    double precision not null,
  longitude   double precision not null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  log_id               bigserial primary key,
  user_id              uuid references public.users(user_id) on delete set null,
  event_type           text not null,
  event_details        jsonb not null default '{}'::jsonb,
  login_attempt_status text,
  created_at           timestamptz not null default now()
);

create table if not exists public.data_analysis (
  data_id                  bigserial primary key,
  routes_id                text references public.routes(routes_id) on delete cascade,
  analysis_date            date not null default current_date,
  peak_travel_hours        text not null default '',
  passenger_demand_heatmap jsonb not null default '[]'::jsonb,
  route_utilization_rate   numeric(6,2) not null default 0,
  operational_efficiency   numeric(6,2) not null default 0
);

-- ---------------------------------------------------------------- app tables
-- Required by existing screens; not present in the ERD but do not conflict.
create table if not exists public.driver_runs (
  run_id        uuid primary key default gen_random_uuid(),
  driver_id     uuid not null references public.users(user_id) on delete cascade,
  routes_id     text references public.routes(routes_id) on delete set null,
  route_name    text not null default '',
  plate         text not null default '',
  capacity      int not null default 18,
  fare          numeric(10,2) not null default 0,
  reference     text not null default 'LTFRB',
  status        text not null default 'In progress',
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  stop_index    int not null default 0,
  onboard       int not null default 0,
  total_boarded int not null default 0,
  cash_fares    numeric(10,2) not null default 0,
  revision      int not null default 1,
  stops         jsonb not null default '[]'::jsonb
);

create table if not exists public.driver_run_events (
  event_id bigserial primary key,
  run_id   uuid not null references public.driver_runs(run_id) on delete cascade,
  at       timestamptz not null default now(),
  stop     text not null default '',
  boarded  int not null default 0,
  alighted int not null default 0,
  onboard  int not null default 0,
  type     text not null default 'stop'
);

create table if not exists public.stop_requests (
  request_id uuid primary key default gen_random_uuid(),
  routes_id  text references public.routes(routes_id) on delete cascade,
  point      jsonb not null,
  passenger  text not null default '',
  user_id    uuid references public.users(user_id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  report_id   uuid primary key default gen_random_uuid(),
  details     text not null,
  booking_id  uuid references public.bookings(booking_id) on delete set null,
  status      text not null default 'open',
  reporter    text not null default '',
  reporter_id uuid references public.users(user_id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.notifications (
  notification_id uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(user_id) on delete cascade,
  message         text not null,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists public.landmarks (
  landmark_id text primary key,
  name        text not null,
  latitude    double precision not null,
  longitude   double precision not null
);

-- ---------------------------------------------------------------- helpers
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select assigned_roles[1] from public.users where user_id = auth.uid()), '');
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() in ('Administrator','Vehicle Owner / Operator');
$$;

create or replace function public.quote_fare(p_distance_km numeric, p_class text default 'Tricycle')
returns numeric language sql stable as $$
  select coalesce(round(base_fare + greatest(0, p_distance_km - included_km) * per_kilometer_rate), 0)
  from public.fare_matrices
  where active and vehicle_classification = p_class and routes_id is null
  order by tariff_tier = 'REGULAR' desc
  limit 1;
$$;

create or replace function public.transition_booking(p_booking_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b bookings; v_role text := public.my_role(); v_uid uuid := auth.uid(); v_now timestamptz := now();
begin
  select * into b from bookings where booking_id = p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if v_role = 'Passenger' and b.user_id <> v_uid then raise exception 'Not your booking'; end if;
  if v_role in ('Tricycle driver','PUJ / PUV driver')
     and b.driver_id is not null and b.driver_id <> v_uid then
    raise exception 'Assigned to another driver';
  end if;
  if v_role = 'Passenger' and p_status not in ('Cancelled','Completed') then
    raise exception 'Passengers can only cancel or complete';
  end if;

  update bookings set
    request_status = p_status,
    driver_id = case when v_role in ('Tricycle driver','PUJ / PUV driver') and b.driver_id is null
                     then v_uid else b.driver_id end,
    declined_by = case when v_role in ('Tricycle driver','PUJ / PUV driver') and b.driver_id is null
                       then '{}'::uuid[] else b.declined_by end,
    timestamps = coalesce(b.timestamps,'{}'::jsonb)
                 || jsonb_build_object(p_status, (extract(epoch from v_now)*1000)::bigint)
  where booking_id = p_booking_id;

  if p_status = 'Completed' then
    insert into trip_records (booking_id, driver_id, user_id, actual_distance,
                              payment_status, total_duration, started_at, completed_at)
    values (p_booking_id,
            coalesce(b.driver_id,
                     case when v_role in ('Tricycle driver','PUJ / PUV driver') then v_uid end),
            b.user_id, b.distance_km,
            case when b.payment_method = 'Cash' then 'unpaid' else 'paid' end,
            b.duration_min, v_now, v_now)
    on conflict (booking_id) do update
      set completed_at = v_now, total_duration = b.duration_min;
  end if;

  return jsonb_build_object('ok', true, 'booking_id', p_booking_id, 'status', p_status);
end $$;

-- A driver passes on an open request: put it back in the pool for the next nearest driver.
create or replace function public.release_booking(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b bookings; v_uid uuid := auth.uid(); v_role text := public.my_role();
begin
  if v_role not in ('Tricycle driver','PUJ / PUV driver') then
    raise exception 'Only drivers can decline a ride';
  end if;

  select * into b from bookings where booking_id = p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.driver_id is not null and b.driver_id <> v_uid then
    raise exception 'Assigned to another driver';
  end if;
  if b.request_status <> 'Requested' then
    raise exception 'This ride is no longer open';
  end if;

  update bookings set
    driver_id = null,
    declined_by = (select array_agg(distinct x) from unnest(b.declined_by || v_uid) as x),
    timestamps = coalesce(b.timestamps,'{}'::jsonb)
                 || jsonb_build_object('Declined', (extract(epoch from now())*1000)::bigint)
  where booking_id = p_booking_id;

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
    raise exception 'You can only rate your own completed trip';
  end if;

  update bookings set rating = greatest(1, least(5, p_rating))
  where booking_id = p_booking_id;

  update trip_records set rating = greatest(1, least(5, p_rating))
  where booking_id = p_booking_id;
end $$;

-- ---------------------------------------------------------------- auth trigger
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text := coalesce(m->>'role', 'Passenger');
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
    m->>'admin_level', m->>'franchise_name', m, coalesce(m->>'phone',''),
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
      coalesce(m->>'plate',''), coalesce((m->>'capacity')::int, 3),
      m->>'franchise_name',
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Prevent privilege escalation through direct profile updates.
create or replace function public.guard_user_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Trusted server contexts (SQL editor, service role) have no auth.uid().
  if auth.uid() is not null and not public.is_admin() then
    new.assigned_roles := old.assigned_roles;
    new.admin_level := old.admin_level;
    new.verified := old.verified;
    new.application_status := old.application_status;
    new.email := old.email;
  end if;
  return new;
end $$;

drop trigger if exists guard_user_update on public.users;
create trigger guard_user_update
before update on public.users
for each row execute function public.guard_user_update();

create or replace function public.guard_driver_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.verified := old.verified;
    new.routes_id := old.routes_id;
  end if;
  return new;
end $$;

drop trigger if exists guard_driver_update on public.drivers;
create trigger guard_driver_update
before update on public.drivers
for each row execute function public.guard_driver_update();

-- ---------------------------------------------------------------- activity trail
-- Ride-status notifications for the passenger.
create or replace function public.notify_booking_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_message text;
begin
  if tg_op = 'UPDATE' then
    if new.request_status is not distinct from old.request_status then return new; end if;
  end if;

  v_message := case new.request_status
    when 'Requested'   then 'Your ride request was sent. Looking for a nearby available driver.'
    when 'Accepted'    then 'A driver accepted your ride request and is on the way.'
    when 'Arrived'     then 'Your driver has arrived at the pickup point.'
    when 'In progress' then 'Your trip has started. Track the driver on the map.'
    when 'Completed'   then 'Trip completed. Thank you for riding with Angkol.'
    when 'Cancelled'   then 'Your ride was cancelled.'
    else null end;

  if v_message is not null then
    insert into public.notifications (user_id, message) values (new.user_id, v_message);
  end if;
  return new;
end $$;

drop trigger if exists on_booking_notify on public.bookings;
create trigger on_booking_notify
after insert or update on public.bookings
for each row execute function public.notify_booking_change();

-- Audit log for booking lifecycle changes.
create or replace function public.audit_booking_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.request_status is not distinct from old.request_status then
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_logs (user_id, event_type, event_details)
    values (auth.uid(), 'booking.delete',
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

drop trigger if exists on_booking_audit on public.bookings;
create trigger on_booking_audit
after insert or update or delete on public.bookings
for each row execute function public.audit_booking_change();

-- Audit log for account verification / role changes (admin actions).
create or replace function public.audit_user_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_roles is not distinct from old.assigned_roles
     and new.verified is not distinct from old.verified
     and new.application_status is not distinct from old.application_status then
    return new;
  end if;
  insert into public.audit_logs (user_id, event_type, event_details)
  values (
    auth.uid(),
    'user.updated',
    jsonb_build_object(
      'target_user_id', new.user_id,
      'roles', new.assigned_roles,
      'verified', new.verified,
      'application_status', new.application_status
    )
  );
  return new;
end $$;

drop trigger if exists on_user_audit on public.users;
create trigger on_user_audit
after update on public.users
for each row execute function public.audit_user_change();

-- ---------------------------------------------------------------- RLS
alter table public.users            enable row level security;
alter table public.drivers          enable row level security;
alter table public.vehicles         enable row level security;
alter table public.routes           enable row level security;
alter table public.terminals        enable row level security;
alter table public.terminal_schedules enable row level security;
alter table public.fare_matrices    enable row level security;
alter table public.bookings         enable row level security;
alter table public.trip_records     enable row level security;
alter table public.vehicle_locations enable row level security;
alter table public.audit_logs       enable row level security;
alter table public.data_analysis    enable row level security;
alter table public.driver_runs      enable row level security;
alter table public.driver_run_events enable row level security;
alter table public.stop_requests    enable row level security;
alter table public.reports          enable row level security;
alter table public.notifications    enable row level security;
alter table public.landmarks        enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- read access
create policy read_users on public.users for select to authenticated using (true);
create policy read_drivers on public.drivers for select to authenticated using (true);
create policy read_vehicles on public.vehicles for select to authenticated using (true);
create policy read_routes on public.routes for select to authenticated using (true);
create policy read_terminals on public.terminals for select to authenticated using (true);
create policy read_terminal_schedules on public.terminal_schedules for select to authenticated using (true);
create policy read_fare_matrices on public.fare_matrices for select to authenticated using (true);
create policy read_landmarks on public.landmarks for select to authenticated using (true);
create policy read_vehicle_locations on public.vehicle_locations for select to authenticated using (true);
create policy read_data_analysis on public.data_analysis for select to authenticated using (public.is_admin());
create policy read_audit_logs on public.audit_logs for select to authenticated using (public.is_admin());

create policy read_bookings on public.bookings for select to authenticated using (
  user_id = auth.uid() or driver_id = auth.uid() or public.is_admin()
  or (driver_id is null and request_status = 'Requested'
      and public.my_role() in ('Tricycle driver','PUJ / PUV driver')
      and not (auth.uid() = any(declined_by)))
);
create policy read_trip_records on public.trip_records for select to authenticated using (
  user_id = auth.uid() or driver_id = auth.uid() or public.is_admin()
);
create policy read_runs on public.driver_runs for select to authenticated using (
  driver_id = auth.uid() or public.is_admin()
);
create policy read_run_events on public.driver_run_events for select to authenticated using (
  exists (select 1 from public.driver_runs r where r.run_id = driver_run_events.run_id
          and (r.driver_id = auth.uid() or public.is_admin()))
);
create policy read_stop_requests on public.stop_requests for select to authenticated using (true);
create policy read_reports on public.reports for select to authenticated using (
  reporter_id = auth.uid() or public.is_admin()
);

-- writes
create policy update_self on public.users for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy update_users_admin on public.users for update to authenticated using (public.is_admin());

create policy write_own_driver on public.drivers for update to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy insert_own_driver on public.drivers for insert to authenticated
  with check (user_id = auth.uid());

create policy write_vehicles on public.vehicles for all to authenticated
  using (owner_id = auth.uid() or driver_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or driver_id = auth.uid() or public.is_admin());

create policy write_routes on public.routes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy write_terminals on public.terminals for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy write_terminal_schedules on public.terminal_schedules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy write_fare_matrices on public.fare_matrices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy write_landmarks on public.landmarks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy write_data_analysis on public.data_analysis for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy write_audit_logs on public.audit_logs for insert to authenticated
  with check (user_id = auth.uid());

create policy insert_bookings on public.bookings for insert to authenticated
  with check (user_id = auth.uid());
create policy insert_locations on public.vehicle_locations for insert to authenticated
  with check (driver_id = auth.uid());
create policy insert_stop_requests on public.stop_requests for insert to authenticated
  with check (user_id = auth.uid());
create policy delete_stop_requests on public.stop_requests for delete to authenticated
  using (user_id = auth.uid() or public.my_role() in ('Tricycle driver','PUJ / PUV driver') or public.is_admin());

create policy write_runs on public.driver_runs for all to authenticated
  using (driver_id = auth.uid() or public.is_admin())
  with check (driver_id = auth.uid() or public.is_admin());
create policy write_run_events on public.driver_run_events for all to authenticated
  using (exists (select 1 from public.driver_runs r where r.run_id = driver_run_events.run_id
                 and (r.driver_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.driver_runs r where r.run_id = driver_run_events.run_id
                 and (r.driver_id = auth.uid() or public.is_admin())));

create policy insert_reports on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());
create policy update_reports on public.reports for update to authenticated using (public.is_admin());

create policy read_own_notifications on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy update_notifications on public.notifications for update to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------- indexes
create index if not exists bookings_user_status_idx on public.bookings(user_id, request_status);
create index if not exists bookings_driver_status_idx on public.bookings(driver_id, request_status);
create index if not exists bookings_created_idx on public.bookings(created_at desc);
create index if not exists bookings_open_idx on public.bookings(request_status) where driver_id is null;
create index if not exists locations_vehicle_idx on public.vehicle_locations(vehicle_id, recorded_at desc);
create index if not exists notifications_user_idx on public.notifications(user_id, read);
create index if not exists runs_driver_idx on public.driver_runs(driver_id, started_at desc);
create index if not exists users_email_idx on public.users(lower(email));

-- ---------------------------------------------------------------- realtime
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$ begin
  begin
    alter publication supabase_realtime add table public.bookings;
    alter publication supabase_realtime add table public.vehicle_locations;
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------- seed data
insert into public.routes (routes_id, route_name, transport_type, destination, stops, fare,
  interval_minutes, starts_at, ends_at, scheduled, active, approved, reference,
  start_location, end_location, route_polyline)
values
 ('CB01','Calbayog City Hall ↔ Obrero','PUJ / PUV','Obrero',
  '[{"name":"Calbayog City Hall","latitude":12.0676,"longitude":124.5942},{"name":"Public Market","latitude":12.0701,"longitude":124.5961},{"name":"Obrero","latitude":12.0798,"longitude":124.6041}]',
  15.00, 15, '06:00', '20:00', true, true, true, 'LTFRB fare matrix',
  '{"name":"Calbayog City Hall","latitude":12.0676,"longitude":124.5942}',
  '{"name":"Obrero","latitude":12.0798,"longitude":124.6041}', null),
 ('CB02','Bagacay ↔ Airport','PUJ / PUV','Calbayog Airport',
  '[{"name":"Bagacay","latitude":12.0521,"longitude":124.5821},{"name":"Calbayog Airport","latitude":12.0716,"longitude":124.5661}]',
  20.00, 20, '05:30', '19:30', true, true, true, 'LTFRB fare matrix',
  '{"name":"Bagacay","latitude":12.0521,"longitude":124.5821}',
  '{"name":"Calbayog Airport","latitude":12.0716,"longitude":124.5661}', null),
 ('CB03','Terminal ↔ Carayman','PUJ / PUV','Carayman',
  '[{"name":"Calbayog Transport Terminal","latitude":12.0631,"longitude":124.6011},{"name":"Carayman","latitude":12.0471,"longitude":124.6121}]',
  18.00, 12, '06:00', '21:00', true, true, true, 'LTFRB fare matrix',
  '{"name":"Calbayog Transport Terminal","latitude":12.0631,"longitude":124.6011}',
  '{"name":"Carayman","latitude":12.0471,"longitude":124.6121}', null)
on conflict (routes_id) do nothing;

insert into public.terminals (terminal_id, routes_id, station_name, physical_information, latitude, longitude)
values
 ('TERM01','CB01','Calbayog City Hall','{"roofed":true,"bays":4}',12.0676,124.5942),
 ('TERM02','CB02','Bagacay Terminal','{"roofed":true,"bays":3}',12.0521,124.5821),
 ('TERM03','CB03','Calbayog Transport Terminal','{"roofed":true,"bays":12}',12.0631,124.6011)
on conflict (terminal_id) do nothing;

insert into public.terminal_schedules (terminal_id, routes_id, estimated_departure_time, target_dispatch_interval)
select t.terminal_id, t.routes_id, r.starts_at, r.interval_minutes
from public.terminals t join public.routes r on r.routes_id = t.routes_id
where not exists (
  select 1 from public.terminal_schedules s where s.terminal_id = t.terminal_id
);

insert into public.fare_matrices (routes_id, base_fare, per_kilometer_rate, included_km, tariff_tier, vehicle_classification)
select null, 10.00, 5.00, 0, 'REGULAR', 'Tricycle'
where not exists (select 1 from public.fare_matrices where vehicle_classification = 'Tricycle');

insert into public.fare_matrices (routes_id, base_fare, per_kilometer_rate, included_km, tariff_tier, vehicle_classification)
select r.routes_id, r.fare, 0, 0, 'REGULAR', 'PUJ'
from public.routes r
where not exists (
  select 1 from public.fare_matrices f where f.routes_id = r.routes_id and f.vehicle_classification = 'PUJ'
);

insert into public.landmarks (landmark_id, name, latitude, longitude) values
 ('LM01','Calbayog City Hall',12.0676,124.5942),
 ('LM02','Calbayog Public Market',12.0701,124.5961),
 ('LM03','Calbayog Transport Terminal',12.0631,124.6011),
 ('LM04','Calbayog Airport',12.0716,124.5661),
 ('LM05','St. Peter and Paul Cathedral',12.0662,124.5953),
 ('LM06','Obrero',12.0798,124.6041),
 ('LM07','Bagacay',12.0521,124.5821),
 ('LM08','Carayman',12.0471,124.6121),
 ('LM09','Northwest Samar State University',12.0671,124.6052),
 ('LM10','Calbayog City Sports Center',12.0691,124.5991)
on conflict (landmark_id) do nothing;
