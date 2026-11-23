import { db } from "./supabase";
import { directions, searchPlaces } from "./mapbox";
import { isDriverRole } from "../domain/roles";
import { inServiceArea } from "../domain/serviceArea";
import { driverVehicleId, isStale } from "../domain/vehicles";
import {
  FALLBACK,
  linkNotifications,
  mapLocation,
  mapRoute,
  mapRun,
  mapTrip,
  mapUser,
  mapVehicle,
  num,
  str,
} from "./mappers";
import type { DriverRun, Point, Quote, Snapshot, Trip } from "../types/types";

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

let lastQuote: { quote: Quote; userId: string } | null = null;

const USER_COLUMNS =
  "user_id,name,phone,contact_numbers,photo,assigned_roles,admin_level,franchise_name,verified,application_status,created_at";
const DRIVER_COLUMNS =
  "driver_id,user_id,operational_classification,availability_status,association,plate_number,capacity,franchise_name,routes_id,verified,current_lat,current_lng,location_updated_at";
const BOOKING_COLUMNS = "*, trip_records(payment_status)";
const NOTIFICATION_COLUMNS = "notification_id,message,created_at,read,booking_id";
const ADMIN_ROLES = ["Administrator", "Vehicle Owner / Operator"];
const MAX_PHOTO_URL_LENGTH = 1_500_000;
const TRICYCLE_FARE_ID = "a34fd128-1707-4dc4-bb11-aedf9782c494";

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

const CONFLICTS: Record<string, string> = {
  bookings_one_active_per_passenger: "You already have an active ride.",
  bookings_one_active_per_driver: "Finish your current ride before accepting another.",
  driver_runs_one_active_per_driver: "Finish your current run before starting another.",
};

function raise(error: { message: string; code?: string } | null) {
  if (error) {
    const conflict =
      error.code === "23505"
        ? Object.entries(CONFLICTS).find(([name]) => error.message.includes(name))?.[1]
        : undefined;
    throw new ApiError(
      conflict ?? error.message,
      error.code === "40001" || conflict ? 409 : 400,
    );
  }
}

function requireServiceArea(pickup?: Point, destination?: Point) {
  if (
    !pickup ||
    !destination ||
    !inServiceArea(pickup) ||
    !inServiceArea(destination)
  ) {
    throw new ApiError("Angkol only operates within Calbayog City.", 400);
  }
}

function passengerCount(value: unknown) {
  if (value === undefined) {
    return 0;
  }
  const count = typeof value === "string" ? Number(value) : value;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
    throw new ApiError("Passenger counts must be non-negative whole numbers.", 400);
  }
  return count;
}

/* ------------------------------------------------------------------ snapshot */

async function loadNotifications(client: ReturnType<typeof db>, userId: string) {
  const select = (columns: string) =>
    client
      .from("notifications")
      .select(columns)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

  const result = await select(NOTIFICATION_COLUMNS);
  const { error } = result;
  if (
    error &&
    (error.code === "42703" ||
      error.code === "PGRST204" ||
      /booking_id.*does not exist|could not find.*booking_id.*column/i.test(error.message))
  ) {
    return select("*");
  }
  return result;
}

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
      .select(BOOKING_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(80),
    client
      .from("driver_runs")
      .select("*, driver_run_events(*)")
      .order("started_at", { ascending: false })
      .limit(40),
    client.from("stop_requests").select("*").order("created_at"),
    client.from("reports").select("*").order("created_at", { ascending: false }),
    loadNotifications(client, userId),
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
  raise(routesResult.error);
  raise(terminalsResult.error);
  raise(vehiclesResult.error);
  raise(bookingsResult.error);

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

  const trips = ((bookingsResult.data ?? []) as any[]).map((row) =>
    mapTrip(row, userMap, driverMap),
  );
  const activeRuns = new Map<string, DriverRun>();
  const runs = ((runsResult.data ?? []) as any[]).map((row) => {
    const run = mapRun(row, userMap);
    if (row.status === "In progress") {
      activeRuns.set(run.driverId, run);
    }
    return run;
  });
  const fleet = vehiclesResult.data ?? [];
  const vehicles: Snapshot["vehicles"] = (user.role === "Passenger"
    ? fleet.filter(
        (row) =>
          row.active &&
          row.status !== "Decommissioned" &&
          row.status !== "Broken / Inactive",
      )
    : fleet
  ).map((row) => {
    const vehicle = mapVehicle(row);
    const run = activeRuns.get(row.driver_id);
    if (vehicle.vehicleType === "Tricycle") {
      // A registered tricycle is out working when its driver is online.
      const driverRow = driverMap.get(row.driver_id);
      return {
        ...vehicle,
        online: driverRow?.availability_status === "available" && !vehicle.stale,
        onRun: false,
        runId: null,
        nextStop: null,
      };
    }
    // RLS hides other drivers' runs from passengers, so use the fleet status there.
    const onRun =
      vehicle.status !== "In Terminal" &&
      (!!run || (user.role === "Passenger" && vehicle.status === "In transit"));
    return {
      ...vehicle,
      onRun,
      runId: onRun ? run?.id ?? null : null,
      nextStop: onRun ? run?.stops[run.stopIndex + 1]?.name ?? null : null,
    };
  });
  if (user.role === "Passenger") {
    const assignedTrip = trips.find(
      (trip) =>
        trip.passengerId === userId &&
        (trip.status === "Accepted" || trip.status === "Arrived" || trip.status === "In progress"),
    );
    const now = Date.now();
    const registeredPlates = new Set(fleet.map((row) => str(row.plate_number)));
    for (const row of drivers) {
      const driverUser = userMap.get(row.user_id);
      if (!driverUser || (row.operational_classification ?? "Tricycle") !== "Tricycle") {
        continue;
      }
      const name = str(driverUser.name);
      const location = mapLocation(row, name);
      if (!location) {
        continue;
      }
      const assigned = row.user_id === assignedTrip?.driverId;
      const online = row.availability_status === "available";
      const stale = isStale(location.updatedAt, now);
      const plate = str(row.plate_number);
      if (!assigned && (!online || stale || (plate && registeredPlates.has(plate)))) {
        continue;
      }
      if (plate) {
        registeredPlates.add(plate);
      }
      vehicles.push({
        id: driverVehicleId(row.user_id),
        name,
        kind: "Tricycle driver",
        vehicleType: "Tricycle",
        plate,
        routeId: row.routes_id ?? null,
        capacity: num(row.capacity, 3),
        location,
        online,
        stale,
        status: "In transit",
      });
    }
  }

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
      tripId: row.booking_id ?? null,
    }),
  );

  const landmarks = ((landmarksResult.data ?? []) as any[]).map((row) => ({
    name: str(row.name),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
  }));

  const tricycleFares = (faresResult.data ?? []).filter(
    (row) => row.routes_id == null && row.vehicle_classification === "Tricycle",
  );
  const fare =
    tricycleFares.find((row) => row.tariff_tier === "REGULAR") ?? tricycleFares[0];

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
    notifications: linkNotifications(
      notifications,
      trips.filter((trip) => trip.passengerId === userId || trip.driverId === userId),
    ),
    logs: ((logsResult.data ?? []) as any[]).map((row) => ({
      id: num(row.log_id),
      action: str(row.event_type),
      at: row.created_at || new Date().toISOString(),
    })),
    baseFare: num(fare?.base_fare),
    perKm: num(fare?.per_kilometer_rate),
    fareApproved: !!fare,
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
  const searchQuery = endpoint.startsWith("/search")
    ? decodeURIComponent(endpoint.split("q=")[1] || "").trim()
    : null;
  if (searchQuery !== null && searchQuery.length < 2) {
    return [] as T;
  }
  const bookingQuote = endpoint === "/book" ? lastQuote : null;
  if (endpoint === "/quote") {
    if (!body.pickup || !body.destination) {
      throw new ApiError("Choose both your pickup and destination.", 400);
    }
    requireServiceArea(body.pickup, body.destination);
  } else if (bookingQuote && bookingQuote.quote.id === body.quoteId) {
    requireServiceArea(
      bookingQuote.quote.pickupPoint,
      bookingQuote.quote.destinationPoint,
    );
  } else if (endpoint === "/book-puj") {
    if (!body.trip) {
      throw new ApiError("No trip provided.", 400);
    }
    if (!body.routeId) {
      throw new ApiError("Choose a PUJ/PUV route.", 400);
    }
    requireServiceArea(body.trip.pickupPoint, body.trip.destinationPoint);
  }
  const client = db();
  let result: unknown = { ok: true };

  if (endpoint === "/logout") {
    await clearSession();
  } else if (endpoint === "/account/delete") {
    const userId = await currentUserId();
    const { data: profile, error: profileError } =
      await client.rpc("my_profile");
    raise(profileError);
    if (isDriverRole(profile?.user?.assigned_roles?.[0])) {
      const { error: storageError } = await client.storage
        .from("driver-documents")
        .remove([`license/${userId}.jpg`]);
      if (storageError?.status !== 404 && storageError?.statusCode !== "404") {
        raise(storageError);
      }
    }
    const { error } = await client.rpc("delete_my_account");
    raise(error);
    await clearSession();
  } else if (
    parts[1] === "documents" &&
    parts[2] === "license" &&
    parts[3] &&
    parts.length === 4 &&
    (!method || method === "GET")
  ) {
    const { data, error } = await client.storage
      .from("driver-documents")
      .createSignedUrl(`license/${parts[3]}.jpg`, 600);
    result = { url: error ? null : (data?.signedUrl ?? null) };
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
    } else if (searchQuery !== null) {
      const pattern = searchQuery.replace(/[\\%_*]/g, "\\$&");
      const [{ data, error }, places] = await Promise.all([
        client
          .from("landmarks")
          .select("*")
          .ilike("name", `%${pattern}%`)
          .limit(8),
        searchPlaces(searchQuery).catch((): Point[] => []),
      ]);
      raise(error);
      const landmarks: Point[] = (data ?? []).map((row: any) => ({
        name: row.name,
        latitude: num(row.latitude),
        longitude: num(row.longitude),
      }));
      const matches = new Map<string, Point>();
      for (const point of [...landmarks, ...places]) {
        const name = point.name.toLowerCase();
        if (!matches.has(name)) {
          matches.set(name, point);
        }
        if (matches.size === 8) {
          break;
        }
      }
      result = [...matches.values()];
    } else if (endpoint === "/quote") {
      const pickup = body.pickup as Point;
      const destination = body.destination as Point;
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
      if (
        !bookingQuote ||
        bookingQuote !== lastQuote ||
        bookingQuote.userId !== userId ||
        bookingQuote.quote.id !== body.quoteId
      ) {
        throw new ApiError("Preview a route first.", 400);
      }
      if (bookingQuote.quote.expires <= Date.now()) {
        throw new ApiError(
          "This fare quote expired. Request a fresh quote.",
          400,
        );
      }
      const quote = bookingQuote.quote;
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
      if (lastQuote === bookingQuote) {
        lastQuote = null;
      }
      result = await mapBookingRow(data, userId);
    } else if (endpoint === "/book-puj") {
      const trip = body.trip as Trip;
      const distance = Math.min(100, Math.max(0.1, num(trip.distance)));
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
          distance_km: Math.round(distance * 10) / 10,
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
      const photo: unknown = body.photo;
      if (photo !== null) {
        if (typeof photo !== "string") {
          throw new ApiError("Choose an image to use as your profile photo.", 400);
        }
        if (photo.length > MAX_PHOTO_URL_LENGTH) {
          throw new ApiError("Choose a profile photo under 1.5 MB.", 400);
        }
        if (!/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/]+={0,2}$/i.test(photo)) {
          throw new ApiError("Choose an image to use as your profile photo.", 400);
        }
      }
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
      const { status } = body;
      const { error } = await client
        .from("vehicles")
        .update({
          status,
          active: status === undefined ? undefined : status !== "Decommissioned",
        })
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
      if (body.status === "Decommissioned") {
        patch.active = false;
      } else if (typeof body.active === "boolean") {
        patch.active = body.active;
      }
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
      const patch: Record<string, unknown> = {};
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
        const { data, error } = await client
          .from("users")
          .update(userPatch)
          .eq("user_id", target)
          .select("verified")
          .maybeSingle();
        raise(error);
        if (!data) {throw new ApiError("Driver profile not found.", 404);}
        patch.verified = data.verified;
      }
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
        const rates = { base_fare: baseFare, per_kilometer_rate: perKm };
        const { data: updated, error } = await client
          .from("fare_matrices")
          .update(rates)
          .eq("vehicle_classification", "Tricycle")
          .is("routes_id", null)
          .eq("active", true)
          .select("fare_id");
        raise(error);
        if (!updated?.length) {
          const { data: saved, error: saveError } = await client
            .from("fare_matrices")
            .upsert(
              {
                ...rates,
                fare_id: TRICYCLE_FARE_ID,
                vehicle_classification: "Tricycle",
                routes_id: null,
                tariff_tier: "REGULAR",
                active: true,
              },
              { onConflict: "fare_id" },
            )
            .select("fare_id")
            .maybeSingle();
          raise(saveError);
          if (!saved) {
            throw new ApiError("The tricycle fare could not be saved.", 400);
          }
        }
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
      const boarded = passengerCount(body.boarded);
      const me = await client
        .from("drivers")
        .select("capacity")
        .eq("user_id", userId)
        .maybeSingle();
      raise(me.error);
      if (me.data && boarded > num(me.data.capacity, 18)) {
        throw new ApiError("Boarding would exceed the vehicle's capacity.", 400);
      }
      const { data, error } = await client.rpc("start_run", {
        p_boarded: boarded,
      });
      raise(error);
      const profile = await client
        .from("users")
        .select("name")
        .eq("user_id", userId)
        .maybeSingle();
      result = mapRun(data, new Map([[userId, profile.data ?? {}]]));
    } else if (parts[1] === "runs") {
      const { data: run, error: runError } = await client
        .from("driver_runs")
        .select("*")
        .eq("run_id", parts[2])
        .maybeSingle();
      raise(runError);
      if (!run) {throw new ApiError("Trip record not found.", 404);}
      if (run.driver_id !== userId) {
        throw new ApiError("Only the assigned driver can update this run.", 403);
      }
      if (run.status === "Completed") {
        throw new ApiError("This run is already completed.", 400);
      }

      const revision = num(run.revision, 1);
      const conflict =
        "This run changed. Refresh it before making another update.";
      if (body.revision !== undefined && num(body.revision) !== revision) {
        throw new ApiError(conflict, 409);
      }
      const complete = body.action === "complete" || body.status === "Completed";
      const previousOnboard = num(run.onboard);
      const boarded = complete ? 0 : passengerCount(body.boarded);
      const alighted = complete ? previousOnboard : passengerCount(body.alighted);
      if (!complete && alighted > previousOnboard) {
        throw new ApiError(
          "More passengers cannot get off than are on board.",
          400,
        );
      }
      if (
        !complete &&
        previousOnboard - alighted + boarded > num(run.capacity, 18)
      ) {
        throw new ApiError("Boarding would exceed the vehicle's capacity.", 400);
      }
      const { data, error } = await client.rpc("advance_run", {
        p_run_id: run.run_id,
        p_revision: revision,
        p_boarded: boarded,
        p_alighted: alighted,
        p_complete: complete,
      });
      raise(error);
      const profile = await client
        .from("users")
        .select("name")
        .eq("user_id", userId)
        .maybeSingle();
      result = mapRun(data, new Map([[userId, profile.data ?? {}]]));
    }
  }

  return structuredClone(result) as T;
}
