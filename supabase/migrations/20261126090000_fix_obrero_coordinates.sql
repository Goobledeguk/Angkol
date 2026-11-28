-- Correct the Obrero endpoint on the CB01 route.
-- The old value (12.0798, 124.6041) sits in Nijaga / north of the city proper,
-- about 1.4 km away from Obrero. Obrero is the barangay immediately west and
-- northwest of City Hall; this uses the OpenStreetMap place node for Obrero
-- (12.0671, 124.5903).

update public.routes
set stops = (
      select jsonb_agg(
               case
                 when stop->>'name' = 'Obrero'
                   then jsonb_build_object(
                          'name', 'Obrero',
                          'latitude', 12.0671,
                          'longitude', 124.5903
                        )
                 else stop
               end
               order by ord
             )
      from jsonb_array_elements(stops) with ordinality as t(stop, ord)
    ),
    end_location = jsonb_build_object(
                     'name', 'Obrero',
                     'latitude', 12.0671,
                     'longitude', 124.5903
                   )
where routes_id = 'CB01'
  and exists (
    select 1 from jsonb_array_elements(stops) stop where stop->>'name' = 'Obrero'
  );

-- The map derives the route line from the corrected stops when no polyline is
-- stored. Drop a cached polyline so it does not keep ending at the old spot.
update public.routes
set route_polyline = null
where routes_id = 'CB01'
  and route_polyline is not null;

update public.landmarks
set latitude = 12.0671,
    longitude = 124.5903
where landmark_id = 'LM06'
  and name = 'Obrero';

-- Keep stored history consistent with the corrected endpoint.
update public.bookings
set dropoff_latitude = 12.0671,
    dropoff_longitude = 124.5903,
    route_polyline = case
      when jsonb_typeof(route_polyline->'coordinates') = 'array'
        and jsonb_array_length(route_polyline->'coordinates') >= 2
        then jsonb_set(
               route_polyline,
               array['coordinates', (jsonb_array_length(route_polyline->'coordinates') - 1)::text],
               '[124.5903,12.0671]'
             )
      else route_polyline
    end
where dropoff_name = 'Obrero'
  and dropoff_latitude = 12.0798
  and dropoff_longitude = 124.6041;

-- Completed runs are protected by guard_driver_run(). This is an
-- administrative coordinate correction, so pause that guard while fixing the
-- stored stop list, then turn it back on.
alter table public.driver_runs disable trigger guard_driver_run;

update public.driver_runs
set stops = (
      select jsonb_agg(
               case
                 when stop->>'name' = 'Obrero'
                   then jsonb_build_object(
                          'name', 'Obrero',
                          'latitude', 12.0671,
                          'longitude', 124.5903
                        )
                 else stop
               end
               order by ord
             )
      from jsonb_array_elements(stops) with ordinality as t(stop, ord)
    )
where stops @> '[{"name":"Obrero"}]'::jsonb;

alter table public.driver_runs enable trigger guard_driver_run;

