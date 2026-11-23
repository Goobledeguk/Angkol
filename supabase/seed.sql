-- Angkol test seed data.
--
-- Run once in the Supabase SQL editor (or psql as postgres) AFTER the
-- migrations. Safe to re-run: every row has a fixed id and is skipped if it
-- already exists. Routes, terminals, fares and landmarks come from the
-- migrations; this adds accounts, vehicles and ride history on top.
--
-- Test accounts (all emails confirmed, all drivers approved):
--   driver1@angkol.test    Driver1!     Tricycle driver   (emulator)
--   driver2@angkol.test    Driver2!     Tricycle driver   (emulator)
--   driver3@angkol.test    Driver3!     PUJ / PUV driver  on CB01
--   passenger1@angkol.test Passenger1!  Passenger
--   passenger2@angkol.test Passenger2!  Passenger
--   admin@angkol.test      Admin1!      Administrator     (Technical Team)
--   owner@angkol.test      Owner1!      Vehicle Owner / Operator (Franchise Owner)
--
-- These are fictional TEST accounts. Never seed a production project with them.

begin;

-- ------------------------------------------------------------------ accounts
-- Inserting into auth.users fires handle_new_user, which creates the matching
-- public.users / public.drivers rows from the metadata.
with accounts (id, email, password, meta) as (
  values
    ('00000000-0000-4000-a000-0000000000d1'::uuid, 'driver1@angkol.test', 'Driver1!',
     '{"name":"Miguel Santos","phone":"09171230001","role":"Tricycle driver","plate":"101","association":"Calbayog TODA","license":"N01-24-000101","capacity":3,"consent":true}'::jsonb),
    ('00000000-0000-4000-a000-0000000000d2', 'driver2@angkol.test', 'Driver2!',
     '{"name":"Jose Dela Cruz","phone":"09171230002","role":"Tricycle driver","plate":"102","association":"Obrero TODA","license":"N01-24-000102","capacity":3,"consent":true}'),
    ('00000000-0000-4000-a000-0000000000d3', 'driver3@angkol.test', 'Driver3!',
     '{"name":"Rafael Mendoza","phone":"09171230003","role":"PUJ / PUV driver","plate":"PUJ-1001","license":"N01-24-000103","permit_no":"LTFRB-CB01-001","capacity":18,"franchise_name":"Calbayog Transport Cooperative","consent":true}'),
    ('00000000-0000-4000-a000-0000000000a1', 'passenger1@angkol.test', 'Passenger1!',
     '{"name":"Isabella Reyes","phone":"09171230011","role":"Passenger","consent":true}'),
    ('00000000-0000-4000-a000-0000000000a2', 'passenger2@angkol.test', 'Passenger2!',
     '{"name":"Carlo Bautista","phone":"09171230012","role":"Passenger","consent":true}'),
    ('00000000-0000-4000-a000-0000000000e1', 'admin@angkol.test', 'Admin1!',
     '{"name":"Patricia Lim","phone":"09171230021","consent":true}'),
    ('00000000-0000-4000-a000-0000000000e2', 'owner@angkol.test', 'Owner1!',
     '{"name":"Ramon Villanueva","phone":"09171230022","consent":true}')
),
new_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt(password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', meta, now() - interval '30 days', now(),
    '', '', '', '', '', '', '', ''
  from accounts
  on conflict (id) do nothing
  returning id, email
)
insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id::text, id,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from new_users;

-- Admin roles can't be chosen at sign-up, so set them here.
update public.users set assigned_roles = array['Administrator'], admin_level = 'Technical Team'
where user_id = '00000000-0000-4000-a000-0000000000e1';
update public.users set assigned_roles = array['Vehicle Owner / Operator'], admin_level = 'Franchise Owner',
       franchise_name = 'Calbayog Transport Cooperative'
where user_id = '00000000-0000-4000-a000-0000000000e2';

-- Approve the drivers (syncs drivers.verified) and give everyone a join date.
update public.users set verified = true, application_status = 'accepted'
where user_id in ('00000000-0000-4000-a000-0000000000d1',
                  '00000000-0000-4000-a000-0000000000d2',
                  '00000000-0000-4000-a000-0000000000d3');
update public.users set created_at = now() - interval '30 days'
where email like '%@angkol.test';

update public.drivers set routes_id = 'CB01' where user_id = '00000000-0000-4000-a000-0000000000d3';

-- Tricycles parked near City Hall and the market; the emulator moves them.
update public.drivers set current_lat = 12.0682, current_lng = 124.5950, location_updated_at = now()
where user_id = '00000000-0000-4000-a000-0000000000d1' and current_lat is null;
update public.drivers set current_lat = 12.0705, current_lng = 124.5968, location_updated_at = now()
where user_id = '00000000-0000-4000-a000-0000000000d2' and current_lat is null;
update public.drivers set current_lat = 12.0676, current_lng = 124.5942, location_updated_at = now()
where user_id = '00000000-0000-4000-a000-0000000000d3' and current_lat is null;

-- ------------------------------------------------------------------ vehicles
insert into public.vehicles (vehicle_id, driver_id, routes_id, plate_number, body_number, capacity,
  vehicle_type, name, status, owner_id, current_driver, current_lat, current_lng, location_updated_at,
  registration_details)
values
  ('TRI-101', '00000000-0000-4000-a000-0000000000d1', null, '101', '101', 3, 'Tricycle',
   'Tricycle 101', 'In transit', null, 'Miguel Santos', 12.0682, 124.5950, now(), '{"or_cr":"TEST-101"}'),
  ('TRI-102', '00000000-0000-4000-a000-0000000000d2', null, '102', '102', 3, 'Tricycle',
   'Tricycle 102', 'In transit', null, 'Jose Dela Cruz', 12.0705, 124.5968, now(), '{"or_cr":"TEST-102"}'),
  ('PUJ-1001', '00000000-0000-4000-a000-0000000000d3', 'CB01', 'PUJ-1001', 'CTC-01', 18, 'Jeepney',
   'CTC Jeepney 01', 'In Terminal', '00000000-0000-4000-a000-0000000000e2', 'Rafael Mendoza',
   12.0676, 124.5942, now(), '{"or_cr":"TEST-1001"}'),
  ('PUV-2001', null, 'CB02', 'PUV-2001', 'CTC-02', 14, 'Mini Van',
   'CTC Van 02', 'In Terminal', '00000000-0000-4000-a000-0000000000e2', 'Edwin Mabini',
   12.0563, 124.6197, now(), '{"or_cr":"TEST-2001"}'),
  ('PUJ-1003', null, 'CB03', 'PUJ-1003', 'CTC-03', 18, 'Jeepney',
   'CTC Jeepney 03', 'Broken / Inactive', '00000000-0000-4000-a000-0000000000e2', '',
   12.0638, 124.6014, now() - interval '2 days', '{"or_cr":"TEST-1003"}')
on conflict (vehicle_id) do nothing;

-- ------------------------------------------------------------------ ride history
-- Past rides only, so nobody starts with an active ride.
-- Fares follow the seeded tricycle matrix: ₱10 + ₱5/km.
with rides (id, passenger, driver, vehicle, route, service, status, pickup, plat, plng,
            dropoff, dlat, dlng, km, minutes, fare, rating, payment, days_ago) as (
  values
    ('b0000000-0000-4000-a000-000000000001'::uuid, '00000000-0000-4000-a000-0000000000a1'::uuid,
     '00000000-0000-4000-a000-0000000000d1'::uuid, null::text, null::text, 'Tricycle', 'Completed',
     'Calbayog City Hall', 12.0676, 124.5942, 'Northwest Samar State University', 12.0671, 124.6052,
     1.4, 6, 17, 5, 'Cash', 6),
    ('b0000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-0000000000a1',
     '00000000-0000-4000-a000-0000000000d2', null, null, 'Tricycle', 'Completed',
     'Calbayog Public Market', 12.0701, 124.5961, 'Calbayog Transport Terminal', 12.063844, 124.601375,
     1.1, 5, 16, 4, 'GCash', 3),
    ('b0000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-0000000000a1',
     null, null, null, 'Tricycle', 'Cancelled',
     'St. Peter and Paul Cathedral', 12.0662, 124.5953, 'Calbayog Airport', 12.071184, 124.544383,
     5.9, 14, 40, null, 'Cash', 2),
    ('b0000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-0000000000a1',
     '00000000-0000-4000-a000-0000000000d3', 'PUJ-1001', 'CB01', 'PUJ/PUV', 'Completed',
     'Calbayog City Hall', 12.0676, 124.5942, 'Obrero', 12.0798, 124.6041,
     1.8, 9, 15, 5, 'Cash', 1),
    ('b0000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-0000000000a2',
     '00000000-0000-4000-a000-0000000000d1', null, null, 'Tricycle', 'Completed',
     'Calbayog City Sports Center', 12.0691, 124.5991, 'Calbayog Public Market', 12.0701, 124.5961,
     0.6, 3, 13, 5, 'Cash', 4),
    ('b0000000-0000-4000-a000-000000000006', '00000000-0000-4000-a000-0000000000a2',
     null, null, null, 'Tricycle', 'Expired',
     'Northwest Samar State University', 12.0671, 124.6052, 'Calbayog City Hall', 12.0676, 124.5942,
     1.4, 6, 17, null, 'Cash', 1)
)
insert into public.bookings (booking_id, user_id, driver_id, vehicle_id, routes_id, service_type,
  request_status, pickup_name, pickup_latitude, pickup_longitude, dropoff_name, dropoff_latitude,
  dropoff_longitude, distance_km, duration_min, calculated_fixed_fare, rating, payment_method,
  route_polyline, driver_name, driver_plate, timestamps, expires_at, created_at)
select
  r.id, r.passenger, r.driver, r.vehicle, r.route, r.service, r.status,
  r.pickup, r.plat, r.plng, r.dropoff, r.dlat, r.dlng, r.km, r.minutes, r.fare, r.rating, r.payment,
  jsonb_build_object('type', 'LineString', 'coordinates', jsonb_build_array(
    jsonb_build_array(r.plng, r.plat), jsonb_build_array(r.dlng, r.dlat))),
  case when r.service = 'PUJ/PUV' then 'Rafael Mendoza' else '' end,
  case when r.service = 'PUJ/PUV' then 'PUJ-1001' else '' end,
  case r.status
    when 'Completed' then jsonb_build_object(
      'Requested',   t.ms,
      'Accepted',    t.ms + 60000,
      'Arrived',     t.ms + 240000,
      'In progress', t.ms + 300000,
      'Completed',   t.ms + 300000 + r.minutes * 60000)
    when 'Cancelled' then jsonb_build_object('Requested', t.ms, 'Cancelled', t.ms + 90000)
    else jsonb_build_object('Requested', t.ms, 'Expired', t.ms + 600000)
  end,
  t.at + interval '10 minutes',
  t.at
from rides r
cross join lateral (
  select now() - make_interval(days => r.days_ago, hours => 2) as at
) a
cross join lateral (
  select a.at, (extract(epoch from a.at) * 1000)::bigint as ms
) t
on conflict (booking_id) do nothing;

insert into public.trip_records (booking_id, driver_id, user_id, actual_distance, payment_status,
  total_duration, started_at, completed_at, rating)
select b.booking_id, b.driver_id, b.user_id, b.distance_km,
       case when b.payment_method = 'Cash' then 'paid' else 'pending' end,
       b.duration_min,
       to_timestamp((b.timestamps->>'In progress')::bigint / 1000.0),
       to_timestamp((b.timestamps->>'Completed')::bigint / 1000.0),
       b.rating
from public.bookings b
where b.booking_id::text like 'b0000000-0000-4000-a000-%' and b.request_status = 'Completed'
on conflict (booking_id) do nothing;

-- ------------------------------------------------------------------ PUJ runs
-- One finished run for driver3 (no active run, so they can start a new one).
insert into public.driver_runs (run_id, driver_id, routes_id, route_name, plate, capacity, fare,
  reference, status, started_at, ended_at, stop_index, onboard, total_boarded, revision, stops)
select 'c0000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-0000000000d3', r.routes_id,
       r.route_name, 'PUJ-1001', 18, r.fare, r.reference, 'Completed',
       now() - interval '1 day 3 hours', now() - interval '1 day 2 hours 30 minutes', 2, 0, 15, 4, r.stops
from public.routes r
where r.routes_id = 'CB01'
on conflict (run_id) do nothing;

insert into public.driver_run_events (run_id, at, stop, boarded, alighted, onboard, type)
select 'c0000000-0000-4000-a000-000000000001', now() - e.ago, e.stop, e.boarded, e.alighted, e.onboard, e.type
from (values
  (interval '1 day 3 hours',            'Calbayog City Hall', 9, 0, 9,  'departure'),
  (interval '1 day 2 hours 45 minutes', 'Public Market',      6, 4, 11, 'stop'),
  (interval '1 day 2 hours 30 minutes', 'Obrero',             0, 11, 0, 'arrival')
) as e(ago, stop, boarded, alighted, onboard, type)
where not exists (
  select 1 from public.driver_run_events where run_id = 'c0000000-0000-4000-a000-000000000001'
);

-- ------------------------------------------------------------------ stops, reports, notifications
insert into public.stop_requests (request_id, routes_id, point, passenger, user_id, created_at)
values ('d0000000-0000-4000-a000-000000000001', 'CB01',
        '{"name":"Calbayog City Sports Center","latitude":12.0691,"longitude":124.5991}',
        'Carlo Bautista', '00000000-0000-4000-a000-0000000000a2', now() - interval '20 minutes')
on conflict (request_id) do nothing;

insert into public.reports (report_id, details, booking_id, status, reporter, reporter_id, created_at)
values
  ('e0000000-0000-4000-a000-000000000001',
   'Driver took a longer route than the map showed.', 'b0000000-0000-4000-a000-000000000002',
   'open', 'Isabella Reyes', '00000000-0000-4000-a000-0000000000a1', now() - interval '3 days'),
  ('e0000000-0000-4000-a000-000000000002',
   'Left an umbrella in tricycle 101.', 'b0000000-0000-4000-a000-000000000005',
   'resolved', 'Carlo Bautista', '00000000-0000-4000-a000-0000000000a2', now() - interval '4 days')
on conflict (report_id) do nothing;

insert into public.notifications (notification_id, user_id, message, read, created_at)
values
  ('f0000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-0000000000d1',
   'Your driver account was approved. Go online to start receiving rides.', false, now() - interval '7 days'),
  ('f0000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-0000000000d2',
   'Your driver account was approved. Go online to start receiving rides.', false, now() - interval '7 days'),
  ('f0000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-0000000000d3',
   'You are assigned to route CB01 (Calbayog City Hall ↔ Obrero).', false, now() - interval '7 days'),
  ('f0000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-0000000000e1',
   'New passenger report: driver took a longer route than the map showed.', false, now() - interval '3 days')
on conflict (notification_id) do nothing;

commit;
