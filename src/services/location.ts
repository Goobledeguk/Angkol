import * as Location from "expo-location";
import { db } from "./supabase";
import { DEFAULT_CENTER, distanceKm, reverseGeocode } from "./mapbox";
import type { Point } from "../types/types";

let sharingRequest = 0;
let activeWatcher: { subscription?: Location.LocationSubscription } | null =
  null;
const MIN_WRITE_INTERVAL_MS = 5000;
const STATIONARY_INTERVAL_MS = 30000;
const MIN_MOVEMENT_METERS = 10;

export const SERVICE_RADIUS_KM = 30;

export function insideServiceArea(point: { latitude: number; longitude: number }) {
  return distanceKm({ name: "", ...DEFAULT_CENTER }, { name: "", ...point }) <= SERVICE_RADIUS_KM;
}

export async function currentPoint(): Promise<Point> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error(
      "Location access is off. Allow it in Settings, or pick your pickup on the map.",
    );
  }
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  const { latitude, longitude } = position.coords;
  if (!insideServiceArea({ latitude, longitude })) {
    throw new Error(
      "You seem to be outside Calbayog City. Pick your pickup on the map instead.",
    );
  }
  let name = "";
  try {
    name = await reverseGeocode(latitude, longitude);
  } catch {
    name = "";
  }
  return { name: name || "My current location", latitude, longitude };
}

export function isSharing() {
  return activeWatcher?.subscription !== undefined;
}

export async function resumeSharing(driverId: string): Promise<boolean> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    return false;
  }
  await startSharing(driverId);
  return true;
}

export async function startSharing(driverId: string) {
  const request = ++sharingRequest;
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Location permission is required to share your position.");
  }
  if (request !== sharingRequest) {
    return;
  }
  activeWatcher?.subscription?.remove();
  const watcher: NonNullable<typeof activeWatcher> = {};
  activeWatcher = watcher;

  const client = db();
  const { data: vehicle } = await client
    .from("vehicles")
    .select("vehicle_id")
    .eq("driver_id", driverId)
    .order("vehicle_id")
    .limit(1)
    .maybeSingle();
  if (activeWatcher !== watcher) {
    return;
  }

  let lastWrite: { point: Point; time: number } | undefined;
  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: MIN_WRITE_INTERVAL_MS,
      distanceInterval: MIN_MOVEMENT_METERS,
    },
    (position) => {
      if (activeWatcher !== watcher) {
        return;
      }
      const { latitude, longitude } = position.coords;
      const point = { name: "", latitude, longitude };
      const time = Date.now();
      if (lastWrite) {
        const elapsed = time - lastWrite.time;
        if (elapsed < MIN_WRITE_INTERVAL_MS) {
          return;
        }
        if (
          elapsed < STATIONARY_INTERVAL_MS &&
          distanceKm(lastWrite.point, point) * 1000 < MIN_MOVEMENT_METERS
        ) {
          return;
        }
      }
      lastWrite = { point, time };
      const now = new Date(time).toISOString();
      void client
        .from("drivers")
        .update({
          current_lat: latitude,
          current_lng: longitude,
          location_updated_at: now,
        })
        .eq("user_id", driverId)
        .then(() => undefined);
      void client
        .from("vehicles")
        .update({
          current_lat: latitude,
          current_lng: longitude,
          location_updated_at: now,
        })
        .eq("driver_id", driverId)
        .then(() => undefined);
      void client
        .from("vehicle_locations")
        .insert({
          driver_id: driverId,
          ...(vehicle ? { vehicle_id: vehicle.vehicle_id } : {}),
          latitude,
          longitude,
        })
        .then(() => undefined);
    },
  );
  if (activeWatcher === watcher) {
    watcher.subscription = subscription;
  } else {
    subscription.remove();
  }
}

export async function stopSharing() {
  sharingRequest++;
  activeWatcher?.subscription?.remove();
  activeWatcher = null;
}
