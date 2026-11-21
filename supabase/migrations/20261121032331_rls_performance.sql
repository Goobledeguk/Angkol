alter policy read_bookings on public.bookings using (
  user_id = (select auth.uid()) or driver_id = (select auth.uid()) or public.is_admin()
  or (driver_id is null and request_status = 'Requested'
      and public.my_role() in ('Tricycle driver','PUJ / PUV driver')
      and not ((select auth.uid()) = any(declined_by)))
);

alter policy read_trip_records on public.trip_records using (
  user_id = (select auth.uid()) or driver_id = (select auth.uid()) or public.is_admin()
);

alter policy read_runs on public.driver_runs using (
  driver_id = (select auth.uid()) or public.is_admin()
);

alter policy read_run_events on public.driver_run_events using (
  exists (select 1 from public.driver_runs r where r.run_id = driver_run_events.run_id
          and (r.driver_id = (select auth.uid()) or public.is_admin()))
);

alter policy read_reports on public.reports using (
  reporter_id = (select auth.uid()) or public.is_admin()
);

alter policy update_self on public.users
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy write_own_driver on public.drivers
  using (user_id = (select auth.uid()) or public.is_admin());

alter policy insert_own_driver on public.drivers
  with check (user_id = (select auth.uid()));

alter policy write_vehicles on public.vehicles
  using (owner_id = (select auth.uid()) or driver_id = (select auth.uid()) or public.is_admin())
  with check (owner_id = (select auth.uid()) or driver_id = (select auth.uid()) or public.is_admin());

alter policy write_audit_logs on public.audit_logs
  with check (user_id = (select auth.uid()));

alter policy insert_bookings on public.bookings
  with check (user_id = (select auth.uid()));

alter policy insert_locations on public.vehicle_locations
  with check (driver_id = (select auth.uid()));

alter policy insert_stop_requests on public.stop_requests
  with check (user_id = (select auth.uid()));

alter policy write_runs on public.driver_runs
  using (driver_id = (select auth.uid()) or public.is_admin())
  with check (driver_id = (select auth.uid()) or public.is_admin());

alter policy write_run_events on public.driver_run_events
  using (exists (select 1 from public.driver_runs r where r.run_id = driver_run_events.run_id
                 and (r.driver_id = (select auth.uid()) or public.is_admin())))
  with check (exists (select 1 from public.driver_runs r where r.run_id = driver_run_events.run_id
                 and (r.driver_id = (select auth.uid()) or public.is_admin())));

alter policy read_own_notifications on public.notifications
  using (user_id = (select auth.uid()));

alter policy update_notifications on public.notifications
  using (user_id = (select auth.uid()));

create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists bookings_routes_id_idx on public.bookings(routes_id);
create index if not exists data_analysis_routes_id_idx on public.data_analysis(routes_id);
create index if not exists driver_run_events_run_id_idx on public.driver_run_events(run_id);
create index if not exists driver_runs_routes_id_idx on public.driver_runs(routes_id);
create index if not exists drivers_routes_id_idx on public.drivers(routes_id);
create index if not exists fare_matrices_routes_id_idx on public.fare_matrices(routes_id);
create index if not exists reports_booking_id_idx on public.reports(booking_id);
create index if not exists reports_reporter_id_idx on public.reports(reporter_id);
create index if not exists stop_requests_routes_id_idx on public.stop_requests(routes_id);
create index if not exists stop_requests_user_id_idx on public.stop_requests(user_id);
create index if not exists terminal_schedules_routes_id_idx on public.terminal_schedules(routes_id);
create index if not exists terminal_schedules_terminal_id_idx on public.terminal_schedules(terminal_id);
create index if not exists terminals_routes_id_idx on public.terminals(routes_id);
create index if not exists trip_records_driver_id_idx on public.trip_records(driver_id);
create index if not exists trip_records_user_id_idx on public.trip_records(user_id);
create index if not exists vehicle_locations_driver_id_idx on public.vehicle_locations(driver_id);
create index if not exists vehicles_driver_id_idx on public.vehicles(driver_id);
create index if not exists vehicles_owner_id_idx on public.vehicles(owner_id);
create index if not exists vehicles_routes_id_idx on public.vehicles(routes_id);
