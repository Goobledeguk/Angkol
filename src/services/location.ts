import * as Location from "expo-location";
import { db } from "./supabase";
import { DEFAULT_CENTER, distanceKm, reverseGeocode } from "./mapbox";
import type { Point } from "../types/types";

let subscription: Location.LocationSubscription | null = null;

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
  return subscription !== null;
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
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Location permission is required to share your position.");
  }
  await stopSharing();
  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
    },
    (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const now = new Date().toISOString();
      void db()
        .from("drivers")
        .update({
          current_lat: latitude,
          current_lng: longitude,
          location_updated_at: now,
        })
        .eq("user_id", driverId)
        .then(() => undefined);
      void db()
        .from("vehicles")
        .update({ current_lat: latitude, current_lng: longitude, location_updated_at: now })
        .eq("driver_id", driverId)
        .then(() => undefined);
      void db()
        .from("vehicle_locations")
        .insert({ driver_id: driverId, latitude, longitude })
        .then(() => undefined);
    },
  );
}

export async function stopSharing() {
  subscription?.remove();
  subscription = null;
}
