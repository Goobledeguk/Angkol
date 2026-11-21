import { api, ApiError, clearSession } from "../api";
import { directions, searchPlaces } from "../mapbox";
import type { Quote, Trip } from "../../types/types";
import { driverColumns, ok, setupApiHarness, userColumns } from "./apiHarness";
import { booking, destination, geometry, now, pickup } from "./fixtures";

jest.mock("../supabase", () => ({ db: jest.fn() }));
jest.mock("../mapbox", () => ({
  directions: jest.fn(),
  searchPlaces: jest.fn(),
}));

const harness = setupApiHarness();
const route = { distanceKm: 2.74, minutes: 8, geometry };
const quoteRequest = { pickup, destination };
const outside = { ...pickup, latitude: 12.33 };
const serviceAreaError = { status: 400, message: "Angkol only operates within Calbayog City." };
const activeRideError = { status: 400, message: "You already have an active ride." };
const coordinates = {
  pickup_latitude: 12.07,
  pickup_longitude: 124.59,
  dropoff_latitude: 12.09,
  dropoff_longitude: 124.61,
  pickup_name: "Market",
  dropoff_name: "Pier",
  distance_km: 2.7,
  duration_min: 8,
  route_polyline: geometry,
};

beforeEach(() => {
  jest.mocked(directions).mockReset().mockResolvedValue(route);
  jest.mocked(searchPlaces).mockReset().mockResolvedValue([]);
});

function fare(data: unknown = "45.50", error?: string) {
  harness.fake.rpc(
    "quote_fare",
    [{ p_distance_km: 2.7, p_class: "Tricycle" }],
    data,
    error,
  );
}

function createQuote() {
  fare();
  return api<Quote>("/quote", quoteRequest);
}

function bookingLookups(driverId: string | null = "driver-1") {
  const userIds =
    driverId && driverId !== "rider" ? ["rider", driverId] : ["rider"];
  harness.fake.table(
    "users",
    [
      ["select", userColumns],
      ["in", "user_id", userIds],
    ],
    [
      { user_id: "rider", name: "Jo" },
      { user_id: "driver-1", name: "Ana", phone: "0917" },
    ],
  );
  harness.fake.table(
    "drivers",
    [
      ["select", driverColumns],
      ["in", "user_id", userIds],
    ],
    [{ user_id: "driver-1", association: "Co-op" }],
  );
}

describe("session and account API", () => {
  it("logs out without looking up the current user", async () => {
    await expect(api("/logout")).resolves.toEqual(ok);
    expect(harness.fake.client.auth.signOut).toHaveBeenCalledTimes(1);
    expect(harness.fake.client.auth.getUser).not.toHaveBeenCalled();
  });

  it("invalidates the in-memory quote even if sign-out throws", async () => {
    const quote = await createQuote();
    harness.fake.client.auth.signOut.mockRejectedValueOnce(
      new Error("offline"),
    );
    await expect(api("/logout")).resolves.toEqual(ok);
    await expect(api("/book", { quoteId: quote.id })).rejects.toMatchObject({
      status: 400,
      message: "Preview a route first.",
    });
  });

  it("deletes a passenger account without touching storage", async () => {
    harness.fake.rpc("my_profile", [], { user: { assigned_roles: ["Passenger"] } });
    harness.fake.rpc("delete_my_account", []);
    await expect(api("/account/delete")).resolves.toEqual(ok);
    const { rpc, auth, storage } = harness.fake.client;
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(rpc.mock.invocationCallOrder[1]).toBeLessThan(
      auth.signOut.mock.invocationCallOrder[0],
    );
    expect(storage.from).not.toHaveBeenCalled();
  });

  it.each([
    ["Tricycle driver", undefined],
    ["PUJ / PUV driver", { status: 404, message: "Object not found" }],
    ["PUJ / PUV driver", { status: 400, statusCode: "404", message: "Object not found" }],
  ] as const)("removes the %s license before deleting the account", async (role, error) => {
    harness.fake.rpc("my_profile", [], { user: { assigned_roles: [role] } });
    harness.fake.storage("driver-documents", ["remove", ["license/rider.jpg"]], null, error);
    harness.fake.rpc("delete_my_account", []);
    await expect(api("/account/delete")).resolves.toEqual(ok);
    const { rpc, auth, storage } = harness.fake.client;
    expect(storage.from.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[1]);
    expect(rpc.mock.invocationCallOrder[1]).toBeLessThan(auth.signOut.mock.invocationCallOrder[0]);
  });

  it("stops account deletion when removing the license fails", async () => {
    harness.fake.rpc("my_profile", [], { user: { assigned_roles: ["Tricycle driver"] } });
    harness.fake.storage("driver-documents", ["remove", ["license/rider.jpg"]], null, {
      status: 403,
      message: "Cannot remove license",
    });
    await expect(api("/account/delete")).rejects.toMatchObject({
      status: 400,
      message: "Cannot remove license",
    });
    expect(harness.fake.client.rpc.mock.calls).toEqual([["my_profile"]]);
    expect(harness.fake.client.auth.signOut).not.toHaveBeenCalled();
  });

  it("preserves the session when account deletion fails", async () => {
    harness.fake.rpc("my_profile", [], { user: { assigned_roles: ["Passenger"] } });
    harness.fake.rpc("delete_my_account", [], null, "cannot delete");
    await expect(api("/account/delete")).rejects.toMatchObject({
      status: 400,
      message: "cannot delete",
    });
    expect(harness.fake.client.auth.signOut).not.toHaveBeenCalled();
  });

  it("rejects authenticated endpoints when there is no current user", async () => {
    harness.fake.client.auth.getUser.mockResolvedValue({
      data: { user: null },
    });
    await expect(api("/state")).rejects.toMatchObject({
      status: 401,
      message: "Your session expired. Please sign in again.",
    });
  });

  it("returns the current no-op response for an unrecognized endpoint", async () => {
    await expect(api("/unknown")).resolves.toEqual(ok);
    expect(harness.fake.client.auth.getUser).toHaveBeenCalledTimes(1);
  });
});

describe("landmark search", () => {
  it("decodes and trims the name filter and coerces database coordinates", async () => {
    harness.fake.table(
      "landmarks",
      [
        ["select", "*"],
        ["ilike", "name", "%City Hall%"],
        ["limit", 8],
      ],
      [{ name: "City Hall", latitude: "12.07", longitude: "124.59" }],
    );
    await expect(api("/search?q=%20City%20Hall%20")).resolves.toEqual([
      { name: "City Hall", latitude: 12.07, longitude: 124.59 },
    ]);
    expect(searchPlaces).toHaveBeenCalledWith("City Hall");
  });

  test.each(["/search", "/search?q=%20P%20"])(
    "skips searches shorter than two characters for %s",
    async (endpoint) => {
      await expect(api(endpoint)).resolves.toEqual([]);
      expect(harness.fake.client.auth.getUser).not.toHaveBeenCalled();
      expect(harness.fake.client.from).not.toHaveBeenCalled();
      expect(searchPlaces).not.toHaveBeenCalled();
    },
  );

  it("returns unique landmarks before Mapbox matches and caps the merged list at eight", async () => {
    const landmarks = [
      pickup,
      { ...pickup, name: "mArKeT" },
      { ...pickup, name: "Market Annex" },
    ];
    harness.fake.table(
      "landmarks",
      [
        ["select", "*"],
        ["ilike", "name", "%Market%"],
        ["limit", 8],
      ],
      landmarks,
    );
    const remote = Array.from({ length: 8 }, (_, index) => ({
      ...destination,
      name: `Place ${index}`,
    }));
    jest
      .mocked(searchPlaces)
      .mockResolvedValue([
        { ...destination, name: "MARKET" },
        remote[0],
        { ...destination, name: "place 0" },
        ...remote.slice(1),
      ]);
    await expect(api("/search?q=Market")).resolves.toEqual([
      landmarks[0],
      landmarks[2],
      ...remote.slice(0, 6),
    ]);
  });

  it("returns landmarks when Mapbox fails", async () => {
    harness.fake.table(
      "landmarks",
      [
        ["select", "*"],
        ["ilike", "name", "%Pier%"],
        ["limit", 8],
      ],
      [destination],
    );
    jest.mocked(searchPlaces).mockRejectedValue(new Error("offline"));
    await expect(api("/search?q=Pier")).resolves.toEqual([destination]);
  });

  it("surfaces search errors as ApiError", async () => {
    harness.fake.table(
      "landmarks",
      [
        ["select", "*"],
        ["ilike", "name", "%Pier%"],
        ["limit", 8],
      ],
      null,
      "query failed",
    );
    await expect(api("/search?q=Pier")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("quotes and tricycle bookings", () => {
  test.each([{ pickup }, { destination }, {}])(
    "requires both points for %p",
    async (input) => {
      await expect(api("/quote", input)).rejects.toMatchObject({
        status: 400,
        message: "Choose both your pickup and destination.",
      });
      expect(directions).not.toHaveBeenCalled();
    },
  );

  it("returns the rounded distance, database fare and expiry", async () => {
    await expect(createQuote()).resolves.toStrictEqual({
      id: `quote-${now}`,
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
      expires: now + 600_000,
    });
    expect(directions).toHaveBeenCalledWith(pickup, destination);
  });

  it.each([{ pickup: outside, destination }, { pickup, destination: outside }])(
    "rejects a quote outside the service area before any request for %p",
    async (input) => {
      await expect(api("/quote", input)).rejects.toMatchObject(serviceAreaError);
      expect(harness.fake.client.auth.getUser).not.toHaveBeenCalled();
      expect(directions).not.toHaveBeenCalled();
    },
  );

  it("rejects a null fare", async () => {
    fare(null);
    await expect(api("/quote", quoteRequest)).rejects.toMatchObject({
      status: 503,
      message: "Tricycle fares are not set up yet.",
    });
  });

  it("propagates the fare RPC error", async () => {
    fare(null, "fare lookup failed");
    await expect(api("/quote", quoteRequest)).rejects.toMatchObject({
      status: 400,
      message: "fare lookup failed",
    });
  });

  it("propagates a directions failure without requesting a fare", async () => {
    const error = new Error("no route");
    jest.mocked(directions).mockRejectedValueOnce(error);
    await expect(api("/quote", quoteRequest)).rejects.toBe(error);
  });

  it("requires a previously generated quote", async () => {
    await expect(api("/book", { quoteId: "missing" })).rejects.toMatchObject({
      status: 400,
      message: "Preview a route first.",
    });
  });

  it("rejects a different quote ID", async () => {
    const quote = await createQuote();
    await expect(
      api("/book", { quoteId: `${quote.id}-different` }),
    ).rejects.toMatchObject({ status: 400, message: "Preview a route first." });
  });

  it("rejects the quote for a different signed-in user", async () => {
    const quote = await createQuote();
    harness.fake.client.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "another-user" } },
    });
    await expect(api("/book", { quoteId: quote.id })).rejects.toMatchObject({
      status: 400,
      message: "Preview a route first.",
    });
  });

  it("rejects a quote cleared while the booking checks the session", async () => {
    const quote = await createQuote();
    harness.fake.client.auth.getUser.mockImplementationOnce(async () => {
      await clearSession();
      return { data: { user: { id: "rider" } } };
    });
    await expect(api("/book", { quoteId: quote.id })).rejects.toMatchObject({
      status: 400,
      message: "Preview a route first.",
    });
    expect(harness.fake.client.from).not.toHaveBeenCalled();
  });

  it.each(["pickup", "destination"] as const)(
    "checks the booked %s before any request when it changed after the quote",
    async (point) => {
      const points = { pickup: { ...pickup }, destination: { ...destination } };
      fare();
      const quote = await api<Quote>("/quote", points);
      points[point].longitude = outside.longitude - 1;
      harness.fake.client.auth.getUser.mockClear();

      await expect(api("/book", { quoteId: quote.id })).rejects.toMatchObject(serviceAreaError);
      expect(harness.fake.client.auth.getUser).not.toHaveBeenCalled();
      expect(harness.fake.client.from).not.toHaveBeenCalled();
    },
  );

  test.each([0, 1])(
    "rejects a quote %i ms past the expiration time",
    async (offset) => {
      const quote = await createQuote();
      jest.setSystemTime(quote.expires + offset);
      await expect(api("/book", { quoteId: quote.id })).rejects.toMatchObject({
        status: 400,
        message: "This fare quote expired. Request a fresh quote.",
      });
    },
  );

  test.each([
    [{}, "Cash", null],
    [{ demoMethod: "GCash", pickupNote: "Gate 2" }, "GCash", "Gate 2"],
  ])(
    "books at the quoted distance with payment and note defaults for %p",
    async (body, payment_method, pickup_note) => {
      const quote = await createQuote();
      jest.setSystemTime(quote.expires - 1);
      harness.fake.table(
        "bookings",
        [
          [
            "insert",
            {
              ...coordinates,
              user_id: "rider",
              service_type: "Tricycle",
              payment_method,
              pickup_note,
            },
          ],
          ["select"],
          ["single"],
        ],
        { ...booking, calculated_fixed_fare: "48.75", pickup_note },
      );
      bookingLookups();
      await expect(
        api<Trip>("/book", { ...body, quoteId: quote.id }),
      ).resolves.toMatchObject({
        id: "booking-1",
        fare: 48.75,
        passenger: "Jo",
        driver: "Ana",
        driverPhone: "0917",
        driverAssociation: "Co-op",
        pickupNote: pickup_note ?? undefined,
      });
      await expect(api("/book", { quoteId: quote.id })).rejects.toMatchObject({
        status: 400,
        message: "Preview a route first.",
      });
    },
  );

  it("passes through the active-ride error and allows retrying the quote", async () => {
    const quote = await createQuote();
    const insert: Parameters<typeof harness.fake.table>[1] = [
      [
        "insert",
        {
          ...coordinates,
          user_id: "rider",
          service_type: "Tricycle",
          payment_method: "Cash",
          pickup_note: null,
        },
      ],
      ["select"],
      ["single"],
    ];
    harness.fake.table("bookings", insert, null, activeRideError.message);
    harness.fake.table("bookings", insert, { ...booking, driver_id: null });
    bookingLookups(null);
    await expect(api("/book", { quoteId: quote.id })).rejects.toMatchObject(activeRideError);
    await expect(
      api<Trip>("/book", { quoteId: quote.id }),
    ).resolves.toMatchObject({ driverId: null, passenger: "Jo" });
  });
});

describe("PUJ/PUV and trip actions", () => {
  const trip = {
    pickupPoint: pickup,
    destinationPoint: destination,
    pickup: "Market",
    destination: "Pier",
    distance: 2.7,
    minutes: 8,
    geometry,
  };

  it("requires a trip", async () => {
    await expect(api("/book-puj", { routeId: "r1" })).rejects.toMatchObject({
      status: 400,
      message: "No trip provided.",
    });
  });

  it("requires a route", async () => {
    await expect(api("/book-puj", { trip })).rejects.toMatchObject({
      status: 400,
      message: "Choose a PUJ/PUV route.",
    });
  });

  it.each(["pickupPoint", "destinationPoint"] as const)(
    "rejects a PUJ/PUV %s outside the service area before any request",
    async (point) => {
      await expect(
        api("/book-puj", { trip: { ...trip, [point]: outside }, routeId: "r1" }),
      ).rejects.toMatchObject(serviceAreaError);
      expect(harness.fake.client.auth.getUser).not.toHaveBeenCalled();
    },
  );

  it("passes through the active-ride error for a PUJ/PUV booking", async () => {
    harness.fake.table("bookings", [
      ["insert", {
        ...coordinates,
        user_id: "rider",
        routes_id: "r1",
        service_type: "PUJ/PUV",
        payment_method: "Cash",
      }],
      ["select"],
      ["single"],
    ], null, activeRideError.message);
    await expect(api("/book-puj", { trip, routeId: "r1" })).rejects.toMatchObject(activeRideError);
  });

  test.each([
    [2.74, 2.7],
    [0, 0.1],
    [200, 100],
  ])(
    "stores the route and adjusts the straight-line distance %p to %p km",
    async (distance, distance_km) => {
      harness.fake.table(
        "bookings",
        [
          [
            "insert",
            {
              ...coordinates,
              distance_km,
              user_id: "rider",
              routes_id: "r1",
              service_type: "PUJ/PUV",
              payment_method: "Cash",
            },
          ],
          ["select"],
          ["single"],
        ],
        { ...booking, driver_id: "rider", vehicle_id: "vehicle-1" },
      );
      bookingLookups("rider");
      await expect(
        api<Trip>("/book-puj", { trip: { ...trip, distance }, routeId: "r1" }),
      ).resolves.toMatchObject({
        id: "booking-1",
        driverId: "rider",
        passenger: "Jo",
        vehicleId: "vehicle-1",
      });
    },
  );

  test.each([
    ["4", 4],
    [undefined, 5],
    ["invalid", 5],
    [0, 0],
  ])("passes rating %p as %p", async (rating, value) => {
    harness.fake.rpc("rate_booking", [
      { p_booking_id: "booking-1", p_rating: value },
    ]);
    await expect(api("/trips/booking-1/rating", { rating })).resolves.toEqual(
      ok,
    );
  });

  it("declines a trip via the release RPC", async () => {
    harness.fake.rpc("release_booking", [{ p_booking_id: "booking-1" }]);
    await expect(api("/trips/booking-1/decline")).resolves.toEqual(ok);
  });

  test.each([
    ["Accepted", "Accepted"],
    ["Completed", "Completed"],
    [null, "Cancelled"],
  ])("transitions a trip from input %p to %p", async (status, value) => {
    harness.fake.rpc("transition_booking", [
      { p_booking_id: "booking-1", p_status: value },
    ]);
    await expect(api("/trips/booking-1", { status })).resolves.toEqual(ok);
  });

  it("returns a rejected transition to the caller", async () => {
    harness.fake.rpc(
      "transition_booking",
      [{ p_booking_id: "booking-1", p_status: "Completed" }],
      null,
      "transition forbidden",
    );
    await expect(
      api("/trips/booking-1", { status: "Completed" }),
    ).rejects.toMatchObject({ status: 400, message: "transition forbidden" });
  });
});
