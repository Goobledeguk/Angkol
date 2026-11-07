import { populateAdministratorSamples } from "../admin/sampleAdministratorData";
import { createDriverRuns, createDriverTrips } from "../driver/sampleDriverData";
import { createSampleTrips } from "./sampleTrips";
import type {
  AdminLevel,
  Point,
  Quote,
  Role,
  Snapshot,
  User,
  Trip,
  DriverRun,
} from "../types/types";

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
  association: role === "PUJ / PUV driver" ? "" : "Sample association",
  franchiseName: role === "PUJ / PUV driver" ? "Calbayog Metro Express" : "",
  plate: role === "PUJ / PUV driver" ? "ABC 1234" : "AB 12345",
  permitNo: role === "Tricycle driver" ? "FP-CAL-2026-001" : "",
  capacity: 8,
  routeId: "CB01",
  location: { ...landmarks[0], updatedAt: Date.now() },
});
let state: Snapshot;
let signedIn = false;
let sequence = 0;
let quote: Quote | undefined;
export function selectDemo(role: Role, adminLevel?: AdminLevel) {
  const names: Record<string, string> = {
    Passenger: "April Lentejas",
    "Tricycle driver": "Meynard Salem",
    "PUJ / PUV driver": "Limuel Rosino",
    Administrator: adminLevel === "Franchise Owner" ? "Kent Ferrer" : "Shaina Moriles",
    "Vehicle Owner / Operator": "Kent Ferrer",
  };
  const effectiveRole: Role = role === "Vehicle Owner / Operator" ? "Administrator" : role;
  const user = makeUser(effectiveRole, "demo-user", names[role] || names[effectiveRole] || "Demo User");
  if (role === "Administrator" || role === "Vehicle Owner / Operator") {
    user.adminLevel = adminLevel || (role === "Vehicle Owner / Operator" ? "Franchise Owner" : "Technical Team");
    if (user.adminLevel === "Franchise Owner") {
      user.email = "kent@angkol.example";
      user.name = "Kent Ferrer";
      user.ownerVehicleIds = ["sample-driver-1", "sample-driver-3"];
    } else {
      user.email = "shaina@angkol.example";
      user.name = "Shaina Moriles";
    }
  }
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
    const request = createSampleTrips(passenger, user, landmarks)[0];
    state.trips.unshift({
      ...request,
      id: "SAMPLE-INCOMING-001",
      driverId: null,
      status: "Requested",
      rating: null,
      createdAt: new Date(state.serverTime).toISOString(),
      timestamps: { Requested: state.serverTime },
    });
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
  if (endpoint === "/login") {
    selectDemo(body.role || "Passenger");
    result = { token: "static-demo", user: state.user };
  } else if (endpoint === "/register") {
    selectDemo(body.role || "Passenger");
    if (body.role === "PUJ / PUV driver") {
      state.user.verified = false;
      state.user.available = false;
      state.user.pendingFranchiseApproval = true;
      if (body.franchiseName) state.user.franchiseName = body.franchiseName;
      if (body.license) state.user.license = body.license;
      if (body.name) state.user.name = body.name;
      if (body.email) state.user.email = body.email;
      if (body.phone) state.user.phone = body.phone;
      if (typeof body.licenseDocAttached === "boolean") {
        (state.user as any).licenseDocAttached = body.licenseDocAttached;
      }
    }
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
        status: "Accepted",
        createdAt: now,
        timestamps: { Requested: Date.now(), Accepted: Date.now() },
        rating: null,
        pickupNote: body.pickupNote,
        ...(body.demoMethod &&
        ["GCash", "Maya", "Bank transfer"].includes(body.demoMethod)
          ? {
              demoPayment: {
                method: body.demoMethod as "GCash" | "Maya" | "Bank transfer",
                status: "Test succeeded" as const,
                reference: `LOCAL-${sequence}`,
                realMoneyCharged: false as const,
              },
            }
          : {}),
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
      if (
        trip &&
        body.status === "Accepted" &&
        state.user.role.includes("driver")
      ) {
        trip.driverId = state.user.id;
        trip.driver = state.user.name;
        trip.plate = state.user.plate;
        trip.timestamps.Accepted = Date.now();
      }
      result = trip || { ok: true };
    } else if (endpoint === "/profile/photo") {
      state.user.photo =
        typeof body.photo === "string" && body.photo.startsWith("data:image/")
          ? body.photo
          : undefined;
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
    } else if (endpoint === "/vehicles/status" || (parts[1] === "vehicles" && parts[3] === "status")) {
      const vId = (body as any)?.id || parts[2];
      const vehicle = state.vehicles.find((v) => v.id === vId);
      if (vehicle) {
        vehicle.status = (body as any)?.status;
      }
      result = vehicle || { ok: true };
    } else if (parts[1] === "vehicles") {
      const vehicle = state.vehicles.find((v) => v.id === parts[2]);
      if (vehicle) {
        Object.assign(vehicle, body);
      }
      result = vehicle || { ok: true };
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
