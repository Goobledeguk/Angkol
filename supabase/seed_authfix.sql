begin;

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

update public.drivers set current_lat = 12.0682, current_lng = 124.5950, location_updated_at = now()
where user_id = '00000000-0000-4000-a000-0000000000d1' and current_lat is null;
update public.drivers set current_lat = 12.0705, current_lng = 124.5968, location_updated_at = now()
where user_id = '00000000-0000-4000-a000-0000000000d2' and current_lat is null;
update public.drivers set current_lat = 12.0676, current_lng = 124.5942, location_updated_at = now()
where user_id = '00000000-0000-4000-a000-0000000000d3' and current_lat is null;

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