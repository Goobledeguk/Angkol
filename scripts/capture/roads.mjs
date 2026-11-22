// Snaps every sample line (trip legs, jeepney routes) to real roads once,
// using Mapbox Directions, and bundles the result in src/map/roads.json.
// The app itself never calls Directions; it looks lines up in that file.
//   node --env-file=.env scripts/capture/roads.mjs
import { writeFile } from "node:fs/promises";
import { captureScenes } from "../../src/testing/captureScenes.ts";
import { roadKey } from "../../src/map/roadKey.ts";

const token = (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "").trim();
if (!token.startsWith("pk.")) {
  throw new Error("Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in .env first.");
}

const lines = new Map();
const add = (coords) => {
  if (coords.length >= 2 && coords.length <= 25) {
    lines.set(roadKey(coords), coords);
  }
};
const walk = (value) => {
  if (!value || typeof value !== "object") {return;}
  if (Array.isArray(value)) {return value.forEach(walk);}
  if (value.type === "LineString" && Array.isArray(value.coordinates)) {add(value.coordinates);}
  if (Array.isArray(value.stops) && value.stops.every((s) => s && Number.isFinite(s.latitude))) {
    add(value.stops.map((s) => [s.longitude, s.latitude]));
  }
  if (value.pickupPoint && value.destinationPoint) {
    add([value.pickupPoint, value.destinationPoint].map((p) => [p.longitude, p.latitude]));
  }
  Object.values(value).forEach(walk);
};
walk(captureScenes.map((scene) => scene.snapshot));

const out = {};
for (const [key, coords] of lines) {
  const path = coords.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${path}?geometries=geojson&overview=full&access_token=${token}`;
  const res = await fetch(url);
  const body = await res.json();
  const geometry = body.routes?.[0]?.geometry?.coordinates;
  if (!res.ok || !geometry) {
    console.warn(`skip ${key}: ${body.message ?? res.status}`);
    continue;
  }
  out[key] = geometry.map(([lng, lat]) => [Number(lng.toFixed(5)), Number(lat.toFixed(5))]);
  console.log(`${key.slice(0, 60)}…  ${out[key].length} points`);
}
await writeFile(new URL("../../src/map/roads.json", import.meta.url), `${JSON.stringify(out)}\n`);
console.log(`${Object.keys(out).length} lines written to src/map/roads.json`);
