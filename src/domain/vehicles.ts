import type { Vehicle } from "../types/types";

export const STALE_AFTER_MS = 5 * 60 * 1000;

export function driverVehicleId(driverId: string) {
  return `driver-${driverId}`;
}

export function vehicleForDriver(
  vehicles: Vehicle[],
  driverId: string | null | undefined,
  plate?: string,
): Vehicle | undefined {
  if (!driverId) {
    return undefined;
  }
  return (
    vehicles.find((v) => v.id === driverVehicleId(driverId)) ||
    vehicles.find((v) => v.id === driverId) ||
    (plate ? vehicles.find((v) => v.plate === plate) : undefined)
  );
}

export function isStale(updatedAt: number, now: number) {
  return !updatedAt || now - updatedAt > STALE_AFTER_MS;
}

export function lastSeen(updatedAt: number, now: number) {
  if (!updatedAt) {
    return "No location yet";
  }
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (seconds < 45) {
    return "Just now";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : "Over a day ago";
}

export function tripRef(id: string) {
  const compact = id.replace(/[^a-zA-Z0-9]/g, "");
  return `#${compact.slice(0, 8).toUpperCase()}`;
}
