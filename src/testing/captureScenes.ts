import { driverVehicleId, isStale } from "../domain/vehicles.ts";
import type { DriverRun, Snapshot, Trip, Vehicle } from "../types/types";
import {
  admin,
  FIXED_NOW,
  makeSnapshot,
  makeTrip,
  makeUser,
  passenger,
  pujDriver,
  routes as fixtureRoutes,
  runs as fixtureRuns,
  tricycleDriver as fixtureTricycleDriver,
  trips as fixtureTrips,
  vehicles as fixtureVehicles,
} from "./fixtures.ts";

export type CaptureScene = {
  id: string;
  role: "passenger" | "driver" | "pending" | "admin" | "auth";
  snapshot: Snapshot;
  params: { screen?: string; trip?: string; tab?: string };
  viewport: "phone" | "desktop";
};

export { FIXED_NOW };

const minutesAgo = (minutes: number) => FIXED_NOW - minutes * 60_000;
const timestamp = (minutes: number) =>
  new Date(minutesAgo(minutes)).toISOString();

const routeNames: Record<string, string> = {
  CB01: "City Hall – Public Market – Obrero",
  CB02: "Bagacay – Airport",
};
const routes = fixtureRoutes.map((route) => ({
  ...route,
  name: routeNames[route.id] ?? route.name,
}));
const runs = fixtureRuns.map((run) => ({
  ...run,
  routeName: routeNames[run.routeId] ?? run.routeName,
}));
const jeepneys = fixtureVehicles.map((vehicle) => ({
  ...vehicle,
  currentDriver: vehicle.currentDriver ?? "Edwin Mabini",
}));

// Places riders actually go, with the coordinates the map draws.
const place = {
  cityHall: { name: "Calbayog City Hall", latitude: 12.0676, longitude: 124.5942 },
  market: { name: "Calbayog Public Market", latitude: 12.0701, longitude: 124.5961 },
  terminal: { name: "Calbayog Transport Terminal", latitude: 12.063844, longitude: 124.601375 },
  nwssu: { name: "Northwest Samar State University", latitude: 12.0671, longitude: 124.6052 },
  sports: { name: "Calbayog City Sports Center", latitude: 12.0691, longitude: 124.5991 },
  airport: { name: "Calbayog Airport", latitude: 12.071184, longitude: 124.544383 },
};
type Place = (typeof place)[keyof typeof place];
const leg = (from: Place, to: Place, via?: Place) => ({
  pickup: from.name,
  destination: to.name,
  pickupPoint: from,
  destinationPoint: to,
  geometry: {
    type: "LineString" as const,
    coordinates: [from, ...(via ? [via] : []), to].map(
      ({ longitude, latitude }) => [longitude, latitude],
    ),
  },
});

// Other tricycles on the road around the city centre.
const tricycleFleet: Vehicle[] = [
  ["114", "Nonoy Gabon", "Near the transport terminal", 12.0641, 124.5968],
  ["209", "Arnel Tizon", "Obrero", 12.0738, 124.6012],
  ["063", "Bebot Uy", "Bagacay", 12.0622, 124.6079],
  ["148", "Rodel Abuda", "Near City Hall", 12.0709, 124.5893],
].map(([plate, driver, near, latitude, longitude], index) => ({
  id: `tri-${plate}`,
  name: String(driver),
  currentDriver: String(driver),
  kind: "Tricycle driver",
  vehicleType: "Tricycle",
  plate: String(plate),
  routeId: null,
  capacity: 3,
  location: {
    name: String(near),
    latitude: Number(latitude),
    longitude: Number(longitude),
    updatedAt: FIXED_NOW - (20 + index * 15) * 1000,
  },
  stale: false,
  status: "In transit",
}));

const approachingLocation: Vehicle["location"] = {
  name: "Calbayog Transport Terminal",
  latitude: 12.063844,
  longitude: 124.601375,
  updatedAt: FIXED_NOW - 20_000,
};
const tricycleDriver = makeUser({
  ...fixtureTricycleDriver,
  association: "Obrero TODA",
  plate: "027",
  location: approachingLocation,
});
const tricycleVehicle: Vehicle = {
  id: driverVehicleId(tricycleDriver.id),
  name: tricycleDriver.name,
  kind: "Tricycle driver",
  vehicleType: "Tricycle",
  plate: tricycleDriver.plate,
  routeId: tricycleDriver.routeId,
  capacity: tricycleDriver.capacity,
  location: approachingLocation,
  stale: false,
  status: "In transit",
};

const requested = makeTrip({
  id: "TRI1042",
  serviceType: "Tricycle",
  ...leg(place.cityHall, place.sports, place.market),
  pickupNote: "Waiting by the City Hall main entrance.",
  expires: minutesAgo(-8),
  timestamps: { Requested: minutesAgo(2) },
});

const accepted = makeTrip({
  ...requested,
  id: "TRI1040",
  ...leg(place.market, place.nwssu),
  distance: 2.2,
  minutes: 9,
  fare: 21,
  pickupNote: "Beside the fish section entrance.",
  status: "Accepted",
  driverId: tricycleDriver.id,
  driver: tricycleDriver.name,
  driverPhone: tricycleDriver.phone,
  driverAssociation: tricycleDriver.association,
  plate: tricycleDriver.plate,
  timestamps: { Requested: minutesAgo(2), Accepted: minutesAgo(1) },
});

const nonoy = {
  driverId: "user-nonoy",
  driver: "Nonoy Gabon",
  driverPhone: "09175550114",
  driverAssociation: "Carayman TODA",
  plate: "114",
};
const arrived = makeTrip({
  ...accepted,
  id: "TRI1039",
  ...leg(place.terminal, place.cityHall),
  ...nonoy,
  distance: 1.3,
  minutes: 6,
  fare: 15,
  pickupNote: "Near the van loading bay.",
  status: "Arrived",
  createdAt: timestamp(6),
  timestamps: {
    Requested: minutesAgo(6),
    Accepted: minutesAgo(5),
    Arrived: minutesAgo(1),
  },
});

const trackingLocation: Vehicle["location"] = {
  name: "Rizal Avenue",
  latitude: 12.0669,
  longitude: 124.6001,
  updatedAt: FIXED_NOW - 20_000,
};
const tracking = makeTrip({
  ...arrived,
  id: "TRI1037",
  ...leg(place.terminal, place.nwssu, place.sports),
  distance: 1.9,
  minutes: 8,
  fare: 19,
  status: "In progress",
  createdAt: timestamp(9),
  timestamps: {
    Requested: minutesAgo(9),
    Accepted: minutesAgo(8),
    Arrived: minutesAgo(5),
    "In progress": minutesAgo(4),
  },
});

const expired = makeTrip({
  ...requested,
  id: "TRI1041",
  status: "Expired",
  expires: minutesAgo(1),
  createdAt: timestamp(11),
  timestamps: { Requested: minutesAgo(11), Expired: minutesAgo(1) },
});

const receipt = makeTrip({
  ...tracking,
  ...leg(place.cityHall, place.airport, place.market),
  ...{
    driverId: tricycleDriver.id,
    driver: tricycleDriver.name,
    driverAssociation: tricycleDriver.association,
    plate: tricycleDriver.plate,
  },
  distance: 5.6,
  minutes: 18,
  fare: 45,
  rating: 5,
  id: "TRI1038",
  status: "Completed",
  paymentStatus: "paid",
  createdAt: timestamp(39),
  timestamps: {
    Requested: minutesAgo(39),
    Accepted: minutesAgo(38),
    Arrived: minutesAgo(35),
    "In progress": minutesAgo(34),
    Completed: minutesAgo(28),
  },
});

const route = routes[0];
const pickup = route.stops[0];
const destination = route.stops[route.stops.length - 1];
const seat = makeTrip({
  id: "PUV1052",
  serviceType: "PUJ/PUV",
  status: "Accepted",
  driverId: pujDriver.id,
  driver: pujDriver.name,
  plate: jeepneys[0].plate,
  vehicleId: jeepneys[0].id,
  routeId: route.id,
  pickup: pickup.name,
  destination: destination.name,
  pickupPoint: pickup,
  destinationPoint: destination,
  distance: 2.3,
  minutes: 15,
  fare: route.fare,
  fareReference: route.reference,
  geometry: {
    type: "LineString",
    coordinates: route.stops.map(({ longitude, latitude }) => [
      longitude,
      latitude,
    ]),
  },
  createdAt: timestamp(4),
  expires: minutesAgo(4 - 180),
  timestamps: { Requested: minutesAgo(4), Accepted: minutesAgo(4) },
});

const activeRun: DriverRun = {
  ...runs[0],
  id: "CB01-0930",
  status: "In progress",
  startedAt: timestamp(12),
  endedAt: null,
  stopIndex: 0,
  onboard: 9,
  totalBoarded: 9,
  cashFares: 135,
  revision: 1,
  events: [
    {
      at: timestamp(12),
      stop: pickup.name,
      boarded: 9,
      alighted: 0,
      onboard: 9,
      type: "departure",
    },
  ],
};

const pendingDriver = makeUser({
  id: "user-pending",
  name: "Ana Rosales",
  email: "ana@angkol.test",
  role: "PUJ / PUV driver",
  verified: false,
  applicationStatus: "pending",
  licenseDocAttached: true,
  license: "H03-21-004517",
  plate: "PUJ 9001",
  franchiseName: pujDriver.franchiseName,
});

const history = [
  receipt,
  ...fixtureTrips.map((trip) =>
    trip.driverId === tricycleDriver.id
      ? {
          ...trip,
          plate: tricycleDriver.plate,
          driverAssociation: tricycleDriver.association,
        }
      : trip,
  ),
];

// A believable week for Jun: 9 to 14 short fares a day, most of them
// between the market, City Hall and the schools.
const runsByDay = [11, 9, 14, 12, 10, 13, 4];
const shortLegs: [Place, Place, number, number, number][] = [
  [place.market, place.cityHall, 0.6, 3, 13],
  [place.cityHall, place.sports, 1.4, 6, 17],
  [place.market, place.nwssu, 2.2, 9, 21],
  [place.terminal, place.market, 1.6, 7, 19],
  [place.sports, place.terminal, 1.1, 5, 15],
  [place.nwssu, place.cityHall, 1.9, 8, 19],
];
const riders = ["Liza Pacle", "Ramon Uy", "Joy Rosales", "Ben Tiu", "Grace Abuda", "Paolo Sia"];
const driverWeek: Trip[] = runsByDay.flatMap((count, dayIndex) => {
  const daysAgo = runsByDay.length - 1 - dayIndex;
  return Array.from({ length: count }, (_, i) => {
    const [from, to, distance, minutes, fare] = shortLegs[(i + dayIndex) % shortLegs.length];
    const startMinutes = daysAgo * 24 * 60 + (dayIndex === runsByDay.length - 1 ? 150 : 180) - i * 38;
    const at = minutesAgo(startMinutes);
    return makeTrip({
      id: `TRI${(9000 + dayIndex * 20 + i).toString()}`,
      serviceType: "Tricycle",
      ...leg(from, to),
      distance,
      minutes,
      fare,
      passenger: riders[(i + dayIndex) % riders.length],
      passengerId: `rider-${(i + dayIndex) % riders.length}`,
      driverId: tricycleDriver.id,
      driver: tricycleDriver.name,
      driverAssociation: tricycleDriver.association,
      plate: tricycleDriver.plate,
      status: "Completed",
      paymentStatus: "paid",
      createdAt: new Date(at).toISOString(),
      timestamps: { Requested: at, Completed: at + minutes * 60_000 },
      rating: i % 3 ? 5 : null,
    });
  });
}).reverse();
const passengerData = makeSnapshot({
  users: [passenger, tricycleDriver, pujDriver, admin, pendingDriver],
  routes,
  runs,
  vehicles: [...jeepneys, tricycleVehicle, ...tricycleFleet],
  trips: history,
});
const tricycleData: Snapshot = {
  ...passengerData,
  user: tricycleDriver,
  trips: [requested, ...driverWeek],
};
const pujData: Snapshot = {
  ...passengerData,
  user: { ...pujDriver, location: jeepneys[0].location },
};
const adminVehicles: Vehicle[] = [
  { ...tricycleVehicle, location: trackingLocation },
  {
    ...jeepneys[0],
    location: { ...jeepneys[0].location, updatedAt: FIXED_NOW - 90_000 },
  },
  {
    ...jeepneys[1],
    location: { ...jeepneys[1].location, updatedAt: minutesAgo(4) },
  },
  ...tricycleFleet,
  {
    ...jeepneys[1],
    id: "veh-3",
    name: "Northline 03",
    plate: "PUJ 7712",
    currentDriver: "Dodong Lagbas",
    location: { ...routes[1].stops[1], updatedAt: minutesAgo(12) },
  },
];
const adminData: Snapshot = {
  ...passengerData,
  user: admin,
  vehicles: adminVehicles.map((vehicle) => ({
    ...vehicle,
    stale: isStale(vehicle.location.updatedAt, FIXED_NOW),
  })),
  trips: [seat, tracking, expired, ...history, ...driverWeek],
  runs: [activeRun, ...runs],
};

function scene(
  id: string,
  role: CaptureScene["role"],
  snapshot: Snapshot,
  screen?: string,
  trip?: Trip,
): CaptureScene {
  return {
    id,
    role,
    snapshot: trip
      ? {
          ...snapshot,
          trips: [trip, ...snapshot.trips.filter(({ id }) => id !== trip.id)],
        }
      : snapshot,
    params: {
      ...(screen ? { screen } : {}),
      ...(trip ? { trip: trip.id } : {}),
    },
    viewport: role === "admin" ? "desktop" : "phone",
  };
}

export const captureScenes = [
  scene("p-home", "passenger", passengerData, "Home"),
  scene("p-journey", "passenger", passengerData, "Journey"),
  scene("p-searching", "passenger", passengerData, "Ride accepted", requested),
  scene("p-accepted", "passenger", passengerData, "Ride accepted", accepted),
  scene(
    "p-track",
    "passenger",
    {
      ...passengerData,
      vehicles: [
        ...jeepneys,
        {
          ...tricycleFleet[0],
          id: driverVehicleId(nonoy.driverId),
          location: trackingLocation,
        },
      ],
    },
    "Track ride",
    tracking,
  ),
  scene(
    "p-arrived",
    "passenger",
    {
      ...passengerData,
      vehicles: [
        ...jeepneys,
        {
          ...tricycleFleet[0],
          id: driverVehicleId(nonoy.driverId),
          status: "Arrived",
          location: { ...arrived.pickupPoint, updatedAt: FIXED_NOW - 20_000 },
        },
      ],
    },
    "Arrived",
    arrived,
  ),
  scene("p-pay", "passenger", passengerData, "Pay cash", tracking),
  scene("p-expired", "passenger", passengerData, "Ride accepted", expired),
  scene("p-routes", "passenger", passengerData, "Routes"),
  scene("p-seat", "passenger", passengerData, "PUJ arrived", seat),
  scene("p-receipt", "passenger", passengerData, "Receipt", receipt),
  scene("p-trips", "passenger", passengerData, "Trips"),
  scene("p-notifications", "passenger", passengerData, "Notifications"),
  scene("d-online", "driver", tricycleData, "Dashboard"),
  scene("d-requests", "driver", tricycleData, "Requests"),
  scene("d-earnings", "driver", tricycleData, "Earnings"),
  scene(
    "d-pickup",
    "driver",
    { ...tricycleData, trips: history },
    "Trip",
    accepted,
  ),
  scene("d-profile", "driver", tricycleData, "Profile"),
  scene("j-run", "driver", { ...pujData, runs: [activeRun, ...runs] }, "Route"),
  scene("j-dashboard", "driver", pujData, "Dashboard"),
  scene("d-pending", "pending", { ...passengerData, user: pendingDriver }),
  scene("a-overview", "admin", adminData, "Overview"),
  scene("a-drivers", "admin", adminData, "People"),
  scene("a-routes-fares", "admin", adminData, "Routes & terminals"),
  scene("a-fleet", "admin", adminData, "Fleet tracking"),
  scene("a-trips", "admin", adminData, "Trips & reports"),
  scene("a-sign-in", "auth", passengerData),
  scene("welcome", "auth", passengerData),
];
