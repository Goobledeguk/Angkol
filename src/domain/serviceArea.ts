import type { Point } from "../types/types";

export function inServiceArea(point: Pick<Point, "latitude" | "longitude">) {
  const { latitude, longitude } = point;
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    latitude >= 11.93 &&
    latitude <= 12.32 &&
    longitude >= 124.48 &&
    longitude <= 124.90
  );
}
