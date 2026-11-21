revoke execute on function
  public.handle_new_user(),
  public.guard_user_update(),
  public.guard_driver_update(),
  public.guard_booking_update(),
  public.prepare_booking(),
  public.notify_booking_change(),
  public.audit_booking_change(),
  public.audit_user_change(),
  public.haversine_km(double precision, double precision, double precision, double precision)
from authenticated;

alter default privileges in schema public revoke execute on functions from authenticated;
