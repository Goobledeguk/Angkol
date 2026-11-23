#!/usr/bin/env node
import { setTimeout as sleep } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { distanceKm, pathBetween, stepsAlong } from "./drivers.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? "true"];
  }),
);

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
const numberSetting = (value, fallback) => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
};
const SPEED = Math.max(0.1, numberSetting(args.speed ?? process.env.EMULATOR_SPEED, 4));
const DWELL_S = Math.max(0, numberSetting(args.dwell, 20));
const LOOPS = args.loops === undefined ? Infinity : Number(args.loops);
const KMH = 22;
const TICK_MS = 2000;
const STOP_DWELL_MS = 3000;
const BOOKING_RADIUS_KM = 0.06;

const accounts = (process.env.EMULATOR_PUJS ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .map((entry) => {
    const at = entry.indexOf(":");
    return at > 0 ? { email: entry.slice(0, at), password: entry.slice(at + 1) } : null;
  })
  .filter((account) => account?.password);

function fail(message) {
  console.error(`puj emulator: ${message}`);
  process.exit(1);
}

if (!SUPABASE_URL || !ANON_KEY) {
  fail("Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (run with --env-file=.env).");
}
if (!accounts.length) {
  fail("Set EMULATOR_PUJS=email:password[,email:password…] with approved PUJ/PUV driver test accounts.");
}
if (args.loops !== undefined && (!Number.isSafeInteger(LOOPS) || LOOPS < 1)) {
  fail("--loops must be a positive integer.");
}

const shutdown = new AbortController();
const { signal } = shutdown;
const wait = (ms) => sleep(ms, undefined, { signal });
const randomCount = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function unwrap({ data, error }) {
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

function bookingPoint(booking, kind) {
  return {
    latitude: Number(booking[`${kind}_latitude`]),
    longitude: Number(booking[`${kind}_longitude`]),
  };
}

class EmulatedJeepney {
  constructor({ email, password }) {
    this.email = email;
    this.password = password;
    this.client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: true },
    });
    this.bookings = new Set();
  }

  log(message) {
    console.log(`[${new Date().toLocaleTimeString()}] ${this.name ?? this.email}: ${message}`);
  }

  async start() {
    const { user } = unwrap(await this.client.auth.signInWithPassword({
      email: this.email,
      password: this.password,
    }));
    this.id = user.id;

    const profile = unwrap(await this.client.rpc("my_profile"));
    const role = profile?.user?.assigned_roles?.[0];
    this.name = profile?.user?.name || this.email;
    if (role !== "PUJ / PUV driver") {
      throw new Error(`account role is "${role}". Use a PUJ / PUV driver account.`);
    }
    const driver = profile.driver;
    if (!driver?.routes_id) {
      throw new Error("no route is assigned to this driver.");
    }
    if (!driver.verified || !profile.user.verified || profile.user.application_status !== "accepted") {
      throw new Error("the driver account must be approved to start a run.");
    }

    const [route, vehicle] = (await Promise.all([
      this.client.from("routes")
        .select("routes_id, route_name, stops, route_polyline")
        .eq("routes_id", driver.routes_id)
        .eq("active", true)
        .maybeSingle(),
      this.client.from("vehicles")
        .select("vehicle_id, capacity")
        .eq("driver_id", this.id)
        .eq("routes_id", driver.routes_id)
        .eq("active", true)
        .neq("status", "Decommissioned")
        .order("vehicle_id")
        .limit(1)
        .maybeSingle(),
    ])).map(unwrap);

    if (!Array.isArray(route?.stops) || route.stops.length < 2 ||
      !route.stops.every((stop) => Number.isFinite(stop?.latitude) && Number.isFinite(stop?.longitude))) {
      throw new Error("the assigned route must be active and have at least two valid stops.");
    }
    if (!vehicle) {
      throw new Error("no active vehicle is assigned to this driver on the route.");
    }
    this.route = route;
    this.vehicle = vehicle;
    this.capacity = Math.max(0, Math.min(driver.capacity, vehicle.capacity));
    signal.throwIfAborted();
    this.managed = true;
    await this.setOnline(true);
    this.log(`online on ${route.routes_id} (${route.route_name}), vehicle ${vehicle.vehicle_id}`);
  }

  async setOnline(available) {
    unwrap(await this.client.from("drivers")
      .update({ availability_status: available ? "available" : "offline" })
      .eq("user_id", this.id));
  }

  async setVehicleStatus(status) {
    unwrap(await this.client.from("vehicles")
      .update({ status, active: true })
      .eq("driver_id", this.id)
      .eq("vehicle_id", this.vehicle.vehicle_id));
  }

  async moveTo(point) {
    const update = {
      current_lat: point.latitude,
      current_lng: point.longitude,
      location_updated_at: new Date().toISOString(),
    };
    const results = await Promise.all([
      this.client.from("drivers").update(update).eq("user_id", this.id),
      this.client.from("vehicles").update(update)
        .eq("driver_id", this.id).eq("vehicle_id", this.vehicle.vehicle_id),
    ]);
    results.forEach(unwrap);
  }

  async startRun() {
    const boarded = randomCount(Math.min(3, this.capacity), Math.min(9, this.capacity));
    return unwrap(await this.client.rpc("start_run", { p_boarded: boarded }));
  }

  async advanceRun(run, complete) {
    const alighted = complete ? run.onboard : randomCount(0, Math.min(4, run.onboard));
    const freeSeats = Math.max(0, Math.min(run.capacity, this.capacity) - run.onboard + alighted);
    const boarded = complete ? 0 : randomCount(0, Math.min(5, freeSeats));
    return unwrap(await this.client.rpc("advance_run", {
      p_run_id: run.run_id,
      p_revision: run.revision,
      p_boarded: boarded,
      p_alighted: alighted,
      p_complete: complete,
    }));
  }

  async transition(booking, status) {
    const { error } = await this.client.rpc("transition_booking", {
      p_booking_id: booking.booking_id,
      p_status: status,
    });
    if (!error) {
      return { status, changed: true };
    }

    // A passenger can start or end the trip between the poll and the RPC.
    const current = unwrap(await this.client.from("bookings")
      .select("request_status").eq("booking_id", booking.booking_id).maybeSingle());
    if (current?.request_status === "Completed") {
      this.log(`PARA tapped by passenger (${booking.dropoff_name})`);
      this.bookings.delete(booking.booking_id);
    } else if (current?.request_status === booking.request_status) {
      throw new Error(error.message);
    }
    return { status: current?.request_status, changed: false };
  }

  async serviceBooking(booking, points, finalStop) {
    let status = booking.request_status;
    let pickupIndex = 0;
    if (status === "Arrived") {
      const pickup = bookingPoint(booking, "pickup");
      pickupIndex = points.findIndex((point) => distanceKm(point, pickup) <= BOOKING_RADIUS_KM);
      if (pickupIndex >= 0) {
        const result = await this.transition(booking, "In progress");
        status = result.status;
        if (result.changed) {
          const { data: passenger } = await this.client.from("users").select("name")
            .eq("user_id", booking.user_id).maybeSingle();
          this.log(`picked up ${passenger?.name || "passenger"}`);
        }
      }
    }

    const dropoff = bookingPoint(booking, "dropoff");
    const canComplete = status === "Arrived" || status === "In progress";
    const nearDropoff = points.slice(Math.max(0, pickupIndex))
      .some((point) => distanceKm(point, dropoff) <= BOOKING_RADIUS_KM);
    if (canComplete && (nearDropoff || finalStop)) {
      const completed = await this.transition({ ...booking, request_status: status }, "Completed");
      if (completed.changed) {
        this.log(`PARA at ${nearDropoff ? booking.dropoff_name : finalStop.name}`);
        this.bookings.delete(booking.booking_id);
      }
    }
  }

  async pollBookings(trail, finalStop = null) {
    try {
      const bookings = unwrap(await this.client.from("bookings")
        .select("booking_id, user_id, request_status, pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude, dropoff_name")
        .eq("vehicle_id", this.vehicle.vehicle_id)
        .in("request_status", ["Arrived", "In progress"]));
      const active = new Set(bookings.map((booking) => booking.booking_id));
      const missing = [...this.bookings].filter((id) => !active.has(id));
      if (missing.length) {
        const closed = unwrap(await this.client.from("bookings")
          .select("booking_id, request_status, dropoff_name").in("booking_id", missing));
        for (const booking of closed) {
          if (booking.request_status === "Completed") {
            this.log(`PARA tapped by passenger (${booking.dropoff_name})`);
          }
        }
        for (const id of missing) {
          this.bookings.delete(id);
        }
      }

      // Sample the full distance traveled between writes, including turns on fast ticks.
      const points = [trail[0], ...Array.from(stepsAlong(trail, 0.015), ({ point }) => point)];
      for (const booking of bookings) {
        this.bookings.add(booking.booking_id);
        try {
          await this.serviceBooking(booking, points, finalStop);
        } catch (error) {
          this.log(`could not update booking ${booking.booking_id}: ${error.message}`);
        }
      }
    } catch (error) {
      this.log(`could not poll bookings: ${error.message}`);
    }
  }

  async run() {
    await this.start();
    const stops = this.route.stops;
    const stepKm = (KMH * SPEED * TICK_MS) / 3_600_000;
    for (let loop = 0; loop < LOOPS; loop++) {
      signal.throwIfAborted();
      await this.setVehicleStatus("In Terminal");
      await this.moveTo(stops[0]);
      this.log(`waiting at ${stops[0].name} for ${DWELL_S}s`);
      await wait(DWELL_S * 1000);

      let run = await this.startRun();
      signal.throwIfAborted();
      await this.setVehicleStatus("In transit");
      this.log(`departed with ${run.onboard}/${Math.min(run.capacity, this.capacity)} aboard`);
      await this.pollBookings([stops[0]]);
      for (let i = 1; i < stops.length; i++) {
        signal.throwIfAborted();
        const stop = stops[i];
        const path = await pathBetween(stops[i - 1], stop, signal);
        for (const { point, trail } of stepsAlong(path, stepKm)) {
          signal.throwIfAborted();
          await this.moveTo(point);
          await this.pollBookings(trail);
          await wait(TICK_MS);
        }

        const final = i === stops.length - 1;
        if (!final) {
          await wait(STOP_DWELL_MS);
        }
        await this.pollBookings([stop], final ? stop : null);
        signal.throwIfAborted();
        run = await this.advanceRun(run, final);
        this.log(`${stop.name}: ${final ? "run completed" : `${run.onboard} aboard`}`);
      }
      // Head back to the terminal empty. "Arrived" keeps it off the passenger map
      // (only units running a route are shown) without teleporting it.
      await this.setVehicleStatus("Arrived");
      this.log(`returning to ${stops[0].name}`);
      const back = await pathBetween(stops[stops.length - 1], stops[0], signal);
      for (const { point } of stepsAlong(back, stepKm * 1.5)) {
        signal.throwIfAborted();
        await this.moveTo(point);
        await wait(TICK_MS);
      }
      await this.setVehicleStatus("In Terminal");
    }
  }

  async stop() {
    if (this.managed) {
      const results = await Promise.allSettled([
        this.setOnline(false),
        this.setVehicleStatus("In Terminal"),
      ]);
      for (const result of results) {
        if (result.status === "rejected") {
          this.log(`shutdown update failed: ${result.reason.message}`);
          process.exitCode = 1;
        }
      }
    }
    await this.client.auth.stopAutoRefresh();
    if (this.id) {
      unwrap(await this.client.auth.signOut({ scope: "local" }));
    }
  }
}

function requestShutdown() {
  if (!signal.aborted) {
    console.log("\npuj emulator: parking vehicles and taking drivers offline…");
    shutdown.abort();
  }
}
process.on("SIGINT", requestShutdown);
process.on("SIGTERM", requestShutdown);

console.log(`puj emulator: speed ×${SPEED}, terminal dwell ${DWELL_S}s. Ctrl+C to stop.`);
await Promise.all(accounts.map(async (account) => {
  const jeepney = new EmulatedJeepney(account);
  try {
    await jeepney.run();
  } catch (error) {
    if (!signal.aborted || error.name !== "AbortError") {
      jeepney.log(error.message);
      process.exitCode = 1;
    }
  } finally {
    try {
      await jeepney.stop();
    } catch (error) {
      jeepney.log(`shutdown failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}));
