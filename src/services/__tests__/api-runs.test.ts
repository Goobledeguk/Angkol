import { api } from "../api";
import type { DriverRun } from "../../types/types";
import { setupApiHarness } from "./apiHarness";
import { destination, pickup, timestamp } from "./fixtures";

jest.mock("../supabase", () => ({ db: jest.fn() }));
jest.mock("../mapbox", () => ({ directions: jest.fn() }));

const harness = setupApiHarness();
const run = {
  run_id: "run-1",
  driver_id: "rider",
  routes_id: "r1",
  route_name: "Market loop",
  plate: "ABC",
  capacity: 4,
  stops: [pickup, destination],
  fare: "14.5",
  status: "In progress",
  started_at: timestamp,
  stop_index: 0,
  onboard: 2,
  total_boarded: 5,
  cash_fares: 72.5,
  revision: 3,
};
const currentRunQuery = [
  ["select", "*"],
  ["eq", "run_id", "run-1"],
  ["maybeSingle"],
] satisfies Parameters<typeof harness.fake.table>[1];
const advanceArgs = {
  p_run_id: "run-1",
  p_revision: 3,
  p_boarded: 0,
  p_alighted: 0,
  p_complete: false,
};
const conflict = "This run changed. Refresh it before making another update.";

function profile() {
  harness.fake.table(
    "users",
    [["select", "name"], ["eq", "user_id", "rider"], ["maybeSingle"]],
    { name: "Ana" },
  );
}

function driverCapacity(capacity: number) {
  harness.fake.table(
    "drivers",
    [["select", "capacity"], ["eq", "user_id", "rider"], ["maybeSingle"]],
    { capacity },
  );
}

describe("starting a driver run", () => {
  test.each([[undefined, 0], ["2", 2]])(
    "returns the run and departure event from the RPC for %p passengers",
    async (input, boarded) => {
      const event = {
        at: timestamp,
        stop: "Market",
        boarded,
        alighted: 0,
        onboard: boarded,
        type: "departure",
      };
      driverCapacity(4);
      harness.fake.rpc("start_run", [{ p_boarded: boarded }], {
        ...run,
        onboard: boarded,
        total_boarded: boarded,
        cash_fares: boarded * 14.5,
        revision: 1,
        driver_run_events: [event],
      });
      profile();
      await expect(api<DriverRun>("/runs", { boarded: input })).resolves.toMatchObject({
        id: "run-1",
        driver: "Ana",
        routeId: "r1",
        routeName: "Market loop",
        onboard: boarded,
        totalBoarded: boarded,
        cashFares: boarded * 14.5,
        revision: 1,
        events: [event],
      });
      expect(harness.fake.client.from.mock.calls).toEqual([["drivers"], ["users"]]);
    },
  );

  test.each([
    "No route is assigned to you yet.",
    "Only approved drivers can start a run.",
    "You already have a run in progress.",
    "departure event rejected",
  ])("surfaces the start RPC error %s", async (message) => {
    driverCapacity(4);
    harness.fake.rpc("start_run", [{ p_boarded: 0 }], null, message);
    await expect(api("/runs")).rejects.toMatchObject({ status: 400, message });
    expect(harness.fake.client.from.mock.calls).toEqual([["drivers"]]);
  });

  it("rejects negative boarding when starting a run", async () => {
    await expect(api("/runs", { boarded: -1 })).rejects.toMatchObject({
      status: 400,
      message: "Passenger counts must be non-negative whole numbers.",
    });
    expect(harness.fake.client.from).not.toHaveBeenCalled();
    expect(harness.fake.client.rpc).not.toHaveBeenCalled();
  });

  it("rejects departure boarding beyond assigned capacity", async () => {
    driverCapacity(3);
    await expect(api("/runs", { boarded: 4 })).rejects.toMatchObject({
      status: 400,
      message: "Boarding would exceed the vehicle's capacity.",
    });
    expect(harness.fake.client.rpc).not.toHaveBeenCalled();
  });
});

describe("progressing a driver run", () => {
  it("rejects a missing record", async () => {
    harness.fake.table("driver_runs", currentRunQuery);
    await expect(api("/runs/run-1", { boarded: 3 })).rejects.toMatchObject({
      status: 404,
      message: "Trip record not found.",
    });
  });

  it("surfaces the run lookup error", async () => {
    harness.fake.table("driver_runs", currentRunQuery, null, "run query failed");
    await expect(api("/runs/run-1")).rejects.toMatchObject({
      status: 400,
      message: "run query failed",
    });
  });

  it("returns the server's counts, revision and events from the advance RPC", async () => {
    const departure = {
      at: timestamp,
      stop: "Market",
      boarded: 2,
      alighted: 0,
      onboard: 2,
      type: "departure",
    };
    const stop = {
      at: "2026-05-06T07:12:09.000Z",
      stop: "Pier",
      boarded: 3,
      alighted: 1,
      onboard: 4,
      type: "stop",
    };
    harness.fake.table("driver_runs", currentRunQuery, run);
    harness.fake.rpc("advance_run", [{ ...advanceArgs, p_boarded: 3, p_alighted: 1 }], {
      ...run,
      stop_index: 1,
      onboard: 4,
      total_boarded: 8,
      cash_fares: 116,
      revision: 4,
      driver_run_events: [stop, departure],
    });
    profile();
    await expect(
      api<DriverRun>("/runs/run-1", { revision: 3, boarded: "3", alighted: "1" }),
    ).resolves.toMatchObject({
      driver: "Ana",
      stopIndex: 1,
      onboard: 4,
      totalBoarded: 8,
      cashFares: 116,
      revision: 4,
      events: [departure, stop],
    });
    expect(harness.fake.client.from.mock.calls).toEqual([["driver_runs"], ["users"]]);
  });

  test.each([
    [{ boarded: -1 }, "Passenger counts must be non-negative whole numbers."],
    [{ alighted: -1 }, "Passenger counts must be non-negative whole numbers."],
    [{ boarded: 1.5 }, "Passenger counts must be non-negative whole numbers."],
    [{ boarded: 3, alighted: 3 }, "More passengers cannot get off than are on board."],
    [{ boarded: 4, alighted: 1 }, "Boarding would exceed the vehicle's capacity."],
  ])("rejects invalid stop counts %p", async (body, message) => {
    harness.fake.table("driver_runs", currentRunQuery, run);
    await expect(api("/runs/run-1", body)).rejects.toMatchObject({ status: 400, message });
    expect(harness.fake.client.rpc).not.toHaveBeenCalled();
  });

  test.each([{ boarded: 1 }, { action: "complete" }])(
    "rejects updates to a completed run for %p",
    async (body) => {
      harness.fake.table("driver_runs", currentRunQuery, { ...run, status: "Completed" });
      await expect(api("/runs/run-1", body)).rejects.toMatchObject({
        status: 400,
        message: "This run is already completed.",
      });
    },
  );

  it("rejects updates from someone other than the run's driver", async () => {
    harness.fake.table("driver_runs", currentRunQuery, { ...run, driver_id: "someone-else" });
    await expect(api("/runs/run-1")).rejects.toMatchObject({
      status: 403,
      message: "Only the assigned driver can update this run.",
    });
  });

  it("rejects a stale client revision before calling the RPC", async () => {
    harness.fake.table("driver_runs", currentRunQuery, run);
    await expect(
      api("/runs/run-1", { revision: 2, boarded: 1 }),
    ).rejects.toMatchObject({ status: 409, message: conflict });
    expect(harness.fake.client.rpc).not.toHaveBeenCalled();
  });

  it("returns a 409 when the revision changes after the client check", async () => {
    harness.fake.table("driver_runs", currentRunQuery, run);
    harness.fake.rpc("advance_run", [advanceArgs], null, { code: "40001", message: conflict });
    await expect(api("/runs/run-1")).rejects.toMatchObject({ status: 409, message: conflict });
  });

  it("uses the default revision for an older row and surfaces an event failure", async () => {
    harness.fake.table("driver_runs", currentRunQuery, { ...run, revision: undefined });
    harness.fake.rpc("advance_run", [{ ...advanceArgs, p_revision: 1 }], null, "stop event rejected");
    await expect(api("/runs/run-1")).rejects.toMatchObject({
      status: 400,
      message: "stop event rejected",
    });
  });

  test.each([{ action: "complete", revision: 3 }, { status: "Completed" }])(
    "completes via %p and returns the final event",
    async (body) => {
      const event = {
        at: timestamp,
        stop: "Pier",
        boarded: 0,
        alighted: 2,
        onboard: 0,
        type: "complete",
      };
      harness.fake.table("driver_runs", currentRunQuery, run);
      harness.fake.rpc("advance_run", [{ ...advanceArgs, p_alighted: 2, p_complete: true }], {
        ...run,
        status: "Completed",
        ended_at: timestamp,
        onboard: 0,
        stop_index: 1,
        revision: 4,
        driver_run_events: [event],
      });
      profile();
      await expect(api<DriverRun>("/runs/run-1", body)).resolves.toMatchObject({
        status: "Completed",
        endedAt: timestamp,
        stopIndex: 1,
        onboard: 0,
        totalBoarded: 5,
        cashFares: 72.5,
        revision: 4,
        events: [event],
      });
    },
  );
});
