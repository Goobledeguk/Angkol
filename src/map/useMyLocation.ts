import { useEffect, useState } from "react";
import * as Location from "expo-location";
import type { Point } from "../types/types";

/**
 * The phone's position for the "you are here" marker. Never prompts: it only
 * reads location when the person already allowed it (for example after
 * tapping "Use my location"), and follows them while the screen is open.
 */
export function useMyLocation(enabled = true, refreshKey = 0): Point | null {
  const [me, setMe] = useState<Point | null>(null);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    void (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (cancelled || permission.status !== "granted") {
          return;
        }
        const last = await Location.getLastKnownPositionAsync();
        if (!cancelled && last) {
          setMe({ name: "You", latitude: last.coords.latitude, longitude: last.coords.longitude });
        }
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 10000 },
          (position) => {
            if (!cancelled) {
              setMe({ name: "You", latitude: position.coords.latitude, longitude: position.coords.longitude });
            }
          },
        );
        if (cancelled) {
          subscription.remove();
        }
      } catch {
        // No location is fine: the map still works without the marker.
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, refreshKey]);
  return me;
}
