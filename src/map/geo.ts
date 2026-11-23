import type { Point } from "../types/types";

/** Web Mercator helpers shared by the map and its gestures. World coordinates run 0..1. */
export const TILE = 512;
export const MIN_ZOOM = 11;
export const MAX_ZOOM = 19;
export const EARTH_M = 40075016;

export const mercX = (lng: number) => (lng + 180) / 360;
export const mercY = (lat: number) => {
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
export const lngFromX = (x: number) => x * 360 - 180;
export const latFromY = (y: number) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI - 2 * Math.PI * y));

/** Camera: centre in world coordinates and a fractional zoom level. */
export type Camera = { cx: number; cy: number; zoom: number };

export const scaleOf = (zoom: number) => TILE * 2 ** zoom;
export const clampZoom = (zoom: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

/** Frames every point with padding, never closer than `maxZoom`. */
export function fitCamera(points: Point[], width: number, height: number, pad: number, fallback: Point, maxZoom = 16.4): Camera {
  const valid = points.filter((p) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  const base = valid.length ? valid : [fallback];
  const xs = base.map((p) => mercX(p.longitude));
  const ys = base.map((p) => mercY(p.latitude));
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const spanX = Math.max(maxX - minX, 1e-7);
  const spanY = Math.max(maxY - minY, 1e-7);
  const fitScale = Math.min(Math.max(1, width - pad * 2) / spanX, Math.max(1, height - pad * 2) / spanY);
  const zoom = Math.max(MIN_ZOOM, Math.min(maxZoom, Math.log2(fitScale / TILE)));
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, zoom };
}

/** Camera centred on one point at a given zoom. */
export const cameraAt = (p: Point, zoom: number): Camera => ({ cx: mercX(p.longitude), cy: mercY(p.latitude), zoom: clampZoom(zoom) });

/** Screen offset (from the frame's top-left) → map point. */
export function pointAtScreen(cam: Camera, x: number, y: number, width: number, height: number): Point {
  const scale = scaleOf(cam.zoom);
  return {
    name: "",
    longitude: lngFromX(cam.cx + (x - width / 2) / scale),
    latitude: latFromY(cam.cy + (y - height / 2) / scale),
  };
}

/**
 * Applies a gesture result (translate t, then scale s about the frame centre)
 * to the camera: the point that ends up in the middle becomes the new centre.
 */
export function applyGesture(cam: Camera, tx: number, ty: number, s: number): Camera {
  const scale = scaleOf(cam.zoom);
  const zoom = clampZoom(cam.zoom + Math.log2(s));
  const real = 2 ** (zoom - cam.zoom);
  return {
    cx: cam.cx - tx / real / scale,
    cy: Math.max(0, Math.min(1, cam.cy - ty / real / scale)),
    zoom,
  };
}

/** Zoom by `factor` keeping the screen point (fx, fy) — relative to the frame centre — fixed. */
export function zoomAbout(cam: Camera, factor: number, fx: number, fy: number): Camera {
  const zoom = clampZoom(cam.zoom + Math.log2(factor));
  const k = 2 ** (zoom - cam.zoom);
  const scale = scaleOf(cam.zoom);
  return {
    cx: cam.cx + (fx / scale) * (1 - 1 / k),
    cy: cam.cy + (fy / scale) * (1 - 1 / k),
    zoom,
  };
}

const MAPBOX_TOKEN = (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "").trim();
export const hasTiles = MAPBOX_TOKEN.startsWith("pk.") && MAPBOX_TOKEN.length > 40;

export type TileSpec = { key: string; uri: string; left: number; top: number; size: number };

/** Mapbox raster tiles covering the frame plus `margin` px on every side. */
export function tilesFor(cam: Camera, width: number, height: number, margin: number): TileSpec[] {
  if (!hasTiles || width <= 1 || height <= 1) {
    return [];
  }
  const z = Math.max(0, Math.min(20, Math.round(cam.zoom)));
  const n = 2 ** z;
  const size = TILE * 2 ** (cam.zoom - z);
  const scale = scaleOf(cam.zoom);
  const originX = width / 2 - cam.cx * scale;
  const originY = height / 2 - cam.cy * scale;
  const x0 = Math.floor((-margin - originX) / size);
  const x1 = Math.floor((width + margin - originX) / size);
  const y0 = Math.max(0, Math.floor((-margin - originY) / size));
  const y1 = Math.min(n - 1, Math.floor((height + margin - originY) / size));
  const tiles: TileSpec[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const wrapped = ((x % n) + n) % n;
      tiles.push({
        key: `${z}/${wrapped}/${y}`,
        uri: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/${z}/${wrapped}/${y}@2x?access_token=${encodeURIComponent(MAPBOX_TOKEN)}`,
        left: originX + x * size,
        top: originY + y * size,
        size,
      });
    }
  }
  return tiles;
}
