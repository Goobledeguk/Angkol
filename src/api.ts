import { populateAdministratorSamples } from "./sampleAdministratorData";
import { createDriverRuns, createDriverTrips } from "./sampleDriverData";
import { createSampleTrips } from "./sampleTrips";
import type {
  Point,
  Quote,
  Role,
  Snapshot,
  User,
  Trip,
  DriverRun,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const landmarks: Point[] = [
  { name: "Calbayog City Hall", latitude: 12.0676, longitude: 124.5942 },
  { name: "Calbayog Public Market", latitude: 12.06145, longitude: 124.61079 },
  { name: "Calbayog Airport", latitude: 12.072574, longitude: 124.54508 },
];
const makeUser = (role: Role, id: string, name: string): User => ({
  id,
  name,
  role,
  email: `${id}@example.invalid`,
  phone: "",
  available: true,
  verified: true,
  license: role.includes("driver") ? "N01-23-456789" : "",
  association: "Sample association",
  plate: role === "PUJ / PUV driver" ? "ABC 1234" : "AB 12345",
  capacity: 8,
  routeId: "CB01",
  location: { ...landmarks[0], updatedAt: Date.now() },
});
let state: Snapshot;
let signedIn = false;
let sequence = 0;
let quote: Quote | undefined;
export function selectDemo(role: Role) {
  const names: Record<Role, string> = {
    Passenger: "Isabella Reyes",
    "Tricycle driver": "Miguel Santos",
    "PUJ / PUV driver": "Rafael Mendoza",
    Administrator: "Patricia Villanueva",
  };
  const user = makeUser(role, "demo-user", names[role]);
  const driver = makeUser("Tricycle driver", "demo-driver", "Gabriel Torres");
  state = {
    user,
    users: [user, driver],
    landmarks,
    trips:
      role === "Passenger" ? createSampleTrips(user, driver, landmarks) : [],
    runs: [],
    routes: [
      {
        id: "CB01",
        name: "City Hall – Public Market",
        stops: landmarks.slice(0, 2),
        fare: 13,
        interval: 15,
        startsAt: "06:00",
        endsAt: "20:00",
        active: true,
        approved: false,
        reference: "Static sample",
      },
      {
        id: "CB02",
        name: "City Hall – Airport",
        stops: [landmarks[0], landmarks[2]],
        fare: 20,
        interval: 30,
        startsAt: "06:00",
        endsAt: "18:00",
        active: true,
        approved: false,
        reference: "Static sample",
      },
    ],
    terminals: [
      {
        id: "CT01",
        name: "Public Market terminal",
        point: landmarks[1],
        routeId: "CB01",
        active: true,
      },
    ],
    vehicles: [
      {
        id: driver.id,
        name: driver.name,
        kind: driver.role,
        plate: driver.plate,
        routeId: "CB01",
        capacity: 8,
        location: driver.location!,
        stale: false,
      },
    ],
    stopRequests: [],
    baseFare: 25,
    perKm: 8,
    fareApproved: false,
    sampleMode: true,
    fareReference: "Static sample",
    reports: [],
    notifications: [
      {
        id: "welcome",
        message:
          "Welcome to the standalone UI prototype. All data is fictional.",
        createdAt: new Date().toISOString(),
        read: false,
      },
    ],
    logs: [],
    serverTime: Date.now(),
  };
  if (role === "Tricycle driver") {
    const passenger = makeUser(
      "Passenger",
      "sample-passenger",
      "Camille Navarro",
    );
    state.trips = createDriverTrips(
      user,
      passenger,
      landmarks,
      state.serverTime,
    );
  } else if (role === "PUJ / PUV driver") {
    state.runs = createDriverRuns(user, state.routes[0], state.serverTime);
  }

  if (role === "Administrator") {
    populateAdministratorSamples(state);
  }

  signedIn = true;
}

export async function clearSession() {
  signedIn = false;
  quote = undefined;
}
/** Local UI adapter. Never reads credentials, environment URLs, storage, or a network. */
export async function api<T = { ok: boolean }>(
  endpoint: string,
  input?: unknown,
  method?: string,
): Promise<T> {
  const body = (input || {}) as Record<string, any>;
  const parts = endpoint.split("/");
  const id = () => `demo-${++sequence}`;
  const now = new Date().toISOString();
  let result: unknown = { ok: true };
  if (endpoint === "/login" || endpoint === "/register") {
    selectDemo(body.role || "Passenger");
    result = { token: "static-demo", user: state.user };
  } else if (endpoint === "/logout") {
    signedIn = false;
  } else {
    if (!signedIn) {
      throw new ApiError("Choose a demo screen.", 401);
    }
    if (endpoint === "/state") {
      result = state;
    } else if (endpoint.startsWith("/search")) {
      result = landmarks.filter((p) =>
        p.name
          .toLowerCase()
          .includes(
            decodeURIComponent(endpoint.split("q=")[1] || "").toLowerCase(),
          ),
      );
    } else if (endpoint === "/quote") {
      const pickup = body.pickup as Point;
      const destination = body.destination as Point;
      quote = {
        id: id(),
        pickup: pickup.name,
        destination: destination.name,
        pickupPoint: pickup,
        destinationPoint: destination,
        distance: 3.2,
        fare: 43,
        minutes: 12,
        geometry: {
          type: "LineString",
          coordinates: [
            [pickup.longitude, pickup.latitude],
            [destination.longitude, destination.latitude],
          ],
        },
        fareReference: "Static sample",
        sampleFare: true,
        expires: Date.now() + 3600000,
      };
      result = quote;
    } else if (endpoint === "/book") {
      if (!quote) {
        throw new ApiError("Preview a route first.", 400);
      }
      const trip: Trip = {
        ...quote,
        id: id(),
        passengerId: state.user.id,
        passenger: state.user.name,
        driverId: "demo-driver",
        driver: "Gabriel Torres",
        plate: "AB 12345",
        status: "Requested",
        createdAt: now,
        timestamps: { Requested: Date.now() },
        rating: null,
        pickupNote: body.pickupNote,
      };
      state.trips.unshift(trip);
      result = trip;
    } else if (parts[1] === "trips") {
      const trip = state.trips.find((t) => t.id === parts[2]);
      if (trip) {
        Object.assign(
          trip,
          parts[3] === "decline" ? { status: "Cancelled" } : body,
        );
      }
      result = trip || { ok: true };
    } else if (endpoint === "/profile") {
      Object.assign(state.user, body);
    } else if (endpoint === "/availability") {
      state.user.available = !!body.available;
    } else if (endpoint === "/notifications/read") {
      state.notifications.forEach((n) => (n.read = true));
    } else if (endpoint === "/report") {
      state.reports.unshift({
        id: id(),
        details: body.details,
        tripId: body.tripId || null,
        status: "open",
        reporter: state.user.name,
        createdAt: now,
      });
    } else if (parts[1] === "reports") {
      Object.assign(state.reports.find((r) => r.id === parts[2]) || {}, body);
    } else if (parts[1] === "drivers") {
      Object.assign(state.users.find((u) => u.id === parts[2]) || {}, body);
    } else if (endpoint === "/configure") {
      Object.assign(state, body);
    } else if (endpoint === "/stop") {
      state.stopRequests.push({
        id: id(),
        routeId: body.routeId,
        point: body.point,
        passenger: state.user.name,
        userId: state.user.id,
        createdAt: Date.now(),
      });
    } else if (parts[1] === "stops" && method === "DELETE") {
      state.stopRequests = state.stopRequests.filter((s) => s.id !== parts[2]);
    } else if (endpoint === "/runs") {
      const route =
        state.routes.find((r) => r.id === state.user.routeId) ||
        state.routes[0];
      const run: DriverRun = {
        id: id(),
        driverId: state.user.id,
        driver: state.user.name,
        plate: state.user.plate,
        capacity: state.user.capacity,
        routeId: route.id,
        routeName: route.name,
        stops: route.stops,
        fare: route.fare,
        sampleFare: true,
        reference: "Static sample",
        status: "In progress",
        startedAt: now,
        endedAt: null,
        stopIndex: 0,
        onboard: Number(body.boarded || 0),
        totalBoarded: Number(body.boarded || 0),
        cashFares: 0,
        revision: 1,
        events: [],
      };
      state.runs!.unshift(run);
      result = run;
    } else if (parts[1] === "runs") {
      const run = state.runs!.find((r) => r.id === parts[2]);
      if (run) {
        run.stopIndex = Math.min(run.stopIndex + 1, run.stops.length - 1);
        run.onboard = Math.max(
          0,
          run.onboard + Number(body.boarded || 0) - Number(body.alighted || 0),
        );
        run.totalBoarded += Number(body.boarded || 0);
        run.revision++;
        if (body.status === "Completed") {
          run.status = "Completed";
          run.endedAt = now;
        }
      }
      result = run;
    }
  }
  return structuredClone(result) as T;
}
