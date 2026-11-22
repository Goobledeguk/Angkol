import {
  appCallbacks,
  button,
  fill,
  press,
  setParams,
  setRouteParams,
} from "./screen-mocks";
import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import DriverApp from "../../driver/DriverApp";
import {
  FIXED_NOW,
  makeSnapshot,
  makeTrip,
  makeUser,
  passenger,
  pujDriver,
  tricycleDriver,
} from "../../testing/fixtures";
import type { Snapshot } from "../../types/types";

const base = makeSnapshot();
const [route] = base.routes;
const [request] = base.stopRequests;
const [run] = base.runs!;
const [trip] = base.trips;
const tripLabel =
  /^Calbayog City Hall to Calbayog City Sports Center,.+Completed$/;
const runLabel = /^Calbayog City Hall ↔ Obrero,.+Completed$/;

async function openDriver(
  page = "Dashboard",
  overrides: Partial<Snapshot> = {},
  options: { sharing?: boolean; busy?: boolean; connected?: boolean } = {},
) {
  const { sharing = true, busy = false, connected = true } = options;
  setRouteParams({ screen: page });
  const callbacks = {
    ...appCallbacks(),
    toggleSharing: jest.fn().mockResolvedValue(true),
  };
  await render(
    <DriverApp
      data={makeSnapshot({ user: tricycleDriver, ...overrides })}
      sharing={sharing}
      busy={busy}
      connected={connected}
      notice=""
      {...callbacks}
    />,
  );
  return callbacks;
}

describe("Driver availability", () => {
  test.each([
    [true, true, "You’re online"],
    [true, false, "Reconnecting GPS…"],
    [false, true, "You’re offline"],
    [false, false, "You’re offline"],
  ])(
    "shows the correct status with availability=%p and sharing=%p",
    async (available, sharing, label) => {
      await openDriver(
        "Dashboard",
        { user: { ...tricycleDriver, available } },
        { sharing },
      );
      expect(screen.getByText(label)).toBeOnTheScreen();
      const toggle = screen.getByRole("switch", {
        name: "Driver availability",
      });
      if (available && sharing) {
        expect(toggle).toBeChecked();
      } else {
        expect(toggle).not.toBeChecked();
      }
    },
  );

  it("shows approval status and locks the availability switch for an unverified driver", async () => {
    await openDriver("Dashboard", {
      user: makeUser({ ...tricycleDriver, verified: false }),
    });
    expect(screen.getByText("Awaiting approval")).toBeOnTheScreen();
    expect(screen.queryByText("You’re online")).toBeNull();
    expect(
      screen.getByRole("switch", { name: "Driver availability" }),
    ).toBeDisabled();
  });

  it("offers to enable GPS and keeps availability disabled while it is off", async () => {
    const { toggleSharing } = await openDriver(
      "Dashboard",
      {},
      { sharing: false },
    );
    expect(
      screen.getByRole("switch", { name: "Driver availability" }),
    ).toBeDisabled();
    await press("Enable GPS to go online");
    expect(toggleSharing).toHaveBeenCalledTimes(1);
  });

  it("sends changes to availability from the switch", async () => {
    const { action } = await openDriver();
    await fireEvent.press(
      screen.getByRole("switch", { name: "Driver availability" }),
    );
    expect(action).toHaveBeenCalledWith("/availability", { available: false });
  });

  it("locks availability while the app is busy", async () => {
    await openDriver("Dashboard", {}, { busy: true });
    expect(
      screen.getByRole("switch", { name: "Driver availability" }),
    ).toBeDisabled();
  });

  it("shows the connection warning while using saved data", async () => {
    await openDriver("Dashboard", {}, { connected: false });
    expect(
      screen.getByText("Connection lost. Showing last saved records."),
    ).toBeOnTheScreen();
  });

  it("opens the nearby requests list from the dashboard", async () => {
    await openDriver("Dashboard", {
      trips: [makeTrip({ expires: Date.now() + 10 * 60_000 })],
    });
    await press("See 1 ride request");
    expect(setParams).toHaveBeenCalledWith({
      screen: "Requests",
      run: "",
      trip: "",
    });
  });
});

describe("Driver route", () => {
  it("shows each stop on the assigned route", async () => {
    await openDriver("Route", { user: pujDriver, runs: [], stopRequests: [] });
    for (const stop of route.stops) {
      expect(screen.getByText(stop.name)).toBeOnTheScreen();
    }
    expect(screen.getByTestId("calbayog-map")).toBeOnTheScreen();
  });

  it("shows waiting passengers from the assigned route", async () => {
    await openDriver("Route", {
      user: pujDriver,
      runs: [],
      stopRequests: [
        {
          ...request,
          point: { ...request.point, name: "Market loading area" },
        },
        {
          ...request,
          id: "other",
          routeId: "CB02",
          passenger: "Other route rider",
        },
      ],
    });
    expect(screen.getByText("Waiting for pickup")).toBeOnTheScreen();
    expect(screen.getByText("1 request")).toBeOnTheScreen();
    expect(screen.getByText("Market loading area")).toBeOnTheScreen();
    expect(
      screen.getByText(new RegExp(`^${passenger.name} ·`)),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Other route rider/)).toBeNull();
  });

  it("pluralizes the pickup count when two passengers are waiting on the route", async () => {
    await openDriver("Route", {
      user: pujDriver,
      runs: [],
      stopRequests: [
        request,
        { ...request, id: "second", passenger: "Ben Santos" },
      ],
    });
    expect(screen.getByText("2 requests")).toBeOnTheScreen();
    expect(screen.getByText(/^Ben Santos ·/)).toBeOnTheScreen();
  });

  it("hides the waiting list when the requests belong to another route", async () => {
    await openDriver("Route", {
      user: pujDriver,
      runs: [],
      stopRequests: [{ ...request, routeId: "CB02" }],
    });
    expect(screen.queryByText("Waiting for pickup")).toBeNull();
  });

  it("opens the route browser from the assigned route", async () => {
    await openDriver("Route", { user: pujDriver });
    await press("All routes");
    expect(setParams).toHaveBeenCalledWith({
      screen: "Routes",
      run: "",
      trip: "",
    });
  });
});

describe("Driver records", () => {
  test.each([
    [tricycleDriver, tripLabel, { screen: "Trip", trip: trip.id, run: "" }],
    [pujDriver, runLabel, { screen: "Run complete", trip: "", run: run.id }],
  ] as const)(
    "renders a single record button and opens it for $0.role",
    async (user, label, destination) => {
      await openDriver("Records", { user, trips: [trip], runs: [run] });
      const card = button(label);
      expect(
        within(card)
          .queryAllByRole("button")
          .filter((node) => node !== card),
      ).toHaveLength(0);
      await fireEvent.press(card);
      expect(setParams).toHaveBeenCalledTimes(1);
      expect(setParams).toHaveBeenCalledWith(destination);
    },
  );

  it("opens the assigned route when pressing an in-progress run record", async () => {
    await openDriver("Records", {
      user: pujDriver,
      runs: [{ ...run, status: "In progress", endedAt: null }],
    });
    await press(/^Calbayog City Hall ↔ Obrero,.+In progress$/);
    expect(setParams).toHaveBeenCalledWith({
      screen: "Route",
      run: run.id,
      trip: "",
    });
  });

  it("omits tricycle records assigned to a different driver", async () => {
    await openDriver("Records", {
      trips: [trip, makeTrip({ driverId: "other", pickup: "Other pickup" })],
    });
    expect(button(tripLabel)).toBeOnTheScreen();
    expect(
      screen.queryByRole("button", { name: /^Other pickup to/ }),
    ).toBeNull();
  });

  test.each([
    [tricycleDriver, "Your accepted and completed trips appear here."],
    [
      pujDriver,
      "Your saved trip records appear here after your first departure.",
    ],
  ])("shows the empty state for $0.role", async (user, message) => {
    await openDriver("Records", { user, trips: [], runs: [] });
    expect(screen.getByText(message)).toBeOnTheScreen();
  });
});

describe("Driver earnings", () => {
  test.each([
    [[], "0 trips", "₱0.00"],
    [[trip], "1 trip", "₱17.00"],
    [[trip, { ...trip, id: "second-trip" }], "2 trips", "₱34.00"],
  ] as const)(
    "shows the earnings count and total for %p",
    async (trips, wording, total) => {
      await openDriver("Earnings", { trips: [...trips] });
      const summary = screen.getByText(new RegExp(`^${wording} this week ·`));
      expect(within(summary.parent!).getByText(total)).toBeOnTheScreen();
    },
  );

  it("counts one completed PUJ run as one trip", async () => {
    await openDriver("Earnings", { user: pujDriver, runs: [run] });
    expect(screen.getByText(/^1 trip this week ·/)).toBeOnTheScreen();
  });

  it("excludes cancelled and out-of-window trips from the weekly total", async () => {
    await openDriver("Earnings", {
      trips: [
        trip,
        {
          ...trip,
          id: "old",
          createdAt: new Date(FIXED_NOW - 8 * 86400000).toISOString(),
        },
        { ...trip, id: "cancelled", status: "Cancelled" },
      ],
    });
    expect(screen.getByText(/^1 trip this week ·/)).toBeOnTheScreen();
  });
});

it("sends a trimmed driver support report", async () => {
  const { action } = await openDriver("Support");
  await fill("Driver support details", "  Route issue  ");
  await press("Send report");
  expect(action).toHaveBeenCalledWith("/report", {
    details: "Route issue",
    tripId: null,
  });
});
