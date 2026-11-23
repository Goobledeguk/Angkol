alter table public.bookings drop constraint if exists bookings_request_status_check;
alter table public.bookings add constraint bookings_request_status_check
  check (request_status in ('Requested', 'Accepted', 'Arrived', 'In progress', 'Completed', 'Cancelled', 'Expired'));
