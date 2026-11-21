import { api } from "../api";
import { ok, setupApiHarness } from "./apiHarness";
import { destination, now, pickup, timestamp } from "./fixtures";

jest.mock("../supabase", () => ({ db: jest.fn() }));
jest.mock("../mapbox", () => ({ directions: jest.fn() }));

const harness = setupApiHarness();

describe("profile, availability, and notifications", () => {
  test.each([
    [
      { name: "Jo", phone: "0917" },
      { name: "Jo", phone: "0917", contact_numbers: "0917" },
    ],
    [
      { name: null, phone: 1234 },
      { name: "", phone: "1234", contact_numbers: "1234" },
    ],
  ])("updates profile fields for %p", async (body, patch) => {
    harness.fake.table("users", [
      ["update", patch],
      ["eq", "user_id", "rider"],
    ]);
    await expect(api("/profile", body)).resolves.toEqual(ok);
  });

  test.each([
    ["data:image/png;base64,AA==", "data:image/png;base64,AA=="],
    ["https://example.test/avatar.png", null],
    ["file:///avatar.jpg", null],
    ["data:text/plain;base64,AA==", null],
    [123, null],
    [undefined, null],
  ])("stores photo %p as %p", async (photo, expectedPhoto) => {
    harness.fake.table("users", [
      ["update", { photo: expectedPhoto }],
      ["eq", "user_id", "rider"],
    ]);
    await expect(api("/profile/photo", { photo })).resolves.toEqual(ok);
  });

  test.each([
    [true, "available"],
    [false, "offline"],
    [undefined, "offline"],
  ])("maps availability %p to %p", async (available, availability_status) => {
    harness.fake.table("drivers", [
      ["update", { availability_status }],
      ["eq", "user_id", "rider"],
    ]);
    await expect(api("/availability", { available })).resolves.toEqual(ok);
  });

  it("marks only the current user's notifications read", async () => {
    harness.fake.table("notifications", [
      ["update", { read: true }],
      ["eq", "user_id", "rider"],
    ]);
    await expect(api("/notifications/read")).resolves.toEqual(ok);
  });

  it("surfaces an update error", async () => {
    harness.fake.table(
      "users",
      [
        ["update", { name: "Jo", phone: "", contact_numbers: "" }],
        ["eq", "user_id", "rider"],
      ],
      null,
      "profile write denied",
    );
    await expect(api("/profile", { name: "Jo" })).rejects.toMatchObject({
      status: 400,
      message: "profile write denied",
    });
  });
});

describe("reports and stop requests", () => {
  test.each([
    [
      { name: "Jo" },
      { details: "Missed pickup", tripId: "booking-1" },
      "Jo",
      "Missed pickup",
      "booking-1",
    ],
    [null, { details: 42, tripId: "" }, "Passenger", "42", null],
  ])(
    "files a report with the reporter lookup %p",
    async (profile, body, reporter, details, booking_id) => {
      harness.fake.table(
        "users",
        [["select", "name"], ["eq", "user_id", "rider"], ["maybeSingle"]],
        profile,
      );
      harness.fake.table("reports", [
        [
          "insert",
          {
            details,
            booking_id,
            status: "open",
            reporter,
            reporter_id: "rider",
          },
        ],
      ]);
      await expect(api("/report", body)).resolves.toEqual(ok);
    },
  );

  it("updates a report by report ID", async () => {
    harness.fake.table("reports", [
      ["update", { status: "resolved" }],
      ["eq", "report_id", "report-1"],
    ]);
    await expect(
      api("/reports/report-1/status", { status: "resolved" }),
    ).resolves.toEqual(ok);
  });

  test.each([
    ["Jo", "Jo"],
    [undefined, "Passenger"],
  ])("creates a stop request with passenger %p", async (name, passenger) => {
    harness.fake.table("stop_requests", [
      [
        "insert",
        { routes_id: "r1", point: pickup, passenger, user_id: "rider" },
      ],
    ]);
    await expect(
      api("/stop", { routeId: "r1", point: pickup, passenger: name }),
    ).resolves.toEqual(ok);
  });

  it("deletes a stop request by request ID", async () => {
    harness.fake.table("stop_requests", [
      ["delete"],
      ["eq", "request_id", "stop-1"],
    ]);
    await expect(api("/stops/stop-1", undefined, "DELETE")).resolves.toEqual(
      ok,
    );
  });

  it("does not delete the stop for a non-DELETE call", async () => {
    await expect(api("/stops/stop-1", undefined, "PATCH")).resolves.toEqual(ok);
    expect(harness.fake.client.from).not.toHaveBeenCalled();
  });
});

describe("vehicles", () => {
  it("upserts a POST with all the supplied vehicle fields", async () => {
    const row = {
      vehicle_id: "v1",
      name: "Blue bus",
      vehicle_type: "Bus",
      plate_number: "ABC",
      routes_id: "r1",
      capacity: 24,
      current_lat: 12.07,
      current_lng: 124.59,
      location_updated_at: timestamp,
      status: "In transit",
      owner_id: "rider",
      current_driver: "Ana",
    };
    harness.fake.table(
      "vehicles",
      [["upsert", row, { onConflict: "vehicle_id" }], ["select"], ["single"]],
      row,
    );
    await expect(
      api(
        "/vehicles",
        {
          id: "v1",
          name: "Blue bus",
          vehicleType: "Bus",
          plate: "ABC",
          routeId: "r1",
          capacity: "24",
          location: pickup,
          status: "In transit",
          currentDriver: "Ana",
        },
        "POST",
      ),
    ).resolves.toMatchObject({
      id: "v1",
      vehicleType: "Bus",
      ownerId: "rider",
      currentDriver: "Ana",
      stale: false,
    });
  });

  test.each([
    ["ABC", "ABC"],
    [undefined, "Franchise vehicle"],
  ])(
    "upserts with generated ID and defaults for plate %p",
    async (plate, name) => {
      const vehicle_id = `vehicle-${now.toString(36)}`;
      const row = {
        vehicle_id,
        name,
        vehicle_type: "Jeepney",
        plate_number: plate ?? "",
        routes_id: null,
        capacity: 18,
        current_lat: 12.0676,
        current_lng: 124.5942,
        location_updated_at: timestamp,
        status: "In Terminal",
        owner_id: "rider",
        current_driver: "",
      };
      harness.fake.table(
        "vehicles",
        [["upsert", row, { onConflict: "vehicle_id" }], ["select"], ["single"]],
        row,
      );
      await expect(api("/vehicles", { plate })).resolves.toMatchObject({
        id: vehicle_id,
        name,
        capacity: 18,
        status: "In Terminal",
      });
    },
  );

  test.each([
    ["/vehicles/status", { id: "v1", status: "Arrived" }, "v1", "Arrived"],
    ["/vehicles/v2/status", { status: "In transit" }, "v2", "In transit"],
    [
      "/vehicles/v2/status",
      { id: "v3", status: "In Terminal" },
      "v3",
      "In Terminal",
    ],
  ])(
    "updates vehicle status using %s and %p",
    async (endpoint, body, id, status) => {
      harness.fake.table("vehicles", [
        ["update", { status }],
        ["eq", "vehicle_id", id],
      ]);
      await expect(api(endpoint, body, "PATCH")).resolves.toEqual(ok);
    },
  );

  test.each([
    [
      {
        name: "Bus",
        plate: 901,
        routeId: "",
        capacity: "bad",
        status: "Arrived",
        currentDriver: null,
        vehicleType: "Bus",
      },
      {
        name: "Bus",
        plate_number: "901",
        routes_id: null,
        capacity: 18,
        status: "Arrived",
        current_driver: "",
        vehicle_type: "Bus",
      },
    ],
    [{ capacity: 0 }, { capacity: 0 }],
    [{ extra: "ignored" }, {}],
  ])("patches only recognized vehicle fields in %p", async (body, patch) => {
    harness.fake.table("vehicles", [
      ["update", patch],
      ["eq", "vehicle_id", "v1"],
    ]);
    await expect(api("/vehicles/v1", body, "PATCH")).resolves.toEqual(ok);
  });
});

describe("driver management", () => {
  test.each([
    [
      { verified: true },
      { verified: true, application_status: "accepted" },
      { verified: true },
    ],
    [
      { verified: false },
      { verified: false, application_status: "pending" },
      { verified: false },
    ],
    [
      { applicationStatus: "accepted" },
      { verified: true, application_status: "accepted" },
      null,
    ],
    [
      { applicationStatus: "declined" },
      { verified: false, application_status: "declined" },
      null,
    ],
    [{ applicationStatus: "pending" }, { application_status: "pending" }, null],
    [
      { verified: false, applicationStatus: "accepted" },
      { verified: true, application_status: "accepted" },
      { verified: false },
    ],
    [
      { verified: true, applicationStatus: "declined" },
      { verified: false, application_status: "declined" },
      { verified: true },
    ],
    [
      { verified: true, applicationStatus: "pending" },
      { verified: true, application_status: "pending" },
      { verified: true },
    ],
    [
      { routeId: "", association: 123 },
      null,
      { routes_id: null, association: "123" },
    ],
    [{ routeId: "r1" }, null, { routes_id: "r1" }],
    [{}, null, null],
  ])(
    "updates the user and driver according to %p",
    async (body, userPatch, driverPatch) => {
      if (userPatch) {
        harness.fake.table("users", [
          ["update", userPatch],
          ["eq", "user_id", "driver-1"],
        ]);
      }
      if (driverPatch) {
        harness.fake.table("drivers", [
          ["update", driverPatch],
          ["eq", "user_id", "driver-1"],
        ]);
      }
      await expect(api("/drivers/driver-1", body, "PATCH")).resolves.toEqual(
        ok,
      );
      expect(harness.fake.client.from.mock.calls).toEqual([
        ...(userPatch ? [["users"]] : []),
        ...(driverPatch ? [["drivers"]] : []),
      ]);
    },
  );

  it("stops when the user update fails", async () => {
    harness.fake.table(
      "users",
      [
        ["update", { verified: true, application_status: "accepted" }],
        ["eq", "user_id", "driver-1"],
      ],
      null,
      "permission denied",
    );
    await expect(
      api("/drivers/driver-1", { verified: true }),
    ).rejects.toMatchObject({ status: 400, message: "permission denied" });
  });
});

describe("administrator configuration", () => {
  it("upserts a route with explicit field values", async () => {
    const row = {
      routes_id: "r1",
      route_name: "Market loop",
      transport_type: "Tricycle",
      destination: "Pier",
      stops: [pickup, destination],
      fare: 14.5,
      scheduled: true,
      approved: true,
      active: false,
      reference: "Ordinance",
      interval_minutes: 25,
      starts_at: "07:30",
      ends_at: "18:15",
    };
    harness.fake.table(
      "routes",
      [["upsert", row, { onConflict: "routes_id" }], ["select"], ["single"]],
      row,
    );
    await expect(
      api("/configure", {
        type: "route",
        id: "r1",
        name: "Market loop",
        transportType: "Tricycle",
        destination: "Pier",
        stops: [pickup, destination],
        fare: "14.5",
        scheduled: true,
        approved: true,
        active: false,
        reference: "Ordinance",
        interval: "25",
        startsAt: "07:30",
        endsAt: "18:15",
      }),
    ).resolves.toMatchObject({
      ok: true,
      route: {
        id: "r1",
        fare: 14.5,
        active: false,
        stops: [pickup, destination],
      },
    });
  });

  it("generates a route ID and fills in the configuration defaults", async () => {
    const routes_id = `route-${now.toString(36)}`;
    const row = {
      routes_id,
      route_name: "",
      transport_type: "PUJ / PUV",
      destination: "",
      stops: [],
      fare: 0,
      scheduled: false,
      approved: false,
      active: true,
      reference: "Admin configured",
      interval_minutes: 15,
      starts_at: "06:00",
      ends_at: "20:00",
    };
    harness.fake.table(
      "routes",
      [["upsert", row, { onConflict: "routes_id" }], ["select"], ["single"]],
      row,
    );
    await expect(api("/configure", { type: "route" })).resolves.toMatchObject({
      route: {
        id: routes_id,
        interval: 15,
        startsAt: "06:00",
        endsAt: "20:00",
        active: true,
      },
    });
  });

  it("upserts a terminal using its specified coordinates and active flag", async () => {
    const row = {
      terminal_id: "t1",
      station_name: "Market terminal",
      routes_id: "r1",
      latitude: 12.07,
      longitude: 124.59,
      active: false,
    };
    harness.fake.table(
      "terminals",
      [["upsert", row, { onConflict: "terminal_id" }], ["select"], ["single"]],
      row,
    );
    await expect(
      api("/configure", {
        type: "terminal",
        id: "t1",
        name: "Market terminal",
        routeId: "r1",
        point: pickup,
        active: false,
      }),
    ).resolves.toEqual({
      ok: true,
      terminal: {
        id: "t1",
        name: "Market terminal",
        point: pickup,
        routeId: "r1",
        active: false,
      },
    });
  });

  it("generates a terminal ID and uses the fallback point", async () => {
    const terminal_id = `terminal-${now.toString(36)}`;
    const row = {
      terminal_id,
      station_name: "",
      routes_id: null,
      latitude: 12.0676,
      longitude: 124.5942,
      active: true,
    };
    harness.fake.table(
      "terminals",
      [["upsert", row, { onConflict: "terminal_id" }], ["select"], ["single"]],
      row,
    );
    await expect(api("/configure", { type: "terminal" })).resolves.toEqual({
      ok: true,
      terminal: {
        id: terminal_id,
        name: "",
        point: {
          name: "Calbayog City Hall",
          latitude: 12.0676,
          longitude: 124.5942,
        },
        routeId: null,
        active: true,
      },
    });
  });

  it("updates the route-independent tricycle fare only", async () => {
    harness.fake.table("fare_matrices", [
      ["update", { base_fare: 28.5, per_kilometer_rate: 9 }],
      ["eq", "vehicle_classification", "Tricycle"],
      ["is", "routes_id", null],
    ]);
    await expect(
      api("/configure", { type: "fare", baseFare: "28.5", perKm: "9" }),
    ).resolves.toEqual(ok);
  });

  test.each([
    [0, 8],
    [-1, 8],
    [25, 0],
    [25, -1],
    ["invalid", 8],
    [25, null],
  ])("rejects fare values %p and %p", async (baseFare, perKm) => {
    await expect(
      api("/configure", { type: "fare", baseFare, perKm }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Base fare and per-kilometre rate must be greater than zero.",
    });
  });

  test.each([
    ["terminals", "terminal_id", true],
    ["routes", "routes_id", false],
  ])("sets active on %s via %s", async (collection, key, active) => {
    harness.fake.table(collection, [
      ["update", { active }],
      ["eq", key, "record-1"],
    ]);
    await expect(
      api("/configure", { type: "toggle", collection, id: "record-1", active }),
    ).resolves.toEqual(ok);
  });

  it("leaves fares untouched for the legacy configuration shape", async () => {
    await expect(
      api("/configure", { baseFare: 30, perKm: 10 }),
    ).resolves.toEqual(ok);
    expect(harness.fake.client.from).not.toHaveBeenCalled();
  });
});
