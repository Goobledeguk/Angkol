import type { Geometry, Point } from "../types/types";

const TOKEN = (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "").trim();
const STYLE = "mapbox/streets-v12";
const ORIGIN = "https://api.mapbox.com";

export const hasMapbox = TOKEN.startsWith("pk.") && TOKEN.length > 40;

export const DEFAULT_CENTER = { latitude: 12.0676, longitude: 124.5942 };

export type Viewport = {
  latitude: number;
  longitude: number;
  zoom: number;
};

const TILE = 512;
const MAX_LAT = 85.0511;

function mercatorY(latitude: number) {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, latitude));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

function latitudeFromMercatorY(y: number) {
  const n = Math.PI - 2 * Math.PI * y;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

export function viewportFor(points: Point[], width = 600, height = 390): Viewport {
  const valid = points.filter(
    (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
  );
  if (!valid.length) {
    return { ...DEFAULT_CENTER, zoom: 13 };
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
  const top = mercatorY(north);
  const bottom = mercatorY(south);
  const lngFraction = Math.max((east - west) / 360, 0.00001);
  const latFraction = Math.max(bottom - top, 0.00001);
  const usableWidth = Math.max(width * 0.7, 1);
  const usableHeight = Math.max(height * 0.7, 1);
  const zoom = Math.min(
    16,
    Math.max(
      2,
      Math.min(
        Math.log2(usableWidth / (TILE * lngFraction)),
        Math.log2(usableHeight / (TILE * latFraction)),
      ),
    ),
  );
  return {
    latitude: latitudeFromMercatorY((top + bottom) / 2),
    longitude: (east + west) / 2,
    zoom: Math.round(zoom * 100) / 100,
  };
}

export function pointAt(view: Viewport, x: number, y: number, width: number, height: number) {
  const scale = TILE * Math.pow(2, view.zoom);
  const longitude = view.longitude + ((x - width / 2) / scale) * 360;
  const latitude = latitudeFromMercatorY(mercatorY(view.latitude) + (y - height / 2) / scale);
  return { latitude, longitude };
}

export type MapScene = {
  pickup?: Point | null;
  destination?: Point | null;
  markers?: Point[];
  path?: Geometry | null;
  view: Viewport;
  width: number;
  height: number;
};

export function distanceKm(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function staticMapUrl(scene: MapScene): string | null {
  if (!hasMapbox) {return null;}
  const { pickup, destination, markers = [], path, view, width, height } = scene;
  const overlays: string[] = [];
  for (const marker of markers.slice(0, 8)) {
    overlays.push(`pin-s+1f7a5c(${marker.longitude},${marker.latitude})`);
  }
  const coords = path?.coordinates ?? [];
  if (coords.length >= 2) {
    const step = Math.max(1, Math.ceil(coords.length / 80));
    const line = coords
      .filter((_, index) => index % step === 0 || index === coords.length - 1)
      .map(([longitude, latitude]) => `${longitude},${latitude}`)
      .join(",");
    overlays.push(`path-4+0b4f3c-0.9(${line})`);
  }
  if (pickup) {
    overlays.push(`pin-s+0b4f3c(${pickup.longitude},${pickup.latitude})`);
  }
  if (destination) {
    overlays.push(`pin-s+c69c57(${destination.longitude},${destination.latitude})`);
  }

  const overlay = overlays.length ? `${overlays.join(",")}/` : "";
  const camera = `${view.longitude.toFixed(6)},${view.latitude.toFixed(6)},${view.zoom},0`;
  const query = `access_token=${encodeURIComponent(TOKEN)}&logo=false&attribution=false`;
  return `${ORIGIN}/styles/v1/${STYLE}/static/${overlay}${camera}/${width}x${height}@2x?${query}`;
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
