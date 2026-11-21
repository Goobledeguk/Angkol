import { db } from "./supabase";
import { directions } from "./mapbox";
import type {
  DriverRun,
  Point,
  Quote,
  Role,
  Route,
  Snapshot,
  Trip,
  User,
  Vehicle,
} from "../types/types";

/**
 * Live data adapter.
 *
 * Every screen still calls `api(endpoint, body)` exactly as before; this file
 * maps those calls onto Supabase tables/RPCs. UI code never talks to Supabase
 * directly, so the screens stay unchanged.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const FALLBACK: Point = {
  name: "Calbayog City Hall",
  latitude: 12.0676,
  longitude: 124.5942,
};

const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const str = (value: unknown) => (value == null ? "" : String(value));
const shortTime = (value: unknown, fallback: string) => {
  const text = str(value);
  return /^\d{2}:\d{2}/.test(text) ? text.slice(0, 5) : fallback;
};

let lastQuote: { quote: Quote; userId: string } | null = null;

const USER_COLUMNS =
  "user_id,name,phone,contact_numbers,photo,assigned_roles,admin_level,franchise_name,verified,application_status,created_at";
const DRIVER_COLUMNS =
  "driver_id,user_id,operational_classification,availability_status,association,plate_number,capacity,franchise_name,routes_id,verified,current_lat,current_lng,location_updated_at";
const ADMIN_ROLES = ["Administrator", "Vehicle Owner / Operator"];

async function myProfile(): Promise<{ user: any; driver: any }> {
  const { data, error } = await db().rpc("my_profile");
  raise(error);
  const profile = (data ?? {}) as { user?: any; driver?: any };
  if (!profile.user) {
    throw new ApiError("No profile found for this account.", 404);
  }
  return { user: profile.user, driver: profile.driver ?? null };
}

const isAdminRow = (row: any) => ADMIN_ROLES.includes(row?.assigned_roles?.[0]);

async function currentUserId(): Promise<string> {
  const { data } = await db().auth.getUser();
  if (!data.user) {
    throw new ApiError("Your session expired. Please sign in again.", 401);
  }
  return data.user.id;
}

function raise(error: { message: string } | null) {
  if (error) {throw new ApiError(error.message, 400);}
}

/* ------------------------------------------------------------------ mappers */

function mapUser(row: any, driver?: any): User {
  const role = (row.assigned_roles?.[0] ?? "Passenger") as Role;
  const hasLocation =
    driver?.current_lat != null && driver?.current_lng != null;
  return {
    id: row.user_id,
    email: str(row.email),
    name: str(row.name) || str(row.email),
    phone: str(row.phone || row.contact_numbers),
    role,
    photo: row.photo || undefined,
    adminLevel: row.admin_level ?? undefined,
    ownerVehicleIds: undefined,
    available: driver?.availability_status === "available",
    verified: !!row.verified,
    pendingFranchiseApproval: row.application_status === "pending",
    applicationStatus: row.application_status ?? "accepted",
    licenseDocAttached: driver?.license_doc_attached ?? false,
    license: str(driver?.license_number),
    association: str(driver?.association),
    plate: str(driver?.plate_number),
    permitNo: str(driver?.permit_number) || undefined,
    franchiseName: driver?.franchise_name || row.franchise_name || undefined,
    capacity: num(driver?.capacity),
    routeId: driver?.routes_id ?? null,
    location: hasLocation
      ? {
          name: "Current location",
          latitude: num(driver.current_lat),
          longitude: num(driver.current_lng),
          updatedAt: driver.location_updated_at
            ? Date.parse(driver.location_updated_at)
            : Date.now(),
        }
      : null,
  };
}

function mapRoute(row: any): Route {
  return {
    id: row.routes_id,
    name: str(row.route_name),
    stops: Array.isArray(row.stops) ? row.stops : [],
    fare: num(row.fare),
    interval: num(row.interval_minutes, 15),
    startsAt: shortTime(row.starts_at, "06:00"),
    endsAt: shortTime(row.ends_at, "20:00"),
    active: !!row.active,
    approved: !!row.approved,
    reference: str(row.reference) || "Fare matrix",
    destination: str(row.destination),
    transportType: row.transport_type === "Tricycle" ? "Tricycle" : "PUJ / PUV",
    scheduled: !!row.scheduled,
  };
}

function mapVehicle(row: any): Vehicle {
  const lat = num(row.current_lat, FALLBACK.latitude);
  const lng = num(row.current_lng, FALLBACK.longitude);
  const updatedAt = row.location_updated_at
    ? Date.parse(row.location_updated_at)
    : 0;
  return {
    id: row.vehicle_id,
    name: str(row.name) || str(row.plate_number),
    kind: "PUJ / PUV driver",
    vehicleType: row.vehicle_type || "Jeepney",
    plate: str(row.plate_number),
    routeId: row.routes_id ?? null,
    capacity: num(row.capacity, 18),
    location: {
      name: str(row.name) || str(row.plate_number) || FALLBACK.name,
      latitude: lat,
      longitude: lng,
      updatedAt,
    },
    stale: !updatedAt || Date.now() - updatedAt > 5 * 60 * 1000,
    status: row.status ?? "In Terminal",
    ownerId: row.owner_id ?? undefined,
    currentDriver: str(row.current_driver) || undefined,
  };
}

function mapTrip(booking: any, users: Map<string, any>, drivers: Map<string, any>): Trip {
  const pickupPoint: Point = {
    name: str(booking.pickup_name) || "Pickup",
    latitude: num(booking.pickup_latitude),
    longitude: num(booking.pickup_longitude),
  };
  const destinationPoint: Point = {
    name: str(booking.dropoff_name) || "Destination",
    latitude: num(booking.dropoff_latitude),
    longitude: num(booking.dropoff_longitude),
  };
  const driverUser = booking.driver_id ? users.get(booking.driver_id) : undefined;
  const driverRecord = booking.driver_id
    ? drivers.get(booking.driver_id)
    : undefined;
  const coords = booking.route_polyline?.coordinates;
  const created = booking.created_at
    ? Date.parse(booking.created_at)
    : Date.now();

  return {
    id: booking.booking_id,
    pickup: pickupPoint.name,
    destination: destinationPoint.name,
    pickupPoint,
    destinationPoint,
    distance: num(booking.distance_km),
    fare: num(booking.calculated_fixed_fare),
    minutes: num(booking.duration_min),
    geometry:
      Array.isArray(coords) && coords.length >= 2
        ? { type: "LineString", coordinates: coords }
        : {
            type: "LineString",
            coordinates: [
              [pickupPoint.longitude, pickupPoint.latitude],
              [destinationPoint.longitude, destinationPoint.latitude],
            ],
          },
    fareReference: "Fare matrix",
    sampleFare: false,
    expires: booking.expires_at
      ? Date.parse(booking.expires_at)
      : created + 10 * 60 * 1000,
    passengerId: booking.user_id,
    passenger: str(users.get(booking.user_id)?.name) || "Passenger",
    driverId: booking.driver_id ?? null,
    driver: str(driverUser?.name) || str(booking.driver_name) || undefined,
    driverPhone: str(driverUser?.phone) || undefined,
    driverAssociation: str(driverRecord?.association) || undefined,
    plate: str(booking.driver_plate) || str(driverRecord?.plate_number) || undefined,
    status: booking.request_status,
    createdAt: booking.created_at || new Date().toISOString(),
    timestamps: booking.timestamps || {},
    rating: booking.rating ?? null,
    pickupNote: booking.pickup_note || undefined,
  };
}

function mapRun(row: any, users: Map<string, any>): DriverRun {
  const events = (row.driver_run_events || [])
    .map((event: any) => ({
      at: event.at,
      stop: str(event.stop),
      boarded: num(event.boarded),
      alighted: num(event.alighted),
      onboard: num(event.onboard),
      type: str(event.type) || "stop",
    }))
    .sort((a: any, b: any) => Date.parse(a.at) - Date.parse(b.at));

  return {
    id: row.run_id,
    driverId: row.driver_id,
    driver: str(users.get(row.driver_id)?.name),
    plate: str(row.plate),
    capacity: num(row.capacity, 18),
    routeId: row.routes_id,
    routeName: str(row.route_name),
    stops: Array.isArray(row.stops) ? row.stops : [],
    fare: num(row.fare),
    sampleFare: false,
    reference: str(row.reference) || "Fare matrix",
    status: row.status === "Completed" ? "Completed" : "In progress",
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
    stopIndex: num(row.stop_index),
    onboard: num(row.onboard),
    totalBoarded: num(row.total_boarded),
    cashFares: num(row.cash_fares),
    revision: num(row.revision, 1),
    events,
  };
}

/* ------------------------------------------------------------------ snapshot */

async function loadSnapshot(): Promise<Snapshot> {
  const client = db();
  const userId = await currentUserId();
  const profile = await myProfile();
  const admin = isAdminRow(profile.user);

  const [
    usersResult,
    driversResult,
    routesResult,
    terminalsResult,
    vehiclesResult,
    bookingsResult,
    runsResult,
    stopsResult,
    reportsResult,
    notificationsResult,
    landmarksResult,
    faresResult,
    logsResult,
  ] = await Promise.all([
    admin ? client.rpc("admin_users") : client.from("users").select(USER_COLUMNS),
    admin ? client.rpc("admin_drivers") : client.from("drivers").select(DRIVER_COLUMNS),
    client.from("routes").select("*").order("route_name"),
    client.from("terminals").select("*").order("station_name"),
    client.from("vehicles").select("*").order("name"),
    client
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80),
    client
      .from("driver_runs")
      .select("*, driver_run_events(*)")
      .order("started_at", { ascending: false })
      .limit(40),
    client.from("stop_requests").select("*").order("created_at"),
    client.from("reports").select("*").order("created_at", { ascending: false }),
    client
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    client.from("landmarks").select("*").order("name"),
    client.from("fare_matrices").select("*").eq("active", true),
    client
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  raise(usersResult.error);
  raise(driversResult.error);

  const users = (usersResult.data ?? []) as any[];
  const drivers = (driversResult.data ?? []) as any[];
  const userMap = new Map(users.map((row) => [row.user_id, row]));
  const driverMap = new Map(drivers.map((row) => [row.user_id, row]));
  userMap.set(userId, profile.user);
  if (profile.driver) {
    driverMap.set(userId, profile.driver);
  }

  const user = mapUser(profile.user, profile.driver ?? undefined);

  const routes = ((routesResult.data ?? []) as any[]).map(mapRoute);
  const terminals = ((terminalsResult.data ?? []) as any[]).map((row) => ({
    id: row.terminal_id,
    name: str(row.station_name),
    point: {
      name: str(row.station_name),
      latitude: num(row.latitude),
      longitude: num(row.longitude),
    },
    routeId: row.routes_id,
    active: !!row.active,
  }));

  const vehicles = ((vehiclesResult.data ?? []) as any[]).map(mapVehicle);
  if (user.role === "Passenger") {
    for (const row of drivers) {
      if (row.current_lat == null || row.current_lng == null) {continue;}
      const driverUser = userMap.get(row.user_id);
      if (!driverUser) {continue;}
      if (vehicles.some((vehicle) => vehicle.plate === row.plate_number)) {continue;}
      vehicles.push({
        id: `driver-${row.user_id}`,
        name: str(driverUser.name),
        kind: "Tricycle driver",
        vehicleType: "Tricycle",
        plate: str(row.plate_number),
        routeId: row.routes_id ?? null,
        capacity: num(row.capacity, 3),
        location: {
          name: str(driverUser.name),
          latitude: num(row.current_lat),
          longitude: num(row.current_lng),
          updatedAt: row.location_updated_at
            ? Date.parse(row.location_updated_at)
            : Date.now(),
        },
        stale: !row.location_updated_at,
        status: "In transit",
      });
    }
  }

  const trips = ((bookingsResult.data ?? []) as any[]).map((row) =>
    mapTrip(row, userMap, driverMap),
  );
  const runs = ((runsResult.data ?? []) as any[]).map((row) =>
    mapRun(row, userMap),
  );

  const stopRequests = ((stopsResult.data ?? []) as any[]).map((row) => ({
    id: row.request_id,
    routeId: row.routes_id,
    point: row.point as Point,
    passenger: str(row.passenger),
    userId: row.user_id,
    createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
  }));

  const reports = ((reportsResult.data ?? []) as any[]).map((row) => ({
    id: row.report_id,
    details: str(row.details),
    tripId: row.booking_id ?? null,
    status: str(row.status) || "open",
    reporter: str(row.reporter),
    createdAt: row.created_at || new Date().toISOString(),
  }));

  const notifications = ((notificationsResult.data ?? []) as any[]).map(
    (row) => ({
      id: row.notification_id,
      message: str(row.message),
      createdAt: row.created_at || new Date().toISOString(),
      read: !!row.read,
    }),
  );

  const landmarks = ((landmarksResult.data ?? []) as any[]).map((row) => ({
    name: str(row.name),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
  }));

  const fare = ((faresResult.data ?? []) as any[]).find(
    (row) => row.routes_id == null,
  );

  return {
    user,
    users: [...userMap.values()].map((row) => mapUser(row, driverMap.get(row.user_id))),
    routes,
    terminals,
    vehicles,
    trips,
    runs,
    landmarks: landmarks.length ? landmarks : [FALLBACK],
    stopRequests,
    reports,
    notifications,
    logs: ((logsResult.data ?? []) as any[]).map((row) => ({
      id: num(row.log_id),
      action: str(row.event_type),
      at: row.created_at || new Date().toISOString(),
    })),
    baseFare: num(fare?.base_fare, 25),
    perKm: num(fare?.per_kilometer_rate, 8),
    fareApproved: true,
    sampleMode: false,
    fareReference: "Fare matrix",
    serverTime: Date.now(),
  };
}

/* ------------------------------------------------------------------ helpers */

async function namesFor(ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter(Boolean) as string[])];
  if (!wanted.length) {
    return {
      users: new Map<string, any>(),
      drivers: new Map<string, any>(),
    };
  }
  const [users, drivers] = await Promise.all([
    db().from("users").select(USER_COLUMNS).in("user_id", wanted),
    db().from("drivers").select(DRIVER_COLUMNS).in("user_id", wanted),
  ]);
  return {
    users: new Map((users.data ?? []).map((row: any) => [row.user_id, row])),
    drivers: new Map((drivers.data ?? []).map((row: any) => [row.user_id, row])),
  };
}

async function mapBookingRow(
  row: any,
  currentUserIdValue: string,
): Promise<Trip> {
  const maps = await namesFor([currentUserIdValue, row.driver_id]);
  return mapTrip(row, maps.users, maps.drivers);
}

/* ------------------------------------------------------------------ adapter */

export async function clearSession() {
  lastQuote = null;
  try {
    await db().auth.signOut();
  } catch {
    // Nothing to clear when Supabase is not configured yet.
  }
}

export async function api<T = { ok: boolean }>(
  endpoint: string,
  input?: unknown,
  method?: string,
): Promise<T> {
  const body = (input || {}) as Record<string, any>;
  const parts = endpoint.split("/");
  const client = db();
  let result: unknown = { ok: true };

  if (endpoint === "/logout") {
    await clearSession();
  } else if (endpoint === "/account/delete") {
    const { error } = await client.rpc("delete_my_account");
    raise(error);
    await clearSession();
  } else {
    const userId = await currentUserId();

    if (endpoint === "/state") {
      result = await loadSnapshot();
    } else if (endpoint === "/debug/pending-applications") {
      const { data, error } = await client.rpc("admin_users");
      raise(error);
      const items = ((data ?? []) as any[]).filter(
        (row) => row.application_status === "pending",
      );
      result = { count: items.length, items };
    } else if (endpoint.startsWith("/search")) {
      const query = decodeURIComponent(endpoint.split("q=")[1] || "").trim();
      const { data, error } = await client
        .from("landmarks")
        .select("*")
        .ilike("name", `%${query}%`)
        .limit(8);
      raise(error);
      result = (data ?? []).map((row: any) => ({
        name: row.name,
        latitude: num(row.latitude),
        longitude: num(row.longitude),
      }));
    } else if (endpoint === "/quote") {
      const pickup = body.pickup as Point;
      const destination = body.destination as Point;
      if (!pickup || !destination) {
        throw new ApiError("Choose both your pickup and destination.", 400);
      }
      const route = await directions(pickup, destination);
      const distance = Math.round(route.distanceKm * 10) / 10;
      const { data: fare, error } = await client.rpc("quote_fare", {
        p_distance_km: distance,
        p_class: "Tricycle",
      });
      raise(error);
      if (fare == null) {
        throw new ApiError("Tricycle fares are not set up yet.", 503);
      }
      const quote: Quote = {
        id: `quote-${Date.now()}`,
        pickup: pickup.name,
        destination: destination.name,
        pickupPoint: pickup,
        destinationPoint: destination,
        distance,
        fare: num(fare),
        minutes: route.minutes,
        geometry: route.geometry,
        fareReference: "Fare matrix",
        sampleFare: false,
        expires: Date.now() + 10 * 60 * 1000,
      };
      lastQuote = { quote, userId };
      result = quote;
    } else if (endpoint === "/book") {
      if (!lastQuote || lastQuote.userId !== userId || lastQuote.quote.id !== body.quoteId) {
        throw new ApiError("Preview a route first.", 400);
      }
      if (lastQuote.quote.expires <= Date.now()) {
        throw new ApiError(
          "This fare quote expired. Request a fresh quote.",
          400,
        );
      }
      const quote = lastQuote.quote;
      const { data, error } = await client
        .from("bookings")
        .insert({
          user_id: userId,
          pickup_latitude: quote.pickupPoint.latitude,
          pickup_longitude: quote.pickupPoint.longitude,
          dropoff_latitude: quote.destinationPoint.latitude,
          dropoff_longitude: quote.destinationPoint.longitude,
          pickup_name: quote.pickup,
          dropoff_name: quote.destination,
          service_type: "Tricycle",
          payment_method: body.demoMethod || "Cash",
          distance_km: quote.distance,
          duration_min: quote.minutes,
          route_polyline: quote.geometry,
          pickup_note: body.pickupNote || null,
        })
        .select()
        .single();
      raise(error);
      lastQuote = null;
      result = await mapBookingRow(data, userId);
    } else if (endpoint === "/book-puj") {
      const trip = body.trip as Trip;
      if (!trip) {throw new ApiError("No trip provided.", 400);}
      if (!body.routeId) {throw new ApiError("Choose a PUJ/PUV route.", 400);}
      const { data, error } = await client
        .from("bookings")
        .insert({
          user_id: userId,
          routes_id: body.routeId,
          pickup_latitude: trip.pickupPoint.latitude,
          pickup_longitude: trip.pickupPoint.longitude,
          dropoff_latitude: trip.destinationPoint.latitude,
          dropoff_longitude: trip.destinationPoint.longitude,
          pickup_name: trip.pickup,
          dropoff_name: trip.destination,
          service_type: "PUJ/PUV",
          payment_method: "Cash",
          distance_km: trip.distance,
          duration_min: trip.minutes,
          route_polyline: trip.geometry,
        })
        .select()
        .single();
      raise(error);
      result = await mapBookingRow(data, userId);
    } else if (parts[1] === "trips" && parts[3] === "rating") {
      const { error } = await client.rpc("rate_booking", {
        p_booking_id: parts[2],
        p_rating: num(body.rating, 5),
      });
      raise(error);
    } else if (parts[1] === "trips" && parts[3] === "decline") {
      const { error } = await client.rpc("release_booking", {
        p_booking_id: parts[2],
      });
      raise(error);
    } else if (parts[1] === "trips") {
      const status = str(body.status) || "Cancelled";
      const { error } = await client.rpc("transition_booking", {
        p_booking_id: parts[2],
        p_status: status,
      });
      raise(error);
    } else if (endpoint === "/profile/photo") {
      const photo =
        typeof body.photo === "string" && body.photo.startsWith("data:image/")
          ? body.photo
          : null;
      const { error } = await client
        .from("users")
        .update({ photo })
        .eq("user_id", userId);
      raise(error);
    } else if (endpoint === "/profile") {
      const { error } = await client
        .from("users")
        .update({
          name: str(body.name),
          phone: str(body.phone),
          contact_numbers: str(body.phone),
        })
        .eq("user_id", userId);
      raise(error);
    } else if (endpoint === "/availability") {
      const { error } = await client
        .from("drivers")
        .update({ availability_status: body.available ? "available" : "offline" })
        .eq("user_id", userId);
      raise(error);
    } else if (endpoint === "/notifications/read") {
      const { error } = await client
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId);
      raise(error);
    } else if (endpoint === "/report") {
      const me = await client
        .from("users")
        .select("name")
        .eq("user_id", userId)
        .maybeSingle();
      const { error } = await client.from("reports").insert({
        details: str(body.details),
        booking_id: body.tripId || null,
        status: "open",
        reporter: str(me.data?.name) || "Passenger",
        reporter_id: userId,
      });
      raise(error);
    } else if (parts[1] === "reports") {
      const { error } = await client
        .from("reports")
        .update({ status: str(body.status) })
        .eq("report_id", parts[2]);
      raise(error);
    } else if (endpoint === "/vehicles" && (method === "POST" || !method)) {
      const vehicleId =
        str(body.id) || `vehicle-${Date.now().toString(36)}`;
      const point = body.location || FALLBACK;
      const { data, error } = await client
        .from("vehicles")
        .upsert(
          {
            vehicle_id: vehicleId,
            name: str(body.name) || str(body.plate) || "Franchise vehicle",
            vehicle_type: body.vehicleType || "Jeepney",
            plate_number: str(body.plate),
            routes_id: body.routeId || null,
            capacity: num(body.capacity, 18),
            current_lat: point.latitude,
            current_lng: point.longitude,
            location_updated_at: new Date().toISOString(),
            status: body.status || "In Terminal",
            owner_id: userId,
            current_driver: str(body.currentDriver),
          },
          { onConflict: "vehicle_id" },
        )
        .select()
        .single();
      raise(error);
      result = mapVehicle(data);
    } else if (
      endpoint === "/vehicles/status" ||
      (parts[1] === "vehicles" && parts[3] === "status")
    ) {
      const vehicleId = str(body.id) || parts[2];
      const { error } = await client
        .from("vehicles")
        .update({ status: body.status })
        .eq("vehicle_id", vehicleId);
      raise(error);
      result = { ok: true };
    } else if (parts[1] === "vehicles") {
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) {patch.name = str(body.name);}
      if (body.plate !== undefined) {patch.plate_number = str(body.plate);}
      if (body.routeId !== undefined) {patch.routes_id = body.routeId || null;}
      if (body.capacity !== undefined) {patch.capacity = num(body.capacity, 18);}
      if (body.status !== undefined) {patch.status = body.status;}
      if (body.currentDriver !== undefined)
        {patch.current_driver = str(body.currentDriver);}
      if (body.vehicleType !== undefined) {patch.vehicle_type = body.vehicleType;}
      const { error } = await client
        .from("vehicles")
        .update(patch)
        .eq("vehicle_id", parts[2]);
      raise(error);
      result = { ok: true };
    } else if (parts[1] === "drivers") {
      const target = parts[2];
      const verified = body.verified;
      const applicationStatus = body.applicationStatus as
        | "pending"
        | "accepted"
        | "declined"
        | undefined;

      if (verified !== undefined || applicationStatus) {
        const userPatch: Record<string, unknown> = {};
        if (verified !== undefined) {
          userPatch.verified = !!verified;
          if (!applicationStatus) {
            userPatch.application_status = verified ? "accepted" : "pending";
          }
        }
        if (applicationStatus) {
          userPatch.application_status = applicationStatus;
          if (applicationStatus === "accepted") {userPatch.verified = true;}
          if (applicationStatus === "declined") {userPatch.verified = false;}
        }
        const { error } = await client
          .from("users")
          .update(userPatch)
          .eq("user_id", target);
        raise(error);
      }
      const patch: Record<string, unknown> = {};
      if (verified !== undefined) {patch.verified = !!verified;}
      if (body.routeId !== undefined) {patch.routes_id = body.routeId || null;}
      if (body.association !== undefined) {patch.association = str(body.association);}
      if (Object.keys(patch).length) {
        const { error } = await client
          .from("drivers")
          .update(patch)
          .eq("user_id", target);
        raise(error);
      }
    } else if (endpoint === "/configure") {
      if (body.type === "route") {
        const routeRow = {
          routes_id: str(body.id) || `route-${Date.now().toString(36)}`,
          route_name: str(body.name),
          transport_type: body.transportType || "PUJ / PUV",
          destination: str(body.destination),
          stops: body.stops || [],
          fare: num(body.fare),
          scheduled: body.scheduled ?? false,
          approved: !!body.approved,
          active: body.active ?? true,
          reference: str(body.reference) || "Admin configured",
          interval_minutes: num(body.interval, 15),
          starts_at: body.startsAt || "06:00",
          ends_at: body.endsAt || "20:00",
        };
        const { data, error } = await client
          .from("routes")
          .upsert(routeRow, { onConflict: "routes_id" })
          .select()
          .single();
        raise(error);
        result = { ok: true, route: mapRoute(data) };
      } else if (body.type === "terminal") {
        const point = body.point || FALLBACK;
        const { data, error } = await client
          .from("terminals")
          .upsert(
            {
              terminal_id: str(body.id) || `terminal-${Date.now().toString(36)}`,
              station_name: str(body.name),
              routes_id: body.routeId || null,
              latitude: point.latitude,
              longitude: point.longitude,
              active: body.active ?? true,
            },
            { onConflict: "terminal_id" },
          )
          .select()
          .single();
        raise(error);
        result = {
          ok: true,
          terminal: {
            id: data.terminal_id,
            name: data.station_name,
            point,
            routeId: data.routes_id,
            active: !!data.active,
          },
        };
      } else if (body.type === "fare") {
        const baseFare = num(body.baseFare);
        const perKm = num(body.perKm);
        if (baseFare <= 0 || perKm <= 0) {
          throw new ApiError("Base fare and per-kilometre rate must be greater than zero.", 400);
        }
        const { error } = await client
          .from("fare_matrices")
          .update({ base_fare: baseFare, per_kilometer_rate: perKm })
          .eq("vehicle_classification", "Tricycle")
          .is("routes_id", null);
        raise(error);
        result = { ok: true };
      } else if (body.type === "toggle") {
        const table = body.collection === "terminals" ? "terminals" : "routes";
        const key = table === "terminals" ? "terminal_id" : "routes_id";
        const { error } = await client
          .from(table)
          .update({ active: !!body.active })
          .eq(key, body.id);
        raise(error);
      }
      // Legacy fare config (baseFare/perKm) is ignored: fares live in fare_matrices.
    } else if (endpoint === "/stop") {
      const { error } = await client.from("stop_requests").insert({
        routes_id: body.routeId,
        point: body.point,
        passenger: str(body.passenger) || "Passenger",
        user_id: userId,
      });
      raise(error);
    } else if (parts[1] === "stops" && method === "DELETE") {
      const { error } = await client
        .from("stop_requests")
        .delete()
        .eq("request_id", parts[2]);
      raise(error);
    } else if (endpoint === "/runs") {
      const me = await client
        .from("drivers")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      const routeId = me.data?.routes_id;
      const routeResult = routeId
        ? await client.from("routes").select("*").eq("routes_id", routeId).maybeSingle()
        : await client.from("routes").select("*").limit(1).maybeSingle();
      raise(routeResult.error);
      const route = routeResult.data;
      if (!route) {throw new ApiError("No route is configured yet.", 400);}
      const profile = await client
        .from("users")
        .select("name")
        .eq("user_id", userId)
        .maybeSingle();
      const boarded = num(body.boarded);
      const fare = num(route.fare);
      const stops = Array.isArray(route.stops) ? route.stops : [];
      const { data, error } = await client
        .from("driver_runs")
        .insert({
          driver_id: userId,
          routes_id: route.routes_id,
          route_name: route.route_name,
          plate: str(me.data?.plate_number),
          capacity: num(me.data?.capacity, 18),
          fare,
          reference: str(route.reference) || "Fare matrix",
          status: "In progress",
          stop_index: 0,
          onboard: boarded,
          total_boarded: boarded,
          cash_fares: boarded * fare,
          revision: 1,
          stops,
        })
        .select()
        .single();
      raise(error);

      let events: any[] = [];
      if (boarded > 0) {
        const { data: eventRow } = await client
          .from("driver_run_events")
          .insert({
            run_id: data.run_id,
            stop: str(stops[0]?.name) || "Terminal",
            boarded,
            alighted: 0,
            onboard: boarded,
            type: "departure",
          })
          .select()
          .single();
        events = eventRow ? [eventRow] : [];
      }
      result = mapRun(
        { ...data, driver_run_events: events },
        new Map([[userId, profile.data ?? {}]]),
      );
    } else if (parts[1] === "runs") {
      const { data: run, error: runError } = await client
        .from("driver_runs")
        .select("*")
        .eq("run_id", parts[2])
        .maybeSingle();
      raise(runError);
      if (!run) {throw new ApiError("Trip record not found.", 404);}

      const stops = Array.isArray(run.stops) ? run.stops : [];
      const fare = num(run.fare);
      if (body.action === "complete" || body.status === "Completed") {
        const { error } = await client
          .from("driver_runs")
          .update({
            status: "Completed",
            ended_at: new Date().toISOString(),
            stop_index: Math.max(0, stops.length - 1),
            onboard: 0,
            cash_fares: num(run.total_boarded) * fare,
            revision: num(run.revision, 1) + 1,
          })
          .eq("run_id", run.run_id);
        raise(error);
        const { error: eventError } = await client
          .from("driver_run_events")
          .insert({
            run_id: run.run_id,
            stop: str(stops[stops.length - 1]?.name) || "Final stop",
            boarded: 0,
            alighted: num(run.total_boarded),
            onboard: 0,
            type: "complete",
          });
        raise(eventError);
      } else {
        const index = num(run.stop_index);
        const onboard = Math.max(
          0,
          num(run.onboard) + num(body.boarded) - num(body.alighted),
        );
        const totalBoarded = num(run.total_boarded) + num(body.boarded);
        const { error } = await client
          .from("driver_runs")
          .update({
            onboard,
            total_boarded: totalBoarded,
            cash_fares: totalBoarded * fare,
            stop_index: Math.min(index + 1, Math.max(0, stops.length - 1)),
            revision: num(run.revision, 1) + 1,
          })
          .eq("run_id", run.run_id);
        raise(error);
        const { error: eventError } = await client
          .from("driver_run_events")
          .insert({
            run_id: run.run_id,
            stop: str(stops[index]?.name) || "Stop",
            boarded: num(body.boarded),
            alighted: num(body.alighted),
            onboard,
            type: "stop",
          });
        raise(eventError);
      }

      const { data: fresh } = await client
        .from("driver_runs")
        .select("*, driver_run_events(*)")
        .eq("run_id", run.run_id)
        .maybeSingle();
      const profile = await client
        .from("users")
        .select("name")
        .eq("user_id", userId)
        .maybeSingle();
      result = mapRun(fresh ?? run, new Map([[userId, profile.data ?? {}]]));
    }
  }

  return structuredClone(result) as T;
}
