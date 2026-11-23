import { api } from "../api";
import type { Snapshot } from "../../types/types";
import { driverColumns, setupApiHarness, userColumns } from "./apiHarness";
import { booking, destination, now, pickup, timestamp } from "./fixtures";

jest.mock("../supabase", () => ({ db: jest.fn() }));
jest.mock("../mapbox", () => ({ directions: jest.fn() }));

const harness = setupApiHarness();
const fallback = {
  name: "Calbayog City Hall",
  latitude: 12.0676,
  longitude: 124.5942,
};
const descending = { ascending: false };
const rider = {
  user_id: "rider",
  email: "rider@example.test",
  name: "Jo",
  assigned_roles: ["Passenger"],
};
const ana = {
  user_id: "driver-1",
  name: "Ana",
  assigned_roles: ["Tricycle driver"],
};
const driver = {
  user_id: "driver-1",
  current_lat: "12.07",
  current_lng: "124.59",
  plate_number: "TRI 1",
  capacity: "3",
  routes_id: "r1",
  association: "Co-op",
  operational_classification: "Tricycle",
  availability_status: "available",
  location_updated_at: timestamp,
};
const fleet = [
  { vehicle_id: "active", plate_number: "BUS 1", active: true, status: "In transit" },
  { vehicle_id: "inactive", plate_number: "BUS 2", active: false, status: "In Terminal" },
  { vehicle_id: "retired", plate_number: "TRI 1", active: true, status: "Decommissioned" },
  { vehicle_id: "broken", plate_number: "BUS 3", active: true, status: "Broken / Inactive" },
];

function notificationQuery(columns: string): [string, ...unknown[]][] {
  return [
    ["select", columns],
    ["eq", "user_id", "rider"],
    ["order", "created_at", descending],
    ["limit", 30],
  ];
}

function snapshotTables(
  data: Record<string, unknown> = {},
  errors: Record<string, string | { message: string; code?: string }> = {},
) {
  const { table } = harness.fake;
  table(
    "routes",
    [
      ["select", "*"],
      ["order", "route_name"],
    ],
    data.routes,
    errors.routes,
  );
  table(
    "terminals",
    [
      ["select", "*"],
      ["order", "station_name"],
    ],
    data.terminals,
    errors.terminals,
  );
  table(
    "vehicles",
    [
      ["select", "*"],
      ["order", "name"],
    ],
    data.vehicles,
    errors.vehicles,
  );
  table(
    "bookings",
    [
      ["select", "*, trip_records(payment_status)"],
      ["order", "created_at", descending],
      ["limit", 80],
    ],
    data.bookings,
    errors.bookings,
  );
  table(
    "driver_runs",
    [
      ["select", "*, driver_run_events(*)"],
      ["order", "started_at", descending],
      ["limit", 40],
    ],
    data.runs,
    errors.runs,
  );
  table(
    "stop_requests",
    [
      ["select", "*"],
      ["order", "created_at"],
    ],
    data.stops,
    errors.stops,
  );
  table(
    "reports",
    [
      ["select", "*"],
      ["order", "created_at", descending],
    ],
    data.reports,
    errors.reports,
  );
  table(
    "notifications",
    notificationQuery("notification_id,message,created_at,read,booking_id"),
    data.notifications,
    errors.notifications,
  );
  table(
    "landmarks",
    [
      ["select", "*"],
      ["order", "name"],
    ],
    data.landmarks,
    errors.landmarks,
  );
  table(
    "fare_matrices",
    [
      ["select", "*"],
      ["eq", "active", true],
    ],
    data.fares,
    errors.fares,
  );
  table(
    "audit_logs",
    [
      ["select", "*"],
      ["order", "created_at", descending],
      ["limit", 20],
    ],
    data.logs,
    errors.logs,
  );
}

function passengerProfile(
  users: unknown = null,
  drivers: unknown = null,
  errors: { users?: string; drivers?: string } = {},
) {
  harness.fake.rpc("my_profile", [], { user: rider });
  harness.fake.table("users", [["select", userColumns]], users, errors.users);
  harness.fake.table(
    "drivers",
    [["select", driverColumns]],
    drivers,
    errors.drivers,
  );
}

describe("the state snapshot", () => {
  it("loads passenger state from scoped tables and maps every collection", async () => {
    passengerProfile([{ ...rider, name: "Public name" }, ana], [driver]);
    snapshotTables({
      routes: [
        {
          routes_id: "r1",
          route_name: "Market loop",
          stops: [pickup],
          fare: "14",
        },
      ],
      terminals: [
        {
          terminal_id: "t1",
          station_name: "Market",
          routes_id: "r1",
          latitude: "12.07",
          longitude: "124.59",
          active: true,
        },
      ],
      vehicles: [{ vehicle_id: "v1", name: "Blue bus", plate_number: "BUS 1", active: true }],
      bookings: [
        { ...booking, trip_records: { payment_status: "pending" } },
        { ...booking, booking_id: "expired", request_status: "Expired", driver_id: null },
      ],
      runs: [
        {
          run_id: "run-1",
          driver_id: "driver-1",
          stops: [pickup],
          started_at: timestamp,
        },
      ],
      stops: [
        {
          request_id: "stop-1",
          routes_id: "r1",
          point: pickup,
          passenger: "Jo",
          user_id: "rider",
          created_at: booking.expires_at,
        },
      ],
      reports: [
        {
          report_id: "report-1",
          booking_id: "booking-1",
          reporter: "Jo",
          status: "resolved",
          details: "Late arrival",
          created_at: booking.expires_at,
        },
      ],
      notifications: [
        {
          notification_id: "n1",
          message: "Trip accepted",
          read: true,
          created_at: booking.expires_at,
          booking_id: "booking-1",
        },
      ],
      landmarks: [{ name: "Market", latitude: "12.07", longitude: "124.59" }],
      fares: [
        { routes_id: "r1", vehicle_classification: "Tricycle", base_fare: 5, per_kilometer_rate: 2 },
        { routes_id: null, vehicle_classification: "PUJ", base_fare: 10, per_kilometer_rate: 1 },
        { routes_id: null, vehicle_classification: "Tricycle", tariff_tier: "DISCOUNTED", base_fare: 20, per_kilometer_rate: 7 },
        { routes_id: null, vehicle_classification: "Tricycle", tariff_tier: "REGULAR", base_fare: "27", per_kilometer_rate: "9.5" },
      ],
      logs: [
        {
          log_id: "42",
          event_type: "booking.accepted",
          created_at: booking.expires_at,
        },
      ],
    });
    const snapshot = await api<Snapshot>("/state");
    expect(snapshot).toMatchObject({
      user: {
        id: "rider",
        name: "Jo",
        email: "rider@example.test",
        role: "Passenger",
      },
      users: [
        { id: "rider", name: "Jo" },
        { id: "driver-1", association: "Co-op" },
      ],
      routes: [{ id: "r1", name: "Market loop", stops: [pickup], fare: 14 }],
      terminals: [
        {
          id: "t1",
          name: "Market",
          routeId: "r1",
          point: pickup,
          active: true,
        },
      ],
      vehicles: [
        { id: "v1", plate: "BUS 1" },
        {
          id: "driver-driver-1",
          kind: "Tricycle driver",
          plate: "TRI 1",
          capacity: 3,
          routeId: "r1",
          status: "In transit",
          online: true,
          stale: false,
          location: {
            name: "Ana",
            latitude: 12.07,
            longitude: 124.59,
            updatedAt: now,
          },
        },
      ],
      trips: [
        {
          id: "booking-1",
          passenger: "Jo",
          driver: "Ana",
          driverAssociation: "Co-op",
          paymentStatus: "pending",
        },
        { id: "expired", status: "Expired" },
      ],
      runs: [{ id: "run-1", driver: "Ana", events: [] }],
      stopRequests: [
        {
          id: "stop-1",
          routeId: "r1",
          point: pickup,
          passenger: "Jo",
          userId: "rider",
          createdAt: Date.parse(booking.expires_at),
        },
      ],
      reports: [
        {
          id: "report-1",
          tripId: "booking-1",
          reporter: "Jo",
          status: "resolved",
          details: "Late arrival",
          createdAt: booking.expires_at,
        },
      ],
      notifications: [
        {
          id: "n1",
          message: "Trip accepted",
          read: true,
          createdAt: booking.expires_at,
          tripId: "booking-1",
        },
      ],
      landmarks: [pickup],
      logs: [{ id: 42, action: "booking.accepted", at: booking.expires_at }],
      baseFare: 27,
      perKm: 9.5,
      fareApproved: true,
      sampleMode: false,
      fareReference: "Fare matrix",
      serverTime: now,
    });
    expect(harness.fake.client.rpc.mock.calls).toEqual([["my_profile"]]);
  });

  it("skips duplicate plates, missing coordinates and drivers without a visible user", async () => {
    passengerProfile(
      [ana, { user_id: "present", name: "Ben" }],
      [
        driver,
        { ...driver, user_id: "hidden", plate_number: "HIDDEN" },
        {
          ...driver,
          user_id: "present",
          plate_number: "NO FIX",
          current_lat: null,
        },
        {
          ...driver,
          user_id: "present",
          plate_number: "NO TIME",
          location_updated_at: null,
        },
      ],
    );
    snapshotTables({
      vehicles: [{ vehicle_id: "existing", plate_number: "TRI 1", active: true }],
    });
    const { vehicles } = await api<Snapshot>("/state");
    expect(
      vehicles.map(({ id, plate, stale }) => ({ id, plate, stale })),
    ).toEqual([{ id: "existing", plate: "TRI 1", stale: true }]);
  });

  it("omits inactive, retired and broken vehicles from the passenger fleet", async () => {
    passengerProfile();
    snapshotTables({ vehicles: fleet });
    const { vehicles } = await api<Snapshot>("/state");
    expect(vehicles.map(({ id }) => id)).toEqual(["active"]);
  });

  it("shows travelling and terminal fleet vehicles when run rows are hidden", async () => {
    passengerProfile([ana], [{ ...driver, operational_classification: "PUJ" }]);
    snapshotTables({
      vehicles: [
        fleet[0],
        { ...fleet[1], active: true },
      ],
    });
    const { vehicles } = await api<Snapshot>("/state");
    expect(vehicles).toMatchObject([
      { id: "active", onRun: true, runId: null, nextStop: null },
      { id: "inactive", onRun: false, runId: null, nextStop: null },
    ]);
  });

  test.each(["Accepted", "Arrived", "In progress"])(
    "keeps an offline, stale tricycle assigned to the passenger's %s trip",
    async (status) => {
      const additionalDrivers = [
        { ...driver, user_id: "offline", availability_status: "offline" },
        { ...driver, user_id: "stale", location_updated_at: null },
      ];
      passengerProfile(
        [ana, ...additionalDrivers.map((row) => ({ user_id: row.user_id, name: row.user_id }))],
        [
          { ...driver, availability_status: "offline", location_updated_at: null },
          ...additionalDrivers.map((row) => ({ ...row, plate_number: row.user_id })),
        ],
      );
      snapshotTables({
        bookings: [
          { ...booking, booking_id: "other-trip", user_id: "someone-else", driver_id: "offline", request_status: status },
          { ...booking, request_status: status },
        ],
      });
      const { vehicles } = await api<Snapshot>("/state");
      expect(vehicles).toMatchObject([
        { id: "driver-driver-1", online: false, stale: true },
      ]);
    },
  );

  test.each([
    { code: "42703", message: "column notifications.booking_id does not exist" },
    { code: "PGRST204", message: "Could not find the 'booking_id' column of 'notifications'" },
    { message: "Could not find the 'booking_id' column of 'notifications' in the schema cache" },
  ])("links legacy notifications after a missing-column response ($code)", async (error) => {
    passengerProfile();
    snapshotTables({
      bookings: [
        { ...booking, booking_id: "unrelated", user_id: "someone-else", timestamps: { Accepted: now + 1000 } },
        { ...booking, timestamps: { Accepted: now + 1001 } },
      ],
    }, { notifications: error });
    harness.fake.table("notifications", notificationQuery("*"), [
      { notification_id: "legacy", message: "A driver accepted your ride request and is on the way.", created_at: new Date(now + 1000).toISOString() },
    ]);
    const { notifications } = await api<Snapshot>("/state");
    expect(notifications).toMatchObject([{ id: "legacy", tripId: "booking-1" }]);
  });

  it("fills defaults for empty collections and nullable snapshot rows", async () => {
    passengerProfile();
    snapshotTables({
      stops: [{ request_id: "stop-1", passenger: null }],
      reports: [{ report_id: "report-1" }],
      notifications: [{ notification_id: "n1" }],
      logs: [{ log_id: "invalid" }],
    });
    await expect(api<Snapshot>("/state")).resolves.toMatchObject({
      users: [{ id: "rider" }],
      routes: [],
      vehicles: [],
      terminals: [],
      trips: [],
      runs: [],
      landmarks: [fallback],
      baseFare: 0,
      perKm: 0,
      fareApproved: false,
      stopRequests: [{ id: "stop-1", passenger: "", createdAt: now }],
      reports: [
        {
          id: "report-1",
          tripId: null,
          status: "open",
          details: "",
          reporter: "",
          createdAt: timestamp,
        },
      ],
      notifications: [
        { id: "n1", message: "", read: false, createdAt: timestamp },
      ],
      logs: [{ id: 0, action: "", at: timestamp }],
    });
  });

  it("leaves fares unapproved when only another vehicle class has an active fare", async () => {
    passengerProfile();
    snapshotTables({
      fares: [{ routes_id: null, vehicle_classification: "PUJ", base_fare: 13, per_kilometer_rate: 8 }],
    });
    await expect(api<Snapshot>("/state")).resolves.toMatchObject({
      baseFare: 0,
      perKm: 0,
      fareApproved: false,
    });
  });

  test.each([
    [300_000, false],
    [300_001, true],
  ])("filters driver fixes %i ms old with stale=%p", async (age, stale) => {
    const updatedAt = now - age;
    passengerProfile([ana], [
      { ...driver, location_updated_at: new Date(updatedAt).toISOString() },
    ]);
    snapshotTables();
    const { vehicles } = await api<Snapshot>("/state");
    expect(vehicles).toMatchObject(
      stale ? [] : [{ id: "driver-driver-1", online: true, stale, location: { updatedAt } }],
    );
  });

  test.each(["Administrator", "Vehicle Owner / Operator"])(
    "uses both privileged directory RPCs for %s",
    async (role) => {
      harness.fake.rpc("my_profile", [], {
        user: {
          ...rider,
          assigned_roles: [role],
          admin_level: "Technical Team",
        },
        driver: {
          user_id: "rider",
          availability_status: "available",
          license_number: "LICENSE",
        },
      });
      harness.fake.rpc("admin_users", [], [ana]);
      harness.fake.rpc("admin_drivers", [], [driver]);
      snapshotTables({
        vehicles: [
          { ...fleet[0], driver_id: "driver-1" },
          { ...fleet[1], driver_id: "driver-1" },
          ...fleet.slice(2),
        ],
        runs: [{
          run_id: "run-1",
          driver_id: "driver-1",
          status: "In progress",
          stops: [pickup, destination],
          stop_index: 0,
        }],
      });
      const snapshot = await api<Snapshot>("/state");
      expect(snapshot).toMatchObject({
        user: {
          id: "rider",
          role,
          adminLevel: "Technical Team",
          available: true,
          license: "LICENSE",
        },
        users: [
          { id: "driver-1", association: "Co-op" },
          { id: "rider", role },
        ],
      });
      expect(snapshot.vehicles.map(({ id }) => id)).toEqual(fleet.map((row) => row.vehicle_id));
      expect(snapshot.vehicles.slice(0, 2)).toMatchObject([
        { onRun: true, runId: "run-1", nextStop: destination.name },
        { onRun: false, runId: null, nextStop: null },
      ]);
      expect(harness.fake.client.rpc.mock.calls).toEqual([
        ["my_profile"],
        ["admin_users"],
        ["admin_drivers"],
      ]);
    },
  );

  it("uses regular queries and no synthetic passenger vehicles for a driver", async () => {
    harness.fake.rpc("my_profile", [], {
      user: { ...rider, assigned_roles: ["Tricycle driver", "Administrator"] },
    });
    harness.fake.table("users", [["select", userColumns]], [ana]);
    harness.fake.table("drivers", [["select", driverColumns]], [driver]);
    snapshotTables();
    await expect(api<Snapshot>("/state")).resolves.toMatchObject({
      user: { role: "Tricycle driver" },
      vehicles: [],
    });
  });

  it("returns a 404 when my_profile has no user", async () => {
    harness.fake.rpc("my_profile", [], { driver });
    await expect(api("/state")).rejects.toMatchObject({
      status: 404,
      message: "No profile found for this account.",
    });
  });

  it("surfaces the profile RPC error", async () => {
    harness.fake.rpc("my_profile", [], null, "profile query failed");
    await expect(api("/state")).rejects.toMatchObject({
      status: 400,
      message: "profile query failed",
    });
  });

  test.each(["users", "drivers"] as const)(
    "surfaces errors from the %s directory",
    async (directory) => {
      passengerProfile(null, null, { [directory]: "directory query failed" });
      snapshotTables();
      await expect(api("/state")).rejects.toMatchObject({
        status: 400,
        message: "directory query failed",
      });
    },
  );

  test.each(["routes", "terminals", "vehicles", "bookings"])(
    "surfaces a failed %s read",
    async (table) => {
      passengerProfile();
      snapshotTables({}, { [table]: "query failed" });
      await expect(api<Snapshot>("/state")).rejects.toMatchObject({
        status: 400,
        message: "query failed",
      });
    },
  );

  it("keeps the snapshot usable when optional reads fail", async () => {
    passengerProfile();
    snapshotTables(
      {},
      {
        runs: "query failed",
        stops: "query failed",
        reports: "query failed",
        notifications: "query failed",
        landmarks: "query failed",
        fares: "query failed",
        logs: "query failed",
      },
    );
    await expect(api<Snapshot>("/state")).resolves.toMatchObject({
      runs: [],
      stopRequests: [],
      reports: [],
      notifications: [],
      landmarks: [fallback],
      baseFare: 0,
      perKm: 0,
      fareApproved: false,
      logs: [],
    });
  });
});

describe("pending applications debug endpoint", () => {
  it("returns only pending applicants from the admin RPC", async () => {
    const pending = { user_id: "a", application_status: "pending" };
    harness.fake.rpc(
      "admin_users",
      [],
      [
        pending,
        { user_id: "b", application_status: "accepted" },
        { user_id: "c", application_status: "declined" },
      ],
    );
    await expect(api("/debug/pending-applications")).resolves.toEqual({
      count: 1,
      items: [pending],
    });
  });

  it("returns an empty result when the RPC has no rows", async () => {
    harness.fake.rpc("admin_users", []);
    await expect(api("/debug/pending-applications")).resolves.toEqual({
      count: 0,
      items: [],
    });
  });
});
