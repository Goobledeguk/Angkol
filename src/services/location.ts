import * as Location from "expo-location";
import { db } from "./supabase";

let subscription: Location.LocationSubscription | null = null;

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
