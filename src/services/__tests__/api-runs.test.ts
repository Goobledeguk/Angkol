import { api } from "../api";
import type { DriverRun } from "../../types/types";
import { setupApiHarness } from "./apiHarness";
import { destination, pickup, timestamp } from "./fixtures";

jest.mock("../supabase", () => ({ db: jest.fn() }));
jest.mock("../mapbox", () => ({ directions: jest.fn() }));

const harness = setupApiHarness();
const stops = [pickup, destination];
const route = {
  routes_id: "r1",
  route_name: "Market loop",
  fare: "14.5",
  stops,
};
const run = {
  run_id: "run-1",
  driver_id: "rider",
  routes_id: "r1",
  route_name: "Market loop",
  plate: "ABC",
  capacity: 4,
  stops,
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

function profile() {
  harness.fake.table(
    "users",
    [["select", "name"], ["eq", "user_id", "rider"], ["maybeSingle"]],
    { name: "Ana" },
  );
}

function startLookups(
  assignedRoute: boolean,
  routeRow: unknown,
  error?: string,
) {
  const driver = assignedRoute
    ? { routes_id: "r1", plate_number: "ABC", capacity: "20" }
    : null;
  harness.fake.table(
    "drivers",
    [
      ["select", "routes_id,plate_number,capacity"],
      ["eq", "user_id", "rider"],
      ["maybeSingle"],
    ],
    driver,
  );
  harness.fake.table(
    "routes",
    [
      ["select", "*"],
      assignedRoute ? ["eq", "routes_id", "r1"] : ["limit", 1],
      ["maybeSingle"],
    ],
    routeRow,
    error,
  );
}

function updateRun(
  patch: Record<string, unknown>,
  event: Record<string, unknown>,
  runRow: Record<string, unknown> = run,
  fresh: boolean = true,
) {
  harness.fake.table("driver_runs", currentRunQuery, runRow);
  expectRunUpdate(patch, runRow.revision ?? 1);
  harness.fake.table("driver_run_events", [["insert", event]]);
  harness.fake.table(
    "driver_runs",
    [
      ["select", "*, driver_run_events(*)"],
      ["eq", "run_id", "run-1"],
      ["maybeSingle"],
    ],
    fresh
      ? {
          ...runRow,
          ...patch,
          driver_run_events: [{ ...event, at: timestamp }],
        }
      : null,
  );
  profile();
}

function expectRunUpdate(
  patch: Record<string, unknown>,
  revision: unknown,
  updated: unknown = { run_id: "run-1" },
) {
  harness.fake.table(
    "driver_runs",
    [
      ["update", patch],
      ["eq", "run_id", "run-1"],
      ["eq", "driver_id", "rider"],
      ["eq", "revision", revision],
      ["eq", "status", "In progress"],
      ["select", "run_id"],
      ["maybeSingle"],
    ],
    updated,
  );
}

describe("starting a driver run", () => {
  it("uses the assigned route and records departure when riders board", async () => {
    startLookups(true, { ...route, reference: "Ordinance" });
    profile();
    const row = {
      driver_id: "rider",
      routes_id: "r1",
      route_name: "Market loop",
      plate: "ABC",
      capacity: 20,
      fare: 14.5,
      reference: "Ordinance",
      status: "In progress",
      stop_index: 0,
      onboard: 2,
      total_boarded: 2,
      cash_fares: 29,
      revision: 1,
      stops,
    };
    const departure = {
      run_id: "run-1",
      stop: "Market",
      boarded: 2,
      alighted: 0,
      onboard: 2,
      type: "departure",
    };
    harness.fake.table(
      "driver_runs",
      [["insert", row], ["select"], ["single"]],
      { ...row, run_id: "run-1", started_at: timestamp },
    );
    harness.fake.table(
      "driver_run_events",
      [["insert", departure], ["select"], ["single"]],
      { ...departure, at: timestamp },
    );
    await expect(
      api<DriverRun>("/runs", { boarded: "2" }),
    ).resolves.toMatchObject({
      id: "run-1",
      driver: "Ana",
      routeId: "r1",
      status: "In progress",
      totalBoarded: 2,
      cashFares: 29,
      revision: 1,
      events: [
        {
          at: timestamp,
          stop: "Market",
          boarded: 2,
          alighted: 0,
          onboard: 2,
          type: "departure",
        },
      ],
    });
    expect(harness.fake.client.from.mock.calls).toEqual([
      ["drivers"],
      ["routes"],
      ["users"],
      ["driver_runs"],
      ["driver_run_events"],
    ]);
  });

  it("uses the first route when the driver has no assigned route and skips an empty departure", async () => {
    startLookups(false, { ...route, stops: null });
    profile();
    const row = {
      driver_id: "rider",
      routes_id: "r1",
      route_name: "Market loop",
      plate: "",
      capacity: 18,
      fare: 14.5,
      reference: "Fare matrix",
      status: "In progress",
      stop_index: 0,
      onboard: 0,
      total_boarded: 0,
      cash_fares: 0,
      revision: 1,
      stops: [],
    };
    harness.fake.table(
      "driver_runs",
      [["insert", row], ["select"], ["single"]],
      { ...row, run_id: "run-1" },
    );
    await expect(api<DriverRun>("/runs")).resolves.toMatchObject({
      routeId: "r1",
      plate: "",
      capacity: 18,
      onboard: 0,
      cashFares: 0,
      stops: [],
      events: [],
    });
  });

  it("returns no events if the departure insert fails for the already-created run", async () => {
    startLookups(false, { ...route, stops: [] });
    profile();
    const row = {
      driver_id: "rider",
      routes_id: "r1",
      route_name: "Market loop",
      plate: "",
      capacity: 18,
      fare: 14.5,
      reference: "Fare matrix",
      status: "In progress",
      stop_index: 0,
      onboard: 1,
      total_boarded: 1,
      cash_fares: 14.5,
      revision: 1,
      stops: [],
    };
    harness.fake.table(
      "driver_runs",
      [["insert", row], ["select"], ["single"]],
      { ...row, run_id: "run-1" },
    );
    harness.fake.table(
      "driver_run_events",
      [
        [
          "insert",
          {
            run_id: "run-1",
            stop: "Terminal",
            boarded: 1,
            alighted: 0,
            onboard: 1,
            type: "departure",
          },
        ],
        ["select"],
        ["single"],
      ],
      null,
      "event insert failed",
    );
    await expect(
      api<DriverRun>("/runs", { boarded: 1 }),
    ).resolves.toMatchObject({ id: "run-1", onboard: 1, events: [] });
  });

  it("rejects starting with no configured route", async () => {
    startLookups(false, null);
    await expect(api("/runs")).rejects.toMatchObject({
      status: 400,
      message: "No route is configured yet.",
    });
  });

  it("surfaces an assigned-route lookup error", async () => {
    startLookups(true, null, "route query failed");
    await expect(api("/runs")).rejects.toMatchObject({
      status: 400,
      message: "route query failed",
    });
  });

  it("rejects negative boarding when starting a run", async () => {
    await expect(api("/runs", { boarded: -1 })).rejects.toMatchObject({
      status: 400,
      message: "Passenger counts must be non-negative whole numbers.",
    });
    expect(harness.fake.client.from).not.toHaveBeenCalled();
  });

  it("rejects departure boarding beyond assigned capacity", async () => {
    harness.fake.table(
      "drivers",
      [
        ["select", "routes_id,plate_number,capacity"],
        ["eq", "user_id", "rider"],
        ["maybeSingle"],
      ],
      { capacity: 3 },
    );
    await expect(api("/runs", { boarded: 4 })).rejects.toMatchObject({
      status: 400,
      message: "Boarding would exceed the vehicle's capacity.",
    });
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
    harness.fake.table(
      "driver_runs",
      currentRunQuery,
      null,
      "run query failed",
    );
    await expect(api("/runs/run-1")).rejects.toMatchObject({
      status: 400,
      message: "run query failed",
    });
  });

  it("advances one stop, updates counts and receipts, and returns the refreshed event", async () => {
    updateRun(
      {
        onboard: 4,
        total_boarded: 8,
        cash_fares: 116,
        stop_index: 1,
        revision: 4,
      },
      {
        run_id: "run-1",
        stop: "Market",
        boarded: 3,
        alighted: 1,
        onboard: 4,
        type: "stop",
      },
    );
    await expect(
      api<DriverRun>("/runs/run-1", { boarded: "3", alighted: "1" }),
    ).resolves.toMatchObject({
      stopIndex: 1,
      onboard: 4,
      totalBoarded: 8,
      cashFares: 116,
      revision: 4,
      driver: "Ana",
      events: [
        {
          at: timestamp,
          stop: "Market",
          boarded: 3,
          alighted: 1,
          onboard: 4,
          type: "stop",
        },
      ],
    });
    expect(harness.fake.client.from.mock.calls).toEqual([
      ["driver_runs"],
      ["driver_runs"],
      ["driver_run_events"],
      ["driver_runs"],
      ["users"],
    ]);
  });

  it("allows everyone to alight and stays at the last stop", async () => {
    updateRun(
      {
        onboard: 0,
        total_boarded: 5,
        cash_fares: 72.5,
        stop_index: 1,
        revision: 4,
      },
      {
        run_id: "run-1",
        stop: "Pier",
        boarded: 0,
        alighted: 2,
        onboard: 0,
        type: "stop",
      },
      { ...run, stop_index: 1 },
    );
    await expect(
      api<DriverRun>("/runs/run-1", { alighted: 2 }),
    ).resolves.toMatchObject({ onboard: 0, stopIndex: 1 });
  });

  test.each([
    [{ boarded: -1 }, "Passenger counts must be non-negative whole numbers."],
    [{ alighted: -1 }, "Passenger counts must be non-negative whole numbers."],
    [{ boarded: 1.5 }, "Passenger counts must be non-negative whole numbers."],
    [
      { boarded: 3, alighted: 3 },
      "More passengers cannot get off than are on board.",
    ],
    [
      { boarded: 4, alighted: 1 },
      "Boarding would exceed the vehicle's capacity.",
    ],
  ])("rejects invalid stop counts %p", async (body, message) => {
    harness.fake.table("driver_runs", currentRunQuery, run);
    await expect(api("/runs/run-1", body)).rejects.toMatchObject({
      status: 400,
      message,
    });
  });

  test.each([{ boarded: 1 }, { action: "complete" }])(
    "rejects updates to a completed run for %p",
    async (body) => {
      harness.fake.table("driver_runs", currentRunQuery, {
        ...run,
        status: "Completed",
      });
      await expect(api("/runs/run-1", body)).rejects.toMatchObject({
        status: 400,
        message: "This run is already completed.",
      });
    },
  );

  it("rejects updates from someone other than the run's driver", async () => {
    harness.fake.table("driver_runs", currentRunQuery, {
      ...run,
      driver_id: "someone-else",
    });
    await expect(api("/runs/run-1")).rejects.toMatchObject({ status: 403 });
  });

  it("rejects a stale revision without updating the run", async () => {
    harness.fake.table("driver_runs", currentRunQuery, run);
    await expect(
      api("/runs/run-1", { revision: 2, boarded: 1 }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("skips writing the event when the run changes before the update", async () => {
    harness.fake.table("driver_runs", currentRunQuery, run);
    expectRunUpdate(
      {
        onboard: 3,
        total_boarded: 6,
        cash_fares: 87,
        stop_index: 1,
        revision: 4,
      },
      3,
      null,
    );
    await expect(
      api("/runs/run-1", { revision: 3, boarded: 1 }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("defaults the stop and revision when a run has no stops or revision", async () => {
    updateRun(
      {
        onboard: 2,
        total_boarded: 5,
        cash_fares: 72.5,
        stop_index: 0,
        revision: 2,
      },
      {
        run_id: "run-1",
        stop: "Stop",
        boarded: 0,
        alighted: 0,
        onboard: 2,
        type: "stop",
      },
      { ...run, stops: null, revision: undefined },
    );
    await expect(api<DriverRun>("/runs/run-1")).resolves.toMatchObject({
      revision: 2,
      stopIndex: 0,
      stops: [],
      events: [{ stop: "Stop" }],
    });
  });

  it("falls back to the original run when the refresh has no row", async () => {
    updateRun(
      {
        onboard: 3,
        total_boarded: 6,
        cash_fares: 87,
        stop_index: 1,
        revision: 4,
      },
      {
        run_id: "run-1",
        stop: "Market",
        boarded: 1,
        alighted: 0,
        onboard: 3,
        type: "stop",
      },
      run,
      false,
    );
    await expect(
      api<DriverRun>("/runs/run-1", { boarded: 1 }),
    ).resolves.toMatchObject({
      revision: 3,
      onboard: 2,
      stopIndex: 0,
      events: [],
    });
  });

  it("surfaces an event write error after the run row is updated", async () => {
    harness.fake.table("driver_runs", currentRunQuery, run);
    expectRunUpdate(
      {
        onboard: 2,
        total_boarded: 5,
        cash_fares: 72.5,
        stop_index: 1,
        revision: 4,
      },
      3,
    );
    harness.fake.table(
      "driver_run_events",
      [
        [
          "insert",
          {
            run_id: "run-1",
            stop: "Market",
            boarded: 0,
            alighted: 0,
            onboard: 2,
            type: "stop",
          },
        ],
      ],
      null,
      "event rejected",
    );
    await expect(api("/runs/run-1")).rejects.toMatchObject({
      status: 400,
      message: "event rejected",
    });
  });

  test.each([
    [{ action: "complete" }, stops, 1, "Pier"],
    [{ status: "Completed" }, [], 0, "Final stop"],
  ])(
    "completes via %p and records the final stop",
    async (body, runStops, stop_index, stop) => {
      updateRun(
        {
          status: "Completed",
          ended_at: timestamp,
          stop_index,
          onboard: 0,
          cash_fares: 72.5,
          revision: 4,
        },
        {
          run_id: "run-1",
          stop,
          boarded: 0,
          alighted: 2,
          onboard: 0,
          type: "complete",
        },
        { ...run, stops: runStops },
      );
      await expect(api<DriverRun>("/runs/run-1", body)).resolves.toMatchObject({
        status: "Completed",
        endedAt: timestamp,
        stopIndex: stop_index,
        onboard: 0,
        totalBoarded: 5,
        cashFares: 72.5,
        revision: 4,
        events: [{ stop, boarded: 0, alighted: 2, type: "complete" }],
      });
    },
  );
});
