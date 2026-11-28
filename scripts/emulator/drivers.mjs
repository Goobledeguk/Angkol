#!/usr/bin/env node
/**
 * Emulated tricycle drivers for testing the passenger app end to end.
 *
 * Each emulated driver signs in with a real (approved) tricycle driver account,
 * goes online, and then works rides exactly like a person on the driver app:
 *
 *   Requested → accept → drives to your pickup → Arrived
 *   → (you board, or it starts after a short wait) → In progress
 *   → drives the booked route → PARA at the destination (Completed)
 *
 * Location is written to `drivers` and `vehicles` the same way the driver app
 * does, so the passenger map and ETA move as the driver drives. If you tap
 * PARA! or cancel in the passenger app first, the driver stops and goes back to
 * waiting for the next ride.
 *
 * Usage:
 *   node --env-file=.env scripts/emulator/drivers.mjs
 *
 * .env:
 *   EMULATOR_DRIVERS=driver1@example.com:password,driver2@example.com:password
 *   EMULATOR_SPEED=4          # time multiplier, 1 = real tricycle speed (~22 km/h)
 *   EMULATOR_BOARD_WAIT=15    # seconds at pickup before starting the trip itself
 *
 * Flags: --speed=<n>  --board-wait=<s>  --once (stop after one ride per driver)
 *
 * Use test accounts only: the drivers really accept and complete bookings.
 */
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? "true"];
  }),
);

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
const MAPBOX = (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "").trim();
// parseFloat ignores trailing spaces or "# comments" left in .env values.
const numberSetting = (value, fallback) => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
};
const SPEED = Math.max(0.1, numberSetting(args.speed ?? process.env.EMULATOR_SPEED, 4));
const BOARD_WAIT_S = Math.max(0, numberSetting(args["board-wait"] ?? process.env.EMULATOR_BOARD_WAIT, 15));
const ONCE = args.once === "true";

const KMH = 22; // average city tricycle speed
const TICK_MS = 2000; // how often the driver moves and writes GPS
const POLL_MS = 3000;
const HEARTBEAT_MS = 20000; // parked GPS heartbeat // how often idle drivers look for ride requests
const SPAWN = { latitude: 12.0676, longitude: 124.5942 }; // Calbayog City Hall

const accounts = (process.env.EMULATOR_DRIVERS ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const at = entry.indexOf(":");
    return { email: entry.slice(0, at), password: entry.slice(at + 1) };
  })
  .filter((a) => a.email && a.password);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let stopping = false;
const claimed = new Set(); // bookings another emulated driver is already taking

function fail(message) {
  console.error(`emulator: ${message}`);
  process.exit(1);
}

/* ----------------------------------------------------------------- geometry */

export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Keep this geometry cleanup in sync with src/services/routeGeometry.ts.
const SPUR_TOLERANCE_M = 15;
const LOOP_LIMIT_M = 600;
const RAD = Math.PI / 180;

function distance(a, b) {
  const h =
    Math.sin(((b[1] - a[1]) * RAD) / 2) ** 2 +
    Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) *
      Math.sin(((b[0] - a[0]) * RAD) / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(Math.min(1, h)));
}

function samePoint(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function deduplicate(coords) {
  const points = [coords[0]];
  for (let i = 1; i < coords.length - 1; i++) {
    if (!samePoint(points[points.length - 1], coords[i])) {
      points.push(coords[i]);
    }
  }
  const last = coords[coords.length - 1];
  if (points.length > 1 && samePoint(points[points.length - 1], last)) {
    points.pop();
  }
  return [...points, last];
}

function interpolate(a, b, t) {
  if (t === 0) {
    return a;
  }
  if (t === 1) {
    return b;
  }
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// Scale longitude locally so the projection uses approximately metric axes.
function projection(point, a, b) {
  const scale = Math.cos(point[1] * RAD);
  const x = (b[0] - a[0]) * scale;
  const y = b[1] - a[1];
  const lengthSquared = x * x + y * y;
  if (!lengthSquared) {
    return 0;
  }
  return (((point[0] - a[0]) * scale) * x + (point[1] - a[1]) * y) / lengthSquared;
}

function cumulativeLengths(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]));
  }
  return lengths;
}

function removeSpur(points) {
  const lengths = cumulativeLengths(points);
  for (let i = 0; i < points.length - 2; i++) {
    const start = points[i];
    const next = points[i + 1];
    const longitudeScale = Math.cos(start[1] * RAD);
    const latitudeMargin = SPUR_TOLERANCE_M / 111_194;
    const longitudeMargin = latitudeMargin / Math.max(0.000001, longitudeScale);
    for (let j = i + 2; j < points.length; j++) {
      const a = points[j - 1];
      const b = points[j];
      if (start[0] < Math.min(a[0], b[0]) - longitudeMargin ||
        start[0] > Math.max(a[0], b[0]) + longitudeMargin ||
        start[1] < Math.min(a[1], b[1]) - latitudeMargin ||
        start[1] > Math.max(a[1], b[1]) + latitudeMargin) {
        continue;
      }
      const dot = (next[0] - start[0]) * (b[0] - a[0]) * longitudeScale ** 2 +
        (next[1] - start[1]) * (b[1] - a[1]);
      if (dot >= 0) {
        continue;
      }
      const t = Math.max(0, Math.min(1, projection(start, a, b)));
      const gap = distance(start, interpolate(a, b, t));
      const returnAt = lengths[j - 1] + (lengths[j] - lengths[j - 1]) * t;
      if (gap > SPUR_TOLERANCE_M || returnAt - lengths[i] <= 3 * gap) {
        continue;
      }

      // Match the outbound and inbound halves by distance along the path.
      // Checking every vertex also handles a retraced path with several bends.
      let match = j;
      let retraces = true;
      for (let k = i + 1; k < j && lengths[k] <= returnAt; k++) {
        const mirroredAt = returnAt - (lengths[k] - lengths[i]);
        while (match > i + 1 && lengths[match - 1] > mirroredAt) {
          match--;
        }
        const fraction = (mirroredAt - lengths[match - 1]) /
          (lengths[match] - lengths[match - 1]);
        const mirror = interpolate(points[match - 1], points[match], fraction);
        if (distance(points[k], mirror) > SPUR_TOLERANCE_M) {
          retraces = false;
          break;
        }
      }
      if (retraces) {
        return deduplicate([...points.slice(0, i + 1), ...points.slice(j)]);
      }
    }
  }
  return null;
}

function crossing(a, b, c, d) {
  const x = b[0] - a[0];
  const y = b[1] - a[1];
  const u = d[0] - c[0];
  const v = d[1] - c[1];
  const denominator = x * v - y * u;
  if (denominator === 0) {
    return null;
  }
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const t = (dx * v - dy * u) / denominator;
  const s = (dx * y - dy * x) / denominator;
  if (t < 0 || t > 1 || s < 0 || s > 1) {
    return null;
  }
  return { t, s };
}

function removeLoop(points) {
  const lengths = cumulativeLengths(points);
  const limit = Math.min(LOOP_LIMIT_M, lengths[lengths.length - 1] * 0.35);
  for (let i = 0; i < points.length - 3; i++) {
    const a = points[i];
    const b = points[i + 1];
    for (let j = i + 2; j < points.length - 1; j++) {
      const between = lengths[j] - lengths[i + 1];
      if (between >= limit) {
        break;
      }
      const hit = crossing(a, b, points[j], points[j + 1]);
      if (!hit) {
        continue;
      }
      const loopLength = between + (1 - hit.t) * (lengths[i + 1] - lengths[i]) +
        hit.s * (lengths[j + 1] - lengths[j]);
      if (loopLength > 0 && loopLength < limit) {
        return deduplicate([
          ...points.slice(0, i + 1),
          interpolate(a, b, hit.t),
          ...points.slice(j + 1),
        ]);
      }
    }
  }
  return null;
}

function cleanRoute(coords) {
  if (coords.length < 2) {
    return coords.slice();
  }
  let points = deduplicate(coords);
  while (true) {
    const cleaned = removeSpur(points) ??
      removeSpur(points.slice().reverse())?.reverse() ?? removeLoop(points);
    if (!cleaned) {
      return points;
    }
    points = cleaned;
  }
}

function roadEntry(point, road) {
  if (projection(point, road[0], road[1]) <= 0) {
    return { index: 0, point: road[0] };
  }

  let closest = { index: 0, point: road[0] };
  let bestDistance = distance(point, road[0]);
  for (let i = 0; i < road.length - 1; i++) {
    const t = Math.max(0, Math.min(1, projection(point, road[i], road[i + 1])));
    const candidate = interpolate(road[i], road[i + 1], t);
    const gap = distance(point, candidate);
    if (gap < bestDistance) {
      closest = { index: i + t, point: candidate };
      bestDistance = gap;
    }
  }
  return closest;
}

function joinEnds(
  start,
  road,
  end,
) {
  const points = road.length >= 2 ? deduplicate(road) : road;
  if (points.length < 2) {
    return cleanRoute([start, ...points, end]);
  }

  const entry = roadEntry(start, points);
  const exit = roadEntry(end, points.slice().reverse());
  const exitIndex = points.length - 1 - exit.index;
  if (entry.index > exitIndex) {
    return cleanRoute([start, end]);
  }
  return cleanRoute([
    start,
    entry.point,
    ...points.slice(Math.floor(entry.index) + 1, Math.ceil(exitIndex)),
    exit.point,
    end,
  ]);
}

const toPoints = (coordinates) =>
  (coordinates ?? [])
    .filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map(([longitude, latitude]) => ({ latitude, longitude }));

/** Road path between two points: Mapbox if a token is set, else a straight line. */
export async function pathBetween(from, to, signal) {
  if (MAPBOX.startsWith("pk.")) {
    try {
      const url =
        "https://api.mapbox.com/directions/v5/mapbox/driving/" +
        `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
        `?geometries=geojson&overview=full&continue_straight=false&access_token=${encodeURIComponent(MAPBOX)}`;
      const response = await fetch(url, { signal });
      if (response.ok) {
        const json = await response.json();
        const points = toPoints(json.routes?.[0]?.geometry?.coordinates);
        if (points.length >= 2) {
          return connectPath(from, points, to);
        }
      }
    } catch {
      signal?.throwIfAborted();
      // Fall through to a straight line.
    }
  }
  return [from, to];
}

function connectPath(from, road, to) {
  const coordinates = joinEnds(
    [from.longitude, from.latitude],
    road.map(({ longitude, latitude }) => [longitude, latitude]),
    [to.longitude, to.latitude],
  );
  return toPoints(coordinates);
}

/** Yields each GPS tick and the road vertices traversed since the last tick. */
export function* stepsAlong(path, stepKm = (KMH * SPEED * TICK_MS) / 3_600_000) {
  let carry = 0;
  let trail = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const length = distanceKm(a, b);
    let at = stepKm - carry;
    while (at < length) {
      const t = at / length;
      const point = {
        latitude: a.latitude + (b.latitude - a.latitude) * t,
        longitude: a.longitude + (b.longitude - a.longitude) * t,
      };
      yield { point, trail: [...trail, point] };
      trail = [point];
      at += stepKm;
    }
    trail.push(b);
    carry = length - (at - stepKm);
  }
  yield { point: path[path.length - 1], trail };
}

/* ------------------------------------------------------------------ drivers */

class EmulatedDriver {
  constructor({ email, password }) {
    this.email = email;
    this.password = password;
    this.client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: true },
    });
    this.position = null;
    this.rides = 0;
  }

  log(message) {
    console.log(`[${new Date().toLocaleTimeString()}] ${this.name ?? this.email}: ${message}`);
  }

  async start() {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: this.email,
      password: this.password,
    });
    if (error) {throw new Error(`${this.email}: ${error.message}`);}
    this.id = data.user.id;

    const { data: profile, error: profileError } = await this.client.rpc("my_profile");
    if (profileError) {throw new Error(`${this.email}: ${profileError.message}`);}
    const role = profile?.user?.assigned_roles?.[0];
    this.name = profile?.user?.name || this.email;
    if (role !== "Tricycle driver") {
      throw new Error(`${this.email} is a "${role}" account. Use tricycle driver accounts.`);
    }
    const driver = profile?.driver;
    if (driver?.current_lat != null && driver?.current_lng != null) {
      this.position = { latitude: Number(driver.current_lat), longitude: Number(driver.current_lng) };
    } else {
      // Spread new drivers around City Hall so their pins don't overlap.
      this.position = {
        latitude: SPAWN.latitude + (Math.random() - 0.5) * 0.01,
        longitude: SPAWN.longitude + (Math.random() - 0.5) * 0.01,
      };
    }
    await this.setOnline(true);
    await this.moveTo(this.position);
    this.log(`online at ${this.position.latitude.toFixed(5)}, ${this.position.longitude.toFixed(5)}`);
  }

  async setOnline(available) {
    const { error } = await this.client
      .from("drivers")
      .update({ availability_status: available ? "available" : "offline" })
      .eq("user_id", this.id);
    if (error) {this.log(`could not go ${available ? "online" : "offline"}: ${error.message}`);}
  }

  async moveTo(point) {
    this.position = point;
    const now = new Date().toISOString();
    const update = { current_lat: point.latitude, current_lng: point.longitude, location_updated_at: now };
    await Promise.all([
      this.client.from("drivers").update(update).eq("user_id", this.id),
      this.client.from("vehicles").update(update).eq("driver_id", this.id),
    ]);
  }

  async transition(bookingId, status) {
    const { error } = await this.client.rpc("transition_booking", {
      p_booking_id: bookingId,
      p_status: status,
    });
    if (error) {throw new Error(error.message);}
  }

  async status(bookingId) {
    const { data } = await this.client
      .from("bookings")
      .select("request_status")
      .eq("booking_id", bookingId)
      .maybeSingle();
    return data?.request_status ?? null;
  }

  /** Drives a path, stopping early if the ride leaves one of `keepGoing`. */
  async drive(bookingId, path, keepGoing) {
    for (const { point } of stepsAlong(path)) {
      if (stopping) {return null;}
      await this.moveTo(point);
      await sleep(TICK_MS);
      const status = await this.status(bookingId);
      if (!keepGoing.includes(status)) {return status;}
    }
    return this.status(bookingId);
  }

  async findRequest() {
    const nowIso = new Date().toISOString();
    const { data, error } = await this.client
      .from("bookings")
      .select("*")
      .eq("request_status", "Requested")
      .eq("service_type", "Tricycle")
      // Ask the database for live requests only. Filtering after the limit let a
      // backlog of expired rows hide a real passenger's new request.
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("created_at", { ascending: true })
      .limit(20);
    if (error) {
      this.log(`could not read ride requests: ${error.message}`);
      return null;
    }
    const now = Date.now();
    return (
      (data ?? []).find(
        (row) =>
          !claimed.has(row.booking_id) &&
          (row.driver_id == null || row.driver_id === this.id) &&
          !(row.declined_by ?? []).includes(this.id) &&
          (!row.expires_at || new Date(row.expires_at).getTime() > now),
      ) ?? null
    );
  }

  async work(ride) {
    const id = ride.booking_id;
    const pickup = { latitude: Number(ride.pickup_latitude), longitude: Number(ride.pickup_longitude) };
    const dropoff = { latitude: Number(ride.dropoff_latitude), longitude: Number(ride.dropoff_longitude) };
    const label = `${ride.pickup_name} → ${ride.dropoff_name}`;

    // A ride this driver already had (for example after a restart) resumes where it was.
    let status = ride.request_status;
    if (status === "Requested") {
      await this.transition(id, "Accepted");
      status = "Accepted";
      this.log(`accepted ${label}`);
    } else {
      this.log(`resuming ${label} (${status})`);
    }

    // 1. Drive to the passenger.
    if (status === "Accepted") {
      const toPickup = await pathBetween(this.position, pickup);
      const km = distanceKm(this.position, pickup);
      this.log(`heading to pickup (${km.toFixed(1)} km)`);
      status = await this.drive(id, toPickup, ["Accepted"]);
      if (status !== "Accepted") {return this.log(`ride ended while heading to pickup (${status})`);}
      await this.transition(id, "Arrived");
      status = "Arrived";
      this.log(`arrived at ${ride.pickup_name}`);
    }

    // 2. Wait for the passenger to board (they tap start), or start it ourselves.
    const deadline = Date.now() + BOARD_WAIT_S * 1000;
    while (status === "Arrived" && !stopping && Date.now() < deadline) {
      await sleep(1000);
      status = await this.status(id);
      if (status !== "Arrived") {break;}
    }
    if (status === "Arrived") {
      await this.transition(id, "In progress");
      status = "In progress";
      this.log("passenger on board, trip started");
    } else if (status === "In progress") {
      this.log("passenger started the trip");
    } else {
      return this.log(`ride ended at pickup (${status})`);
    }

    // 3. Drive the booked route to the destination.
    const booked = toPoints(ride.route_polyline?.coordinates);
    // A ride resumed mid-trip continues from where the tricycle is, not from the pickup.
    const resumedOnTheWay = ride.request_status === "In progress";
    const toDropoff = resumedOnTheWay
      ? await pathBetween(this.position, dropoff)
      : booked.length >= 2
        ? connectPath(pickup, booked, dropoff)
        : await pathBetween(pickup, dropoff);
    status = await this.drive(id, toDropoff, ["In progress"]);
    if (status === "Completed") {return this.log("passenger said PARA, dropped off early");}
    if (status !== "In progress") {return this.log(`ride ended on the way (${status})`);}

    // 4. PARA at the destination.
    await this.transition(id, "Completed");
    this.log(`PARA at ${ride.dropoff_name}, ride completed`);
  }

  /** A ride this driver accepted earlier and has not finished. */
  async findOwnRide() {
    const { data } = await this.client
      .from("bookings")
      .select("*")
      .eq("driver_id", this.id)
      .eq("service_type", "Tricycle")
      .in("request_status", ["Accepted", "Arrived", "In progress"])
      .limit(1);
    return data?.[0] ?? null;
  }

  async run() {
    while (!stopping) {
      const ride = (await this.findOwnRide()) ?? (await this.findRequest());
      if (!ride) {
        // Parked drivers still report their position, like the app does every 30 s.
        if (Date.now() - (this.lastBeat ?? 0) > HEARTBEAT_MS) {
          this.lastBeat = Date.now();
          await this.moveTo(this.position);
        }
        await sleep(POLL_MS);
        continue;
      }
      claimed.add(ride.booking_id);
      try {
        await this.work(ride);
        this.rides++;
      } catch (error) {
        this.log(`skipped ride: ${error.message}`);
      } finally {
        claimed.delete(ride.booking_id);
      }
      if (ONCE && this.rides > 0) {break;}
    }
  }

  async stop() {
    await this.setOnline(false);
    await this.client.auth.signOut();
  }
}

/* --------------------------------------------------------------------- main */

async function main() {
  if (!SUPABASE_URL || !ANON_KEY) {
    fail("Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (run with --env-file=.env).");
  }
  if (!accounts.length) {
    fail("Set EMULATOR_DRIVERS=email:password[,email:password…] with approved tricycle driver test accounts.");
  }

  const drivers = accounts.map((account) => new EmulatedDriver(account));
  const started = [];
  for (const driver of drivers) {
    try {
      await driver.start();
      started.push(driver);
    } catch (error) {
      console.error(`emulator: ${error.message}`);
    }
  }
  if (!started.length) {fail("No emulated drivers could start.");}

  console.log(
    `emulator: ${started.length} driver(s) online, speed ×${SPEED}, board wait ${BOARD_WAIT_S}s. Book a tricycle ride in the passenger app. Ctrl+C to stop.`,
  );

  async function shutdown() {
    if (stopping) {return;}
    stopping = true;
    console.log("\nemulator: taking drivers offline…");
    await Promise.all(started.map((driver) => driver.stop()));
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await Promise.all(started.map((driver) => driver.run()));
  await shutdown();
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
