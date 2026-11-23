import { clearSession } from "../api";
import { db } from "../supabase";
import { now } from "./fixtures";
import { createSupabaseFake } from "./supabaseFake";

export const userColumns =
  "user_id,name,phone,contact_numbers,photo,assigned_roles,admin_level,franchise_name,verified,application_status,created_at";
export const driverColumns =
  "driver_id,user_id,operational_classification,availability_status,association,plate_number,capacity,franchise_name,routes_id,verified,current_lat,current_lng,location_updated_at";
export const ok = { ok: true };

export function setupApiHarness() {
  const harness = { fake: createSupabaseFake() };

  beforeEach(async () => {
    jest.useFakeTimers({ now });
    harness.fake = createSupabaseFake();
    const { client } = harness.fake;
    jest.mocked(db).mockReturnValue(client as unknown as ReturnType<typeof db>);
    await clearSession();
    client.auth.signOut.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    harness.fake.verify();
  });

  return harness;
}
