import type { Geometry, Point } from "../types/types";

const TOKEN = (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "").trim();
const STYLE = "mapbox/streets-v12";
const ORIGIN = "https://api.mapbox.com";

export const hasMapbox = TOKEN.startsWith("pk.") && TOKEN.length > 40;

export const DEFAULT_CENTER = { latitude: 12.0676, longitude: 124.5942 };

export type Viewport = {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
};

export function viewportFor(points: Point[], width = 600, height = 390): Viewport {
  const valid = points.filter(
    (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
  );
  if (!valid.length) {
    return { north: 12.09, south: 12.04, east: 124.62, west: 124.57, zoom: 13 };
  }
  let north = -90,
    south = 90,
    east = -180,
    west = 180;
  for (const p of valid) {
    north = Math.max(north, p.latitude);
    south = Math.min(south, p.latitude);
    east = Math.max(east, p.longitude);
    west = Math.min(west, p.longitude);
  }
  const latSpan = Math.max(north - south, 0.004);
  const lngSpan = Math.max(east - west, 0.004);
  north += latSpan * 0.35;
  south -= latSpan * 0.35;
  east += lngSpan * 0.35;
  west -= lngSpan * 0.35;

  const tiles = Math.max(width, 1) / 512;
  const zoom = Math.min(
    16,
    Math.max(
      10,
      Math.floor(Math.log2((360 * tiles) / Math.max(east - west, 0.0001))) - 1,
    ),
  );
  return { north, south, east, west, zoom };
}

export function staticMapUrl(options: {
  points: Point[];
  path?: Geometry | null;
  width: number;
  height: number;
  vehicleColor?: string;
}): string | null {
  if (!hasMapbox) {return null;}
  const { points, path, width, height } = options;
  const view = viewportFor(points, width, height);

  const overlays: string[] = [];
  const pickup = points[0];
  if (pickup) {
    overlays.push(`pin-s-0b4f3c(${pickup.longitude},${pickup.latitude})`);
  }
  const destination = points[1];
  if (destination) {
    overlays.push(`pin-s-c69c57(${destination.longitude},${destination.latitude})`);
  }
  for (const v of points.slice(2, 8)) {
    overlays.push(`pin-s-1f7a5c(${v.longitude},${v.latitude})`);
  }

  const coords = path?.coordinates ?? [];
  if (coords.length >= 2) {
    const step = Math.max(1, Math.ceil(coords.length / 80));
    const line = coords
      .filter((_, index) => index % step === 0)
      .map(([longitude, latitude]) => `${longitude},${latitude}`)
      .join(",");
    overlays.push(`path-4+0b4f3c-0.9(${line})`);
  }

  const overlay = overlays.length ? overlays.join(",") : "";
  const size = `${Math.round(width)}x${Math.round(height)}@2x`;
  const query = `access_token=${encodeURIComponent(TOKEN)}&logo=false&attribution=false`;
  if (!overlay) {
    return `${ORIGIN}/styles/v1/${STYLE}/static/${DEFAULT_CENTER.longitude},${DEFAULT_CENTER.latitude},12,0/${size}?${query}`;
  }
  const bbox = `${view.west},${view.south},${view.east},${view.north}`;
  return `${ORIGIN}/styles/v1/${STYLE}/static/${overlay}/${bbox}/${size}?${query}`;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string> {
  if (!hasMapbox) {return "";}
  const url = `${ORIGIN}/geocoding/v5/mapbox.places/${longitude},${latitude}.json?limit=1&country=ph&access_token=${encodeURIComponent(TOKEN)}`;
  const response = await fetch(url);
  if (!response.ok) {return "";}
  const json = (await response.json()) as { features?: { text?: string }[] };
  return json.features?.[0]?.text ?? "";
}

export async function searchPlaces(query: string): Promise<Point[]> {
  if (!hasMapbox || !query.trim()) {return [];}
  const url =
    `${ORIGIN}/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?limit=6&country=ph&proximity=${DEFAULT_CENTER.longitude},${DEFAULT_CENTER.latitude}` +
    `&types=poi,address,place,locality&access_token=${encodeURIComponent(TOKEN)}`;
  const response = await fetch(url);
  if (!response.ok) {return [];}
  const json = (await response.json()) as {
    features?: { text?: string; place_name?: string; center?: [number, number] }[];
  };
  return (json.features ?? [])
    .filter((f) => f.center && f.center.length === 2)
    .map((f) => ({
      name: f.text || f.place_name || "Location",
      longitude: f.center![0],
      latitude: f.center![1],
    }));
}

export async function directions(
  from: Point,
  to: Point,
): Promise<{ distanceKm: number; minutes: number; geometry: Geometry }> {
  if (!hasMapbox) {
    throw new Error(
      "Mapbox is not configured. Add EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to .env, then restart Expo.",
    );
  }
  const url =
    `${ORIGIN}/directions/v5/mapbox/driving/` +
    `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    `?geometries=geojson&overview=full&access_token=${encodeURIComponent(TOKEN)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not calculate a route. Check your Mapbox token.");
  }
  const json = (await response.json()) as {
    routes?: {
      distance?: number;
      duration?: number;
      geometry?: Geometry;
    }[];
  };
  const route = json.routes?.[0];
  if (!route) {throw new Error("No drivable route found between those places.");}
  return {
    distanceKm: Math.max(0.1, (route.distance ?? 0) / 1000),
    minutes: Math.max(1, Math.round((route.duration ?? 0) / 60)),
    geometry: route.geometry ?? {
      type: "LineString",
      coordinates: [
        [from.longitude, from.latitude],
        [to.longitude, to.latitude],
      ],
    },
  };
}
