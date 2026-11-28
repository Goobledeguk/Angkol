import type {
  DriverRun,
  Point,
  Role,
  Route,
  Snapshot,
  Trip,
  User,
  Vehicle,
} from "../types/types";
import { isStale } from "../domain/vehicles";

export const FALLBACK: Point = {
  name: "Calbayog City Hall",
  latitude: 12.0676,
  longitude: 124.5942,
};

export const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
export const str = (value: unknown) => (value == null ? "" : String(value));
export const shortTime = (value: unknown, fallback: string) => {
  const text = str(value);
  return /^\d{2}:\d{2}/.test(text) ? text.slice(0, 5) : fallback;
};

export function mapLocation(row: any, name: string) {
  if (row?.current_lat == null || row?.current_lng == null) {
    return null;
  }
  const latitude = num(row.current_lat, NaN);
  const longitude = num(row.current_lng, NaN);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return {
    name,
    latitude,
    longitude,
    updatedAt: Date.parse(row.location_updated_at) || 0,
  };
}

export function mapUser(row: any, driver?: any): User {
  const role = (row.assigned_roles?.[0] ?? "Passenger") as Role;
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
    location: mapLocation(driver, "Current location"),
  };
}

export function mapRoute(row: any): Route {
  const stops = Array.isArray(row.stops) ? row.stops : [];
  const polyline = row.route_polyline?.coordinates;
  const geometry: Route["geometry"] =
    Array.isArray(polyline) && polyline.length >= 2
      ? { type: "LineString", coordinates: polyline }
      : stops.length >= 2
        ? {
            type: "LineString",
            coordinates: stops.map((stop: any) => [num(stop.longitude), num(stop.latitude)]),
          }
        : undefined;
  return {
    id: row.routes_id,
    name: str(row.route_name),
    stops,
    ...(geometry ? { geometry } : {}),
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

export function mapVehicle(row: any): Vehicle {
  const name = str(row.name) || str(row.plate_number);
  const location = mapLocation(row, name || FALLBACK.name) ?? {
    ...FALLBACK,
    name: name || FALLBACK.name,
    updatedAt: 0,
  };
  return {
    id: row.vehicle_id,
    name,
    kind: "PUJ / PUV driver",
    vehicleType: row.vehicle_type || "Jeepney",
    plate: str(row.plate_number),
    routeId: row.routes_id ?? null,
    capacity: num(row.capacity, 18),
    location,
    stale: isStale(location.updatedAt, Date.now()),
    status: row.status ?? "In Terminal",
    ownerId: row.owner_id ?? undefined,
    currentDriver: str(row.current_driver) || undefined,
  };
}

export function mapTrip(
  booking: any,
  users: Map<string, any>,
  drivers: Map<string, any>,
): Trip {
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
  const driverUser = booking.driver_id
    ? users.get(booking.driver_id)
    : undefined;
  const driverRecord = booking.driver_id
    ? drivers.get(booking.driver_id)
    : undefined;
  const coords = booking.route_polyline?.coordinates;
  const created = booking.created_at
    ? Date.parse(booking.created_at)
    : Date.now();
  const paymentStatus = booking.trip_records?.payment_status;

  return {
    id: booking.booking_id,
    serviceType: booking.service_type ?? "Tricycle",
    routeId: booking.routes_id ?? null,
    vehicleId: booking.vehicle_id ?? undefined,
    paymentStatus:
      paymentStatus === "unpaid" ||
      paymentStatus === "pending" ||
      paymentStatus === "paid"
        ? paymentStatus
        : undefined,
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
    plate:
      str(booking.driver_plate) || str(driverRecord?.plate_number) || undefined,
    status: booking.request_status,
    createdAt: booking.created_at || new Date().toISOString(),
    timestamps: booking.timestamps || {},
    rating: booking.rating ?? null,
    pickupNote: booking.pickup_note || undefined,
  };
}

/** The booking trigger's messages (see notify_booking_change). */
const RIDE_MESSAGE =
  /ride request|driver|trip (has started|completed)|seat|ride was cancelled|accepted your ride/i;

export function linkNotifications(
  notifications: Snapshot["notifications"],
  trips: readonly Pick<Trip, "id" | "createdAt" | "timestamps">[],
): Snapshot["notifications"] {
  return notifications.map((notification) => {
    if (notification.tripId != null) {
      return notification;
    }

    // Only messages written by the booking trigger are about a ride.
    if (!RIDE_MESSAGE.test(notification.message)) {
      return { ...notification, tripId: null };
    }
    const createdAt = Date.parse(notification.createdAt);
    let closest = Infinity;
    let tripId: string | null = null;
    let ties = 0;
    for (const trip of trips) {
      const timestamps = [Date.parse(trip.createdAt), ...Object.values(trip.timestamps)];
      for (const timestamp of timestamps) {
        const distance = Math.abs(createdAt - timestamp);
        if (distance <= 10_000 && distance < closest) {
          closest = distance;
          tripId = trip.id;
          ties = 0;
        } else if (distance === closest && tripId !== trip.id) {
          ties++;
        }
      }
    }

    // Two rides changing in the same instant cannot be told apart; leave it unlinked.
    return { ...notification, tripId: ties ? null : tripId };
  });
}

export function mapRun(row: any, users: Map<string, any>): DriverRun {
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
