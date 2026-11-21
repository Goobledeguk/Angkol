import type { DriverRun, Route, Snapshot, Trip, User, Vehicle } from "../types/types";

export const FIXED_NOW = Date.parse("2026-11-21T09:30:00+08:00");

const iso = (minutesAgo: number) => new Date(FIXED_NOW - minutesAgo * 60_000).toISOString();

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-passenger",
    email: "maria@angkol.test",
    name: "Maria Dela Cruz",
    phone: "09171234567",
    role: "Passenger",
    available: false,
    verified: true,
    applicationStatus: "accepted",
    license: "",
    association: "",
    plate: "",
    capacity: 0,
    routeId: null,
    location: null,
    ...overrides,
  };
}

export const passenger = makeUser();

export const tricycleDriver = makeUser({
  id: "user-tricycle",
  email: "jun@angkol.test",
  name: "Jun Abalos",
  phone: "09181112222",
  role: "Tricycle driver",
  available: true,
  license: "N04-12-345678",
  association: "Calbayog TODA",
  plate: "TC 4821",
  capacity: 3,
  location: { name: "Current location", latitude: 12.0689, longitude: 124.5951, updatedAt: FIXED_NOW - 30_000 },
});

export const pujDriver = makeUser({
  id: "user-puj",
  email: "rey@angkol.test",
  name: "Rey Tan",
  phone: "09192223333",
  role: "PUJ / PUV driver",
  available: true,
  license: "N05-98-765432",
  association: "Obrero Jeepney Operators",
  plate: "PUJ 7710",
  capacity: 18,
  routeId: "CB01",
  franchiseName: "Samar Northline",
});

export const admin = makeUser({
  id: "user-admin",
  email: "ops@angkol.test",
  name: "Lea Operations",
  role: "Administrator",
  adminLevel: "Technical Team",
});

export const routes: Route[] = [
  {
    id: "CB01",
    name: "Calbayog City Hall ↔ Obrero",
    destination: "Obrero",
    transportType: "PUJ / PUV",
    scheduled: true,
    stops: [
      { name: "Calbayog City Hall", latitude: 12.0676, longitude: 124.5942 },
      { name: "Public Market", latitude: 12.0701, longitude: 124.5961 },
      { name: "Obrero", latitude: 12.0798, longitude: 124.6041 },
    ],
    fare: 15,
    interval: 15,
    startsAt: "06:00",
    endsAt: "20:00",
    active: true,
    approved: true,
    reference: "LTFRB fare matrix",
  },
  {
    id: "CB02",
    name: "Bagacay ↔ Airport",
    destination: "Calbayog Airport",
    transportType: "PUJ / PUV",
    scheduled: true,
    stops: [
      { name: "Bagacay", latitude: 12.0521, longitude: 124.5821 },
      { name: "Calbayog Airport", latitude: 12.0716, longitude: 124.5661 },
    ],
    fare: 20,
    interval: 20,
    startsAt: "05:30",
    endsAt: "19:30",
    active: true,
    approved: true,
    reference: "LTFRB fare matrix",
  },
];

export const vehicles: Vehicle[] = [
  {
    id: "veh-1",
    name: "Northline 01",
    kind: "PUJ / PUV driver",
    vehicleType: "Jeepney",
    plate: "PUJ 7710",
    routeId: "CB01",
    capacity: 18,
    location: { name: "Public Market", latitude: 12.0701, longitude: 124.5961, updatedAt: FIXED_NOW - 40_000 },
    stale: false,
    status: "In transit",
    currentDriver: "Rey Tan",
  },
  {
    id: "veh-2",
    name: "Northline 02",
    kind: "PUJ / PUV driver",
    vehicleType: "Jeepney",
    plate: "PUJ 7711",
    routeId: "CB02",
    capacity: 18,
    location: { name: "Bagacay", latitude: 12.0521, longitude: 124.5821, updatedAt: FIXED_NOW - 20 * 60_000 },
    stale: true,
    status: "In Terminal",
  },
];

const geometry = {
  type: "LineString" as const,
  coordinates: [
    [124.5942, 12.0676],
    [124.5961, 12.0701],
    [124.5991, 12.0691],
  ],
};

export function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1",
    pickup: "Calbayog City Hall",
    destination: "Calbayog City Sports Center",
    pickupPoint: { name: "Calbayog City Hall", latitude: 12.0676, longitude: 124.5942 },
    destinationPoint: { name: "Calbayog City Sports Center", latitude: 12.0691, longitude: 124.5991 },
    distance: 1.4,
    fare: 17,
    minutes: 6,
    geometry,
    fareReference: "Fare matrix",
    sampleFare: false,
    expires: FIXED_NOW + 10 * 60_000,
    passengerId: passenger.id,
    passenger: passenger.name,
    driverId: null,
    status: "Requested",
    createdAt: iso(2),
    timestamps: {},
    rating: null,
    ...overrides,
  };
}

export const trips: Trip[] = [
  makeTrip({ id: "trip-done-1", status: "Completed", driverId: tricycleDriver.id, driver: tricycleDriver.name, plate: tricycleDriver.plate, createdAt: iso(60 * 26), rating: 5 }),
  makeTrip({
    id: "trip-done-2",
    pickup: "Calbayog Public Market",
    destination: "Northwest Samar State University",
    pickupPoint: { name: "Calbayog Public Market", latitude: 12.0701, longitude: 124.5961 },
    destinationPoint: { name: "Northwest Samar State University", latitude: 12.0671, longitude: 124.6052 },
    distance: 2.2,
    fare: 21,
    status: "Completed",
    driverId: tricycleDriver.id,
    driver: tricycleDriver.name,
    plate: tricycleDriver.plate,
    createdAt: iso(60 * 50),
    rating: null,
  }),
  makeTrip({ id: "trip-cancelled", status: "Cancelled", createdAt: iso(60 * 72) }),
];

export const runs: DriverRun[] = [
  {
    id: "run-1",
    driverId: pujDriver.id,
    driver: pujDriver.name,
    plate: pujDriver.plate,
    capacity: 18,
    routeId: "CB01",
    routeName: "Calbayog City Hall ↔ Obrero",
    stops: routes[0].stops,
    fare: 15,
    sampleFare: false,
    reference: "LTFRB fare matrix",
    status: "Completed",
    startedAt: iso(180),
    endedAt: iso(140),
    stopIndex: 2,
    onboard: 0,
    totalBoarded: 14,
    cashFares: 210,
    revision: 4,
    events: [
      { at: iso(180), stop: "Calbayog City Hall", boarded: 9, alighted: 0, onboard: 9, type: "departure" },
      { at: iso(165), stop: "Public Market", boarded: 5, alighted: 3, onboard: 11, type: "stop" },
      { at: iso(140), stop: "Obrero", boarded: 0, alighted: 14, onboard: 0, type: "complete" },
    ],
  },
];

export function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    user: passenger,
    users: [passenger, tricycleDriver, pujDriver, admin, makeUser({ id: "user-pending", name: "Ana Pending", role: "PUJ / PUV driver", applicationStatus: "pending", verified: false, plate: "PUJ 9001", license: "N01-00-000001" })],
    routes,
    terminals: [
      { id: "TERM01", name: "Calbayog City Hall", point: routes[0].stops[0], routeId: "CB01", active: true },
      { id: "TERM02", name: "Bagacay Terminal", point: routes[1].stops[0], routeId: "CB02", active: true },
    ],
    vehicles: [
      ...vehicles,
      {
        id: "driver-user-tricycle",
        name: tricycleDriver.name,
        kind: "Tricycle driver",
        vehicleType: "Tricycle",
        plate: tricycleDriver.plate,
        routeId: null,
        capacity: 3,
        location: { name: tricycleDriver.name, latitude: 12.0684, longitude: 124.5949, updatedAt: FIXED_NOW - 30_000 },
        stale: false,
        status: "In transit",
      },
    ],
    trips,
    runs,
    landmarks: [
      { name: "Calbayog City Hall", latitude: 12.0676, longitude: 124.5942 },
      { name: "Calbayog Public Market", latitude: 12.0701, longitude: 124.5961 },
      { name: "Calbayog Transport Terminal", latitude: 12.0631, longitude: 124.6011 },
      { name: "Calbayog Airport", latitude: 12.0716, longitude: 124.5661 },
      { name: "Northwest Samar State University", latitude: 12.0671, longitude: 124.6052 },
      { name: "Calbayog City Sports Center", latitude: 12.0691, longitude: 124.5991 },
    ],
    stopRequests: [],
    baseFare: 10,
    perKm: 5,
    fareApproved: true,
    sampleMode: false,
    fareReference: "Fare matrix",
    reports: [
      { id: "rep-1", details: "Driver asked for more than the quoted fare.", tripId: "trip-done-2", status: "open", reporter: passenger.name, createdAt: iso(60 * 49) },
    ],
    notifications: [
      { id: "n-1", message: "Your trip to Calbayog City Sports Center is complete.", createdAt: iso(60 * 26), read: false },
    ],
    logs: [{ id: 1, action: "login", at: iso(5) }],
    serverTime: FIXED_NOW,
    ...overrides,
  };
}
