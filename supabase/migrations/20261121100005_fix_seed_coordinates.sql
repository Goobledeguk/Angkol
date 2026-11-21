drop table if exists pg_temp.seed_fix;
create temporary table seed_fix (
  old_lat double precision,
  old_lng double precision,
  new_lat double precision,
  new_lng double precision
);

insert into seed_fix values
  (12.0521, 124.5821, 12.056276, 124.619675),
  (12.0471, 124.6121, 12.053790, 124.629030),
  (12.0631, 124.6011, 12.063844, 124.601375),
  (12.0716, 124.5661, 12.071184, 124.544383);

update public.landmarks l
set latitude = f.new_lat, longitude = f.new_lng
from seed_fix f
where l.latitude = f.old_lat and l.longitude = f.old_lng;

update public.terminals t
set latitude = f.new_lat, longitude = f.new_lng
from seed_fix f
where t.latitude = f.old_lat and t.longitude = f.old_lng;

create or replace function pg_temp.fix_point(p jsonb) returns jsonb
language sql as $$
  select coalesce(
    (select p || jsonb_build_object('latitude', f.new_lat, 'longitude', f.new_lng)
     from seed_fix f
     where (p->>'latitude')::double precision = f.old_lat
       and (p->>'longitude')::double precision = f.old_lng
     limit 1),
    p
  )
$$;

update public.routes r
set stops = (
      select coalesce(jsonb_agg(pg_temp.fix_point(s) order by i), '[]'::jsonb)
      from jsonb_array_elements(r.stops) with ordinality as e(s, i)
    ),
    start_location = case when jsonb_typeof(r.start_location) = 'object'
                          then pg_temp.fix_point(r.start_location) else r.start_location end,
    end_location = case when jsonb_typeof(r.end_location) = 'object'
                        then pg_temp.fix_point(r.end_location) else r.end_location end
where jsonb_typeof(r.stops) = 'array'
  and exists (
    select 1
    from seed_fix f
    where r.stops::text like '%' || f.old_lat::text || '%'
       or r.start_location::text like '%' || f.old_lat::text || '%'
       or r.end_location::text like '%' || f.old_lat::text || '%'
  );

drop function pg_temp.fix_point(jsonb);
drop table seed_fix;
