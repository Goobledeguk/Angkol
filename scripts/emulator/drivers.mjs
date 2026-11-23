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
const POLL_MS = 3000; // how often idle drivers look for ride requests
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

if (!SUPABASE_URL || !ANON_KEY) {
  fail("Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (run with --env-file=.env).");
}
if (!accounts.length) {
  fail("Set EMULATOR_DRIVERS=email:password[,email:password…] with approved tricycle driver test accounts.");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let stopping = false;
const claimed = new Set(); // bookings another emulated driver is already taking

function fail(message) {
  console.error(`emulator: ${message}`);
  process.exit(1);
}

/* ----------------------------------------------------------------- geometry */

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const toPoints = (coordinates) =>
  (coordinates ?? [])
    .filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map(([longitude, latitude]) => ({ latitude, longitude }));

/** Road path between two points: Mapbox if a token is set, else a straight line. */
async function pathBetween(from, to) {
  if (MAPBOX.startsWith("pk.")) {
    try {
      const url =
        "https://api.mapbox.com/directions/v5/mapbox/driving/" +
        `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
        `?geometries=geojson&overview=full&access_token=${encodeURIComponent(MAPBOX)}`;
      const response = await fetch(url);
      if (response.ok) {
        const json = await response.json();
        const points = toPoints(json.routes?.[0]?.geometry?.coordinates);
        if (points.length >= 2) {
          return [from, ...points, to];
        }
      }
    } catch {
      // Fall through to a straight line.
    }
  }
  return [from, to];
}

/** Splits a path into positions spaced by how far the driver moves per tick. */
function stepsAlong(path) {
  const stepKm = (KMH * SPEED * TICK_MS) / 3_600_000;
  const steps = [];
  let carry = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const length = distanceKm(a, b);
    let at = stepKm - carry;
    while (at < length) {
      const t = at / length;
      steps.push({
        latitude: a.latitude + (b.latitude - a.latitude) * t,
        longitude: a.longitude + (b.longitude - a.longitude) * t,
      });
      at += stepKm;
    }
    carry = length - (at - stepKm);
  }
  steps.push(path[path.length - 1]);
  return steps;
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
    for (const point of stepsAlong(path)) {
      if (stopping) {return null;}
      await this.moveTo(point);
      await sleep(TICK_MS);
      const status = await this.status(bookingId);
      if (!keepGoing.includes(status)) {return status;}
    }
    return this.status(bookingId);
  }

  async findRequest() {
    const { data, error } = await this.client
      .from("bookings")
      .select("*")
      .eq("request_status", "Requested")
      .eq("service_type", "Tricycle")
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

    await this.transition(id, "Accepted");
    this.log(`accepted ${label}`);

    // 1. Drive to the passenger.
    const toPickup = await pathBetween(this.position, pickup);
    const km = distanceKm(this.position, pickup);
    this.log(`heading to pickup (${km.toFixed(1)} km)`);
    let status = await this.drive(id, toPickup, ["Accepted"]);
    if (status !== "Accepted") {return this.log(`ride ended while heading to pickup (${status})`);}
    await this.transition(id, "Arrived");
    this.log(`arrived at ${ride.pickup_name}`);

    // 2. Wait for the passenger to board (they tap start), or start it ourselves.
    const deadline = Date.now() + BOARD_WAIT_S * 1000;
    while (!stopping && Date.now() < deadline) {
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
    const toDropoff = booked.length >= 2 ? [pickup, ...booked, dropoff] : await pathBetween(pickup, dropoff);
    status = await this.drive(id, toDropoff, ["In progress"]);
    if (status === "Completed") {return this.log("passenger said PARA, dropped off early");}
    if (status !== "In progress") {return this.log(`ride ended on the way (${status})`);}

    // 4. PARA at the destination.
    await this.transition(id, "Completed");
    this.log(`PARA at ${ride.dropoff_name}, ride completed`);
  }

  async run() {
    while (!stopping) {
      const ride = await this.findRequest();
      if (!ride) {
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
