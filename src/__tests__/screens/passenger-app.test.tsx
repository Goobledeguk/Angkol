import {
  appCallbacks,
  button,
  fill,
  press,
  setParams,
  setRouteParams,
} from "./screen-mocks";
import { render, screen } from "@testing-library/react-native";
import PassengerApp from "../../passenger/PassengerApp";
import { api } from "../../services/api";
import { currentPoint } from "../../services/location";
import {
  FIXED_NOW,
  makeSnapshot,
  makeTrip,
  passenger,
  tricycleDriver,
} from "../../testing/fixtures";
import type { Snapshot } from "../../types/types";

jest.mock("../../services/location", () => ({ currentPoint: jest.fn() }));

const trip = makeTrip({
  id: "ab12cd34-e567-4890-a123-456789abcdef",
  driverId: tricycleDriver.id,
  driver: tricycleDriver.name,
  plate: tricycleDriver.plate,
  status: "Accepted",
});
const [notification] = makeSnapshot().notifications;
const [landmark] = makeSnapshot().landmarks;
const driverVehicle = makeSnapshot().vehicles.find(
  (vehicle) => vehicle.id === `driver-${tricycleDriver.id}`,
)!;

async function openPassenger(
  page = "Home",
  overrides: Partial<Snapshot> = {},
  options: {
    trip?: string;
    busy?: boolean;
    connected?: boolean;
    notice?: string;
  } = {},
) {
  const { trip: tripId, busy = false, connected = true, notice = "" } = options;
  setRouteParams({ screen: page, ...(tripId ? { trip: tripId } : {}) });
  const callbacks = appCallbacks();
  const props = {
    data: makeSnapshot({ user: passenger, ...overrides }),
    connected,
    notice,
    busy,
    ...callbacks,
  };
  const view = await render(<PassengerApp {...props} />);
  return { ...callbacks, props, ...view };
}

describe("Passenger home and notifications", () => {
  it("greets the passenger by first name", async () => {
    await openPassenger();
    expect(screen.getByText("Maupay nga aga, Maria")).toBeOnTheScreen();
    expect(screen.queryByText(/Maupay nga aga, Maria Dela Cruz/)).toBeNull();
  });

  it("opens the journey from the destination prompt", async () => {
    await openPassenger();
    await press("Enter your destination");
    expect(setParams).toHaveBeenCalledWith({ screen: "Journey", trip: "" });
  });

  it("opens the current ride directly from home", async () => {
    await openPassenger("Home", { trips: [trip] });
    await press(/Your ride is on the way/);
    expect(setParams).toHaveBeenCalledWith({
      screen: "Track ride",
      trip: trip.id,
    });
  });

  test.each([0, 1, 3])(
    "exposes the bell label with %i unread notifications",
    async (count) => {
      const notifications = Array.from({ length: count + 1 }, (_, index) => ({
        ...notification,
        id: `note-${index}`,
        read: index === count,
      }));
      await openPassenger("Home", { notifications });
      expect(
        button(count ? `Notifications, ${count} unread` : "Notifications"),
      ).toBeOnTheScreen();
    },
  );

  it("opens notifications when the bell is pressed", async () => {
    await openPassenger();
    await press("Notifications, 1 unread");
    expect(setParams).toHaveBeenCalledWith({
      screen: "Notifications",
      trip: "",
    });
  });

  it("marks the unread notifications as read", async () => {
    const { action } = await openPassenger("Notifications", {
      notifications: [notification, { ...notification, id: "n-2" }],
    });
    await press("Mark 2 as read");
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith("/notifications/read", {});
  });

  test.each([
    { description: "empty", notifications: [] },
    {
      description: "all read",
      notifications: [{ ...notification, read: true }],
    },
  ])(
    "disables marking notifications when the list is $description",
    async ({ notifications }) => {
      const { action } = await openPassenger("Notifications", {
        notifications,
      });
      expect(button("All caught up")).toBeDisabled();
      await press("All caught up");
      expect(action).not.toHaveBeenCalled();
    },
  );

  it("labels unread messages for accessibility", async () => {
    await openPassenger("Notifications", {
      notifications: [
        notification,
        { ...notification, id: "n-2", message: "Earlier update", read: true },
      ],
    });
    expect(
      screen.getByLabelText(`Unread. ${notification.message}`),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Earlier update")).toBeOnTheScreen();
  });

  it("locks the mark-as-read action while the app is busy", async () => {
    await openPassenger("Notifications", {}, { busy: true });
    expect(button("Mark 1 as read")).toBeDisabled();
  });
});

describe("Passenger tracking and receipt", () => {
  test.each([
    ["unavailable", [], /^The driver’s live location is not available yet/],
    ["fresh", [driverVehicle], /^Driver GPS updated just now/],
    [
      "stale",
      [
        {
          ...driverVehicle,
          location: {
            ...driverVehicle.location,
            updatedAt: FIXED_NOW - 360_000,
          },
          stale: true,
        },
      ],
      /^Driver location is old \(6 min ago\)/,
    ],
  ] as const)(
    "shows the %s driver location hint",
    async (_state, vehicles, hint) => {
      await openPassenger("Track ride", {
        trips: [trip],
        vehicles: [...vehicles],
      });
      expect(screen.getByText(hint)).toBeOnTheScreen();
      expect(screen.getByTestId("calbayog-map")).toBeOnTheScreen();
    },
  );

  it("shows an empty tracking screen when the passenger has no trips", async () => {
    await openPassenger("Track ride", { trips: [] });
    expect(screen.getByText(/^You have no active ride/)).toBeOnTheScreen();
    await press("Back to Home");
    expect(setParams).toHaveBeenCalledWith({ screen: "Home", trip: "" });
  });

  test.each([
    ["Arrived", "View arrival details", "Arrived"],
    ["Completed", "View receipt", "Receipt"],
    ["In progress", "I’ve arrived at my destination", "Drop off"],
  ] as const)(
    "uses the appropriate action for a trip with status %s",
    async (status, label, next) => {
      await openPassenger("Track ride", { trips: [{ ...trip, status }] });
      await press(label);
      expect(setParams).toHaveBeenCalledWith({ screen: next, trip: trip.id });
    },
  );

  it("opens the receipt after a tracked trip becomes completed", async () => {
    const { rerender, props } = await openPassenger("Track ride", {
      trips: [trip],
    });
    await rerender(
      <PassengerApp
        {...props}
        data={{ ...props.data, trips: [{ ...trip, status: "Completed" }] }}
      />,
    );
    expect(setParams).toHaveBeenCalledWith({
      screen: "Receipt",
      trip: trip.id,
    });
  });

  it("shows only the short trip reference on the receipt", async () => {
    await openPassenger("Receipt", {
      trips: [{ ...trip, status: "Completed" }],
    });
    expect(screen.getByText("Trip #AB12CD34")).toBeOnTheScreen();
    expect(screen.queryByText(new RegExp(trip.id))).toBeNull();
  });

  it("rates the selected trip and exposes the stored rating", async () => {
    const { action } = await openPassenger(
      "Receipt",
      {
        trips: [
          makeTrip({ status: "Completed" }),
          { ...trip, status: "Completed", rating: 3 },
        ],
      },
      { trip: trip.id },
    );
    expect(button("Rate 3 out of 5")).toBeSelected();
    await press("Rate 5 out of 5");
    expect(action).toHaveBeenCalledWith(`/trips/${trip.id}/rating`, {
      rating: 5,
    });
  });
});

describe("Passenger journey and support", () => {
  it("sets the pickup from the phone location", async () => {
    jest
      .mocked(currentPoint)
      .mockResolvedValueOnce({ ...landmark, name: "My current pickup" });
    await openPassenger("Journey");
    await press("Use my current location");
    expect(currentPoint).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Meet at My current pickup")).toBeOnTheScreen();
  });

  it("shows the location service's error and leaves the existing pickup", async () => {
    jest
      .mocked(currentPoint)
      .mockRejectedValueOnce(new Error("Location permission was denied."));
    await openPassenger("Journey");
    await press("Use my current location");
    expect(currentPoint).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("Location permission was denied."),
    ).toBeOnTheScreen();
    expect(screen.getByText(`Meet at ${landmark.name}`)).toBeOnTheScreen();
  });

  it("searches for a typed place with a trimmed and encoded query", async () => {
    jest
      .mocked(api)
      .mockResolvedValueOnce([{ ...landmark, name: "Rizal & Gomez" }]);
    await openPassenger("Location search");
    await fill("Search destination", "  Rizal & Gomez ");
    await press("Search places");
    expect(api).toHaveBeenCalledWith("/search?q=Rizal%20%26%20Gomez");
    expect(button("Rizal & Gomez")).toBeOnTheScreen();
  });

  it("disables destination search for a short query", async () => {
    await openPassenger("Location search");
    await fill("Search destination", "  AB ");
    expect(button("Search places")).toBeDisabled();
    await press("Search places");
    expect(api).not.toHaveBeenCalled();
  });

  test.each(["", "    ", "  four  "])(
    "rejects a short support report %p",
    async (details) => {
      const { action } = await openPassenger("Support");
      await fill("Support report details", details);
      expect(button("Send report to administrator")).toBeDisabled();
      await press("Send report to administrator");
      expect(action).not.toHaveBeenCalled();
    },
  );

  test.each([trip.id, undefined])(
    "sends trimmed support text with trip parameter %p",
    async (tripId) => {
      const { action } = await openPassenger(
        "Support",
        { trips: [trip] },
        { trip: tripId },
      );
      await fill("Support report details", "  Missed pickup  ");
      await press("Send report to administrator");
      expect(action).toHaveBeenCalledWith("/report", {
        details: "Missed pickup",
        tripId: tripId ?? null,
      });
      expect(button("Send report to administrator")).toBeDisabled();
    },
  );

  it("keeps the support draft when sending fails", async () => {
    const { action } = await openPassenger("Support");
    action.mockResolvedValueOnce(false);
    await fill("Support report details", "Missed pickup");
    await press("Send report to administrator");
    expect(screen.getByLabelText("Support report details")).toHaveDisplayValue(
      "Missed pickup",
    );
    expect(button("Send report to administrator")).toBeEnabled();
  });
});
