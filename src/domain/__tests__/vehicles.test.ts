import { driverVehicleId, isStale, lastSeen, STALE_AFTER_MS, tripRef, vehicleForDriver } from "../vehicles";
import { vehicles as fleet } from "../../testing/fixtures";
import type { Vehicle } from "../../types/types";

const now = Date.parse("2026-11-21T09:30:00+08:00");

const tricycle: Vehicle = {
  ...fleet[0],
  id: driverVehicleId("user-tricycle"),
  kind: "Tricycle driver",
  vehicleType: "Tricycle",
  plate: "TC 4821",
  routeId: null,
};

describe("vehicleForDriver", () => {
  const all = [...fleet, tricycle];

  it("finds a tricycle driver's position by their driver id", () => {
    expect(vehicleForDriver(all, "user-tricycle")?.id).toBe("driver-user-tricycle");
  });

  it("finds a fleet vehicle stored under the same id", () => {
    expect(vehicleForDriver(all, "veh-2")?.plate).toBe("PUJ 7711");
  });

  it("falls back to the plate on the booking", () => {
    expect(vehicleForDriver(all, "unknown-driver", "PUJ 7710")?.id).toBe("veh-1");
  });

  it("returns nothing for unassigned trips", () => {
    expect(vehicleForDriver(all, null)).toBeUndefined();
    expect(vehicleForDriver(all, undefined, "PUJ 7710")).toBeUndefined();
  });

  it("returns nothing when no position is known", () => {
    expect(vehicleForDriver(all, "user-x", "XYZ 000")).toBeUndefined();
  });
});

describe("isStale", () => {
  it("treats missing timestamps as stale", () => {
    expect(isStale(0, now)).toBe(true);
  });

  it("is fresh inside the window and stale after it", () => {
    expect(isStale(now - 60_000, now)).toBe(false);
    expect(isStale(now - STALE_AFTER_MS, now)).toBe(false);
    expect(isStale(now - STALE_AFTER_MS - 1, now)).toBe(true);
  });
});

describe("lastSeen", () => {
  it.each([
    [0, "No location yet"],
    [now - 10_000, "Just now"],
    [now - 3 * 60_000, "3 min ago"],
    [now - 59 * 60_000, "59 min ago"],
    [now - 3 * 3_600_000, "3 h ago"],
    [now - 30 * 3_600_000, "Over a day ago"],
  ])("%s → %s", (at, label) => {
    expect(lastSeen(at, now)).toBe(label);
  });

  it("never reports negative ages from clock drift", () => {
    expect(lastSeen(now + 120_000, now)).toBe("Just now");
  });
});

describe("tripRef", () => {
  it("shortens a uuid to a readable reference", () => {
    expect(tripRef("3f2a9c1b-77aa-4c1e-9a0d-2b8f9e1c0d11")).toBe("#3F2A9C1B");
  });

  it("handles short ids", () => {
    expect(tripRef("ab")).toBe("#AB");
  });
});
