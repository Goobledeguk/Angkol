import type { Role, Snapshot, Status, Trip } from "../types/types";

export const ADMIN_ROLES: Role[] = ["Administrator", "Vehicle Owner / Operator"];
export const DRIVER_ROLES: Role[] = ["Tricycle driver", "PUJ / PUV driver"];
export const FINISHED: Status[] = ["Completed", "Cancelled"];
export const LIVE: Status[] = ["Accepted", "Arrived", "In progress"];

export const isAdminRole = (role: Role) => ADMIN_ROLES.includes(role);
export const isDriverRole = (role: Role) => DRIVER_ROLES.includes(role);
export const isPujRole = (role: Role) => role === "PUJ / PUV driver";

export const isFinished = (trip: Pick<Trip, "status">) => FINISHED.includes(trip.status);

export function activeTripFor(data: Pick<Snapshot, "trips" | "user">): Trip | undefined {
  const mine = (trip: Trip) =>
    trip.passengerId === data.user.id || trip.driverId === data.user.id;
  return data.trips.find((trip) => mine(trip) && !isFinished(trip));
}

export function hasLiveTrip(data: Pick<Snapshot, "trips" | "user">) {
  const trip = activeTripFor(data);
  return !!trip && LIVE.includes(trip.status);
}
