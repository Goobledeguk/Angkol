import {
  FALLBACK,
  mapRoute,
  mapRun,
  mapTrip,
  mapUser,
  mapVehicle,
  num,
  shortTime,
  str,
} from "../mappers";
import {
  booking,
  destination,
  geometry,
  now,
  pickup,
  timestamp,
} from "./fixtures";

beforeEach(() => {
  jest.useFakeTimers({ now });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("Supabase field conversions", () => {
  test.each([
    ["12.5", 7, 12.5],
    [null, 7, 0],
    [undefined, 7, 7],
    ["", 7, 0],
    [false, 7, 0],
    [Infinity, 7, 7],
    ["invalid", 7, 7],
    [-2, 7, -2],
  ])("num(%p) with fallback %p gives %p", (value, fallback, expected) => {
    expect(num(value, fallback)).toBe(expected);
  });

  test.each([
    [undefined, ""],
    [null, ""],
    [0, "0"],
    [false, "false"],
    [" x ", " x "],
  ])("str(%p) gives %p", (value, expected) => {
    expect(str(value)).toBe(expected);
  });

  test.each([
    ["09:07:12+00", "09:07"],
    ["18:15", "18:15"],
    ["9:07", "06:00"],
    [null, "06:00"],
    [undefined, "06:00"],
  ])("shortTime(%p) gives %p", (value, expected) => {
    expect(shortTime(value, "06:00")).toBe(expected);
  });
});

describe("mapUser", () => {
  it("maps the complete user and driver fields", () => {
    const row = {
      user_id: "driver-1",
      email: "driver@example.test",
      name: "Ana",
      phone: "0917",
      contact_numbers: "0900",
      assigned_roles: ["Tricycle driver", "Passenger"],
      photo: "photo",
      admin_level: "Franchise Owner",
      verified: 1,
      application_status: "pending",
      franchise_name: "User franchise",
    };
    const driver = {
      availability_status: "available",
      license_doc_attached: true,
      license_number: 109,
      association: "Co-op",
      plate_number: "ABC",
      permit_number: "P1",
      franchise_name: "Driver franchise",
      capacity: "3",
      routes_id: "route-1",
      current_lat: "12.07",
      current_lng: "124.59",
      location_updated_at: timestamp,
    };
    expect(mapUser(row, driver)).toStrictEqual({
      id: "driver-1",
      name: "Ana",
      email: "driver@example.test",
      phone: "0917",
      role: "Tricycle driver",
      photo: "photo",
      adminLevel: "Franchise Owner",
      ownerVehicleIds: undefined,
      available: true,
      verified: true,
      pendingFranchiseApproval: true,
      applicationStatus: "pending",
      licenseDocAttached: true,
      license: "109",
      association: "Co-op",
      plate: "ABC",
      permitNo: "P1",
      franchiseName: "Driver franchise",
      capacity: 3,
      routeId: "route-1",
      location: {
        name: "Current location",
        latitude: 12.07,
        longitude: 124.59,
        updatedAt: now,
      },
    });
  });

  test.each([undefined, null])(
    "defaults an absent driver record (%p)",
    (driver) => {
      expect(
        mapUser(
          {
            user_id: "rider",
            name: null,
            email: "rider@example.test",
            phone: "",
            contact_numbers: "0900",
            assigned_roles: [],
            photo: "",
            admin_level: null,
            application_status: null,
            franchise_name: "Passenger franchise",
          },
          driver,
        ),
      ).toStrictEqual({
        id: "rider",
        email: "rider@example.test",
        name: "rider@example.test",
        phone: "0900",
        photo: undefined,
        adminLevel: undefined,
        ownerVehicleIds: undefined,
        role: "Passenger",
        available: false,
        verified: false,
        pendingFranchiseApproval: false,
        applicationStatus: "accepted",
        licenseDocAttached: false,
        license: "",
        association: "",
        plate: "",
        permitNo: undefined,
        franchiseName: "Passenger franchise",
        capacity: 0,
        routeId: null,
        location: null,
      });
    },
  );

  test.each([
    [null, 124],
    [12, undefined],
  ])("requires both coordinates (%p, %p)", (current_lat, current_lng) => {
    expect(mapUser({}, { current_lat, current_lng }).location).toBeNull();
  });

  it("accepts real zero coordinates and leaves a missing timestamp unset", () => {
    expect(mapUser({}, { current_lat: 0, current_lng: 0 }).location).toEqual({
      name: "Current location",
      latitude: 0,
      longitude: 0,
      updatedAt: 0,
    });
  });
});

describe("mapRoute", () => {
  it("maps the complete configured route", () => {
    expect(
      mapRoute({
        routes_id: "r1",
        route_name: "Market loop",
        stops: [pickup, destination],
        fare: "14.5",
        interval_minutes: "25",
        starts_at: "07:30:00",
        ends_at: "18:15:00",
        active: 1,
        approved: true,
        reference: "Ordinance",
        destination: "Pier",
        transport_type: "Tricycle",
        scheduled: true,
      }),
    ).toStrictEqual({
      id: "r1",
      name: "Market loop",
      stops: [pickup, destination],
      fare: 14.5,
      interval: 25,
      startsAt: "07:30",
      endsAt: "18:15",
      active: true,
      approved: true,
      reference: "Ordinance",
      destination: "Pier",
      transportType: "Tricycle",
      scheduled: true,
    });
  });

  test.each([null, undefined, "Market"])(
    "defaults route fields with non-array stops %p",
    (stops) => {
      expect(
        mapRoute({
          routes_id: "r1",
          route_name: null,
          stops,
          starts_at: "early",
          ends_at: null,
          reference: "",
        }),
      ).toStrictEqual({
        id: "r1",
        name: "",
        stops: [],
        fare: 0,
        interval: 15,
        startsAt: "06:00",
        endsAt: "20:00",
        active: false,
        approved: false,
        reference: "Fare matrix",
        destination: "",
        transportType: "PUJ / PUV",
        scheduled: false,
      });
    },
  );
});

describe("mapVehicle", () => {
  it("maps the full vehicle record", () => {
    expect(
      mapVehicle({
        vehicle_id: "v1",
        name: "Blue bus",
        vehicle_type: "Bus",
        plate_number: "ABC",
        routes_id: "r1",
        capacity: "24",
        current_lat: "12.07",
        current_lng: "124.59",
        location_updated_at: timestamp,
        status: "In transit",
        owner_id: "owner",
        current_driver: "Ana",
      }),
    ).toStrictEqual({
      id: "v1",
      name: "Blue bus",
      kind: "PUJ / PUV driver",
      vehicleType: "Bus",
      plate: "ABC",
      routeId: "r1",
      capacity: 24,
      location: {
        name: "Blue bus",
        latitude: 12.07,
        longitude: 124.59,
        updatedAt: now,
      },
      stale: false,
      status: "In transit",
      ownerId: "owner",
      currentDriver: "Ana",
    });
  });

  it("defaults missing fields to the city hall location and terminal status", () => {
    expect(
      mapVehicle({
        vehicle_id: "v1",
        name: null,
        plate_number: null,
        current_lng: "bad",
      }),
    ).toStrictEqual({
      id: "v1",
      name: "",
      kind: "PUJ / PUV driver",
      vehicleType: "Jeepney",
      plate: "",
      routeId: null,
      capacity: 18,
      location: {
        name: "Calbayog City Hall",
        latitude: 12.0676,
        longitude: 124.5942,
        updatedAt: 0,
      },
      stale: true,
      status: "In Terminal",
      ownerId: undefined,
      currentDriver: undefined,
    });
  });

  it("uses the plate for the display and location names", () => {
    const vehicle = mapVehicle({ plate_number: "ABC" });
    expect([vehicle.name, vehicle.location.name]).toEqual(["ABC", "ABC"]);
  });

  test.each([
    [null, null],
    [undefined, 124.59],
    [12.07, null],
  ])(
    "uses a stale fallback for coordinates (%p, %p) even with a recent timestamp",
    (current_lat, current_lng) => {
      expect(
        mapVehicle({
          current_lat,
          current_lng,
          location_updated_at: timestamp,
        }),
      ).toMatchObject({ location: { ...FALLBACK, updatedAt: 0 }, stale: true });
    },
  );

  test.each([
    [new Date(now - 299_999).toISOString(), false],
    [new Date(now - 300_000).toISOString(), false],
    [new Date(now - 300_001).toISOString(), true],
    ["bad timestamp", true],
    [null, true],
    [undefined, true],
  ])("marks timestamp %p stale=%p", (location_updated_at, stale) => {
    expect(
      mapVehicle({
        current_lat: 12.07,
        current_lng: 124.59,
        location_updated_at,
      }).stale,
    ).toBe(stale);
  });
});

describe("mapTrip", () => {
  const users = new Map([
    ["rider", { name: "Jo" }],
    ["driver-1", { name: "Ana", phone: "0917" }],
  ]);
  const drivers = new Map([
    ["driver-1", { association: "Co-op", plate_number: "Driver plate" }],
  ]);

  it("maps the complete booking and prefers the booking's plate", () => {
    expect(mapTrip(booking, users, drivers)).toStrictEqual({
      id: "booking-1",
      serviceType: "Tricycle",
      routeId: null,
      vehicleId: undefined,
      paymentStatus: undefined,
      pickup: "Market",
      destination: "Pier",
      pickupPoint: pickup,
      destinationPoint: destination,
      distance: 2.7,
      fare: 45.5,
      minutes: 8,
      geometry,
      fareReference: "Fare matrix",
      sampleFare: false,
      expires: Date.parse(booking.expires_at),
      passengerId: "rider",
      passenger: "Jo",
      driverId: "driver-1",
      driver: "Ana",
      driverPhone: "0917",
      driverAssociation: "Co-op",
      plate: "ABC 123",
      status: "Completed",
      createdAt: timestamp,
      timestamps: { Completed: now + 1000 },
      rating: 4,
      pickupNote: "Gate 2",
    });
  });

  test.each([
    ["PUJ/PUV", "route-1", "PUJ/PUV", "route-1"],
    ["Tricycle", null, "Tricycle", null],
    [null, null, "Tricycle", null],
    [undefined, undefined, "Tricycle", null],
  ])("maps service %p and route %p", (service_type, routes_id, serviceType, routeId) => {
    expect(mapTrip({ ...booking, service_type, routes_id }, users, drivers)).toMatchObject({
      serviceType,
      routeId,
    });
  });

  it("maps the assigned vehicle and an expired booking's final timestamp", () => {
    const row = {
      ...booking,
      service_type: "PUJ/PUV",
      vehicle_id: "vehicle-1",
      request_status: "Expired",
      timestamps: { Expired: now },
    };
    expect(mapTrip(row, users, drivers)).toMatchObject({
      vehicleId: "vehicle-1",
      status: "Expired",
      timestamps: { Expired: now },
    });
    expect(mapTrip({ ...row, vehicle_id: null }, users, drivers).vehicleId).toBeUndefined();
  });

  it.each(["pending", "unpaid", "paid"])("maps a trip record marked %s", (payment_status) => {
    const trip = mapTrip({ ...booking, trip_records: { payment_status } }, users, drivers);
    expect(trip.paymentStatus).toBe(payment_status);
  });

  test.each([
    undefined,
    null,
    {},
    { coordinates: "invalid" },
    { coordinates: [[124.59, 12.07]] },
  ])("builds a pickup-to-destination line for %p", (route_polyline) => {
    expect(
      mapTrip({ ...booking, route_polyline }, users, drivers).geometry,
    ).toStrictEqual({
      type: "LineString",
      coordinates: [
        [124.59, 12.07],
        [124.61, 12.09],
      ],
    });
  });

  it("uses defaults for an unassigned booking with nullable fields", () => {
    expect(
      mapTrip(
        {
          booking_id: "booking-2",
          user_id: "rider",
          request_status: "Requested",
          pickup_name: null,
          dropoff_name: "",
          driver_id: null,
          calculated_fixed_fare: null,
          expires_at: null,
          timestamps: null,
          pickup_note: "",
        },
        new Map(),
        new Map(),
      ),
    ).toStrictEqual({
      id: "booking-2",
      serviceType: "Tricycle",
      routeId: null,
      vehicleId: undefined,
      paymentStatus: undefined,
      pickup: "Pickup",
      destination: "Destination",
      pickupPoint: { name: "Pickup", latitude: 0, longitude: 0 },
      destinationPoint: { name: "Destination", latitude: 0, longitude: 0 },
      distance: 0,
      fare: 0,
      minutes: 0,
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [0, 0],
        ],
      },
      fareReference: "Fare matrix",
      sampleFare: false,
      expires: now + 600_000,
      passengerId: "rider",
      passenger: "Passenger",
      driverId: null,
      driver: undefined,
      driverPhone: undefined,
      driverAssociation: undefined,
      plate: undefined,
      status: "Requested",
      createdAt: timestamp,
      timestamps: {},
      rating: null,
      pickupNote: undefined,
    });
  });

  it("falls back to the stored driver name and driver record plate", () => {
    const trip = mapTrip(
      { ...booking, driver_plate: "", expires_at: undefined },
      new Map(),
      drivers,
    );
    expect(trip).toMatchObject({
      driver: "Stored driver",
      plate: "Driver plate",
      expires: now + 600_000,
    });
  });
});

describe("mapRun", () => {
  it("maps all fields and sorts events chronologically without mutating the database rows", () => {
    const departure = {
      at: timestamp,
      stop: "Market",
      boarded: "2",
      alighted: null,
      onboard: "2",
      type: "departure",
    };
    const stop = {
      at: booking.expires_at,
      stop: "Pier",
      boarded: "3",
      alighted: "2",
      onboard: "3",
      type: null,
    };
    const events = [stop, departure];
    expect(
      mapRun(
        {
          run_id: "run-1",
          driver_id: "driver-1",
          plate: "ABC",
          capacity: "20",
          routes_id: "r1",
          route_name: "Market loop",
          stops: [pickup, destination],
          fare: "14",
          reference: "Ordinance",
          status: "Completed",
          started_at: timestamp,
          ended_at: booking.expires_at,
          stop_index: "1",
          onboard: 0,
          total_boarded: "5",
          cash_fares: "70",
          revision: "3",
          driver_run_events: events,
        },
        new Map([["driver-1", { name: "Ana" }]]),
      ),
    ).toStrictEqual({
      id: "run-1",
      driverId: "driver-1",
      driver: "Ana",
      plate: "ABC",
      capacity: 20,
      routeId: "r1",
      routeName: "Market loop",
      stops: [pickup, destination],
      fare: 14,
      sampleFare: false,
      reference: "Ordinance",
      status: "Completed",
      startedAt: timestamp,
      endedAt: booking.expires_at,
      stopIndex: 1,
      onboard: 0,
      totalBoarded: 5,
      cashFares: 70,
      revision: 3,
      events: [
        {
          at: timestamp,
          stop: "Market",
          boarded: 2,
          alighted: 0,
          onboard: 2,
          type: "departure",
        },
        {
          at: booking.expires_at,
          stop: "Pier",
          boarded: 3,
          alighted: 2,
          onboard: 3,
          type: "stop",
        },
      ],
    });
    expect(events).toStrictEqual([stop, departure]);
  });

  test.each([null, undefined])(
    "defaults missing run fields with events=%p",
    (driver_run_events) => {
      expect(
        mapRun(
          {
            run_id: "run-1",
            driver_id: "driver-1",
            routes_id: "r1",
            stops: "not an array",
            started_at: timestamp,
            driver_run_events,
          },
          new Map(),
        ),
      ).toStrictEqual({
        id: "run-1",
        driverId: "driver-1",
        driver: "",
        plate: "",
        capacity: 18,
        routeId: "r1",
        routeName: "",
        stops: [],
        fare: 0,
        sampleFare: false,
        reference: "Fare matrix",
        status: "In progress",
        startedAt: timestamp,
        endedAt: null,
        stopIndex: 0,
        onboard: 0,
        totalBoarded: 0,
        cashFares: 0,
        revision: 1,
        events: [],
      });
    },
  );
});
