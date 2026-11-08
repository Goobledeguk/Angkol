import { populateAdministratorSamples } from "../admin/sampleAdministratorData";
import { createDriverRuns, createDriverTrips } from "../driver/sampleDriverData";
import { createSampleTrips } from "./sampleTrips";
import type {
  AdminLevel,
  ApplicationStatus,
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
const normalizeEmail = (email: string) => String(email || "").trim().toLowerCase();

type PendingApplication = User & { applicationStatus: ApplicationStatus; registeredAt: string };

const g = globalThis as any;
function pendingStore(): Map<string, PendingApplication> {
  if (!g.__angkolPendingApplications) {g.__angkolPendingApplications = new Map<string, PendingApplication>();}
  return g.__angkolPendingApplications;
}
const pendingApplications = pendingStore();

function injectPendingApplications() {
  if (!state || !pendingApplications.size) {
    return;
  }
  const existing = new Set(state.users.map((u) => u.id));
  for (const app of pendingApplications.values()) {
    if (existing.has(app.id)) {
      const idx = state.users.findIndex((u) => u.id === app.id);
      if (idx >= 0) {state.users[idx] = { ...state.users[idx], ...app };}
    } else {
      state.users.push(structuredClone(app));
    }
  }
}

function syncPendingUserFromRegistry() {
  if (!state?.user?.id) {
    return;
  }
  const app = pendingApplications.get(state.user.id);
  if (app) {
    state.user = { ...state.user, ...app };
    const idx = state.users.findIndex((u) => u.id === state.user.id);
    if (idx >= 0) {state.users[idx] = { ...state.users[idx], ...state.user };}
  }
}

export async function selectDemo(role: Role, adminLevel?: AdminLevel) {
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
      user.franchiseName = "Calbayog Metro Express";
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
  injectPendingApplications();
  syncPendingUserFromRegistry();

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
    await selectDemo(body.role || "Passenger");
    result = { token: "static-demo", user: state.user };
  } else if (endpoint === "/register") {
    if (body.role === "PUJ / PUV driver") {
      // Prototype: PUJ/PUV registration proceeds locally after the UI's approval wait.
      // Do not pass registrations to the franchise owner admin-web drivers tab.
      const appId = `puj-${normalizeEmail(body.email || String(++sequence))}-${Date.now()}`;
      const user: User = {
        ...makeUser("PUJ / PUV driver", appId, body.name?.trim() || "PUJ / PUV Driver"),
        email: body.email || `${appId}@example.invalid`,
        phone: body.phone?.trim() || "",
        license: body.license?.trim() || "",
        franchiseName: body.franchiseName?.trim() || "Calbayog Metro Express",
        licenseDocAttached: !!body.licenseDocAttached,
        association: "",
        plate: body.plate?.trim() || "ABC 1234",
        verified: true,
        available: false,
        pendingFranchiseApproval: false,
        applicationStatus: "accepted",
        location: { ...landmarks[0], updatedAt: Date.now() },
      };
      await selectDemo("PUJ / PUV driver");
      state.user = { ...state.user, ...user, id: appId };
      // Keep a non-admin local user record only; do not expose to franchise owner drivers tab.
      state.runs = createDriverRuns(state.user, state.routes[0], state.serverTime);
      signedIn = true;
      result = { token: "static-demo", user: state.user };
    } else {
      await selectDemo(body.role || "Passenger");
      result = { token: "static-demo", user: state.user };
    }
  } else if (endpoint === "/logout") {
    signedIn = false;
  } else {
    if (!signedIn) {
      throw new ApiError("Down Server", 401);
    }
    if (endpoint === "/state") {
      injectPendingApplications();
      syncPendingUserFromRegistry();
      result = state;
    } else if (endpoint === "/debug/pending-applications") {
      result = { count: pendingApplications.size, items: [...pendingApplications.values()] };
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
    } else if (endpoint === "/vehicles" && (method === "POST" || !method)) {
      const vId = (body.id as string) || `vehicle-${++sequence}`;
      const vehicle = {
        id: vId,
        name: String(body.name || body.plate || "Franchise vehicle"),
        kind: "PUJ / PUV driver" as Role,
        vehicleType: (body.vehicleType as any) || "Jeepney",
        plate: String(body.plate || "").trim(),
        routeId: String(body.routeId || state.routes?.[0]?.id || "CB01"),
        capacity: Number(body.capacity) || 18,
        location: (body.location as any) || (state.landmarks?.[0] ? { ...state.landmarks[0], updatedAt: Date.now() } : null),
        stale: false,
        status: (body.status as any) || "In Terminal",
        ownerId: state.user?.id,
        ownerName: state.user?.name,
        currentDriver: String(body.currentDriver || ""),
      };
      const idx = state.vehicles.findIndex((v) => v.id === vId || (vehicle.plate && v.plate === vehicle.plate));
      if (idx >= 0) {state.vehicles[idx] = { ...state.vehicles[idx], ...vehicle };} else {state.vehicles.unshift(vehicle as any);}
      if (state.user?.adminLevel === "Franchise Owner") {
        const ids = new Set(state.user.ownerVehicleIds || []);
        ids.add(vehicle.id);
        state.user.ownerVehicleIds = [...ids];
      }
      result = vehicle;
    } else if (endpoint === "/vehicles/status" || (parts[1] === "vehicles" && parts[3] === "status")) {
      const vId = (body as any)?.id || parts[2];
      const vehicle = state.vehicles.find((v) => v.id === vId);
      if (vehicle) {vehicle.status = (body as any)?.status;}
      result = vehicle || { ok: true };
    } else if (parts[1] === "vehicles") {
      const vehicle = state.vehicles.find((v) => v.id === parts[2]);
      if (vehicle) {Object.assign(vehicle, body);}
      result = vehicle || { ok: true };
    } else if (parts[1] === "drivers") {
      const target = state.users.find((u) => u.id === parts[2]);
      if (target) {Object.assign(target, body);}
      result = target || { ok: true };
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
      const boarded = Number(body.boarded || 0);
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
        reference: "Prototype trip record",
        status: "In progress",
        startedAt: now,
        endedAt: null,
        stopIndex: 0,
        onboard: boarded,
        totalBoarded: boarded,
        cashFares: boarded * route.fare,
        revision: 1,
        events: [
          {
            at: new Date(now).toISOString(),
            stop: route.stops[0]?.name || "Terminal",
            boarded,
            alighted: 0,
            onboard: boarded,
            type: "departure",
          },
        ],
      };
      state.runs!.unshift(run);
      result = run;
    } else if (parts[1] === "runs") {
      const run = state.runs!.find((r) => r.id === parts[2]);
      if (run) {
        if (body.action === "complete" || body.status === "Completed") {
          run.status = "Completed";
          run.endedAt = now;
          run.stopIndex = run.stops.length - 1;
          run.onboard = 0;
          run.cashFares = run.totalBoarded * run.fare;
          run.events = run.events || [];
          if (!run.events.some((e: any) => e.type === "complete")) {
            run.events.push({
              at: new Date(now).toISOString(),
              stop: run.stops[run.stops.length - 1]?.name || "Final stop",
              boarded: 0,
              alighted: run.totalBoarded,
              onboard: 0,
              type: "complete",
            });
          }
          run.revision++;
        } else {
          run.stopIndex = Math.min(run.stopIndex + 1, run.stops.length - 1);
          run.onboard = Math.max(
            0,
            run.onboard + Number(body.boarded || 0) - Number(body.alighted || 0),
          );
          run.totalBoarded += Number(body.boarded || 0);
          run.cashFares = run.totalBoarded * run.fare;
          run.events = run.events || [];
          run.events.push({
            at: new Date(now).toISOString(),
            stop: run.stops[run.stopIndex]?.name || "Stop",
            boarded: Number(body.boarded || 0),
            alighted: Number(body.alighted || 0),
            onboard: run.onboard,
            type: "stop",
          });
          run.revision++;
        }
      }
      result = run;
    }
  }
  return structuredClone(result) as T;
}