import { createSampleTrips } from "./sampleTrips";
import { createDriverRuns } from "./sampleDriverData";
import type { Snapshot, User } from "./types";

/** Populate administrator screens with one consistent, fictional local dataset. */
export function populateAdministratorSamples(state: Snapshot) {
  const now = state.serverTime;
  const makePerson = (
    id: string,
    name: string,
    role: User["role"],
    index: number,
  ): User => ({
    ...state.user,
    id,
    name,
    role,
    email: `${name.toLowerCase().replaceAll(" ", ".")}@example.invalid`,
    available: role.includes("driver") && index < 3,
    verified: index < 3,
    license: role.includes("driver") ? `N01-23-${456780 + index}` : "",
    association: role.includes("driver")
      ? "Calbayog Transport Cooperative"
      : "",
    plate: role.includes("driver")
      ? role === "PUJ / PUV driver"
        ? `ABC ${1230 + index}`
        : `AB ${12340 + index}`
      : "",
    capacity: role === "PUJ / PUV driver" ? 18 : 3,
    location: role.includes("driver")
      ? {
          ...state.landmarks[index % state.landmarks.length],
          updatedAt: now - (index === 2 ? 420_000 : 15_000),
        }
      : null,
  });
  const passengers = [
    "Isabella Reyes",
    "Camille Navarro",
    "Daniel Cruz",
    "Sofia Garcia",
  ].map((name, index) =>
    makePerson(`sample-passenger-${index}`, name, "Passenger", index),
  );
  const drivers = [
    "Miguel Santos",
    "Rafael Mendoza",
    "Gabriel Torres",
    "Andrea Castillo",
    "Paolo Ramos",
  ].map((name, index) =>
    makePerson(
      `sample-driver-${index}`,
      name,
      index % 2 ? "PUJ / PUV driver" : "Tricycle driver",
      index,
    ),
  );
  state.users = [state.user, ...passengers, ...drivers];
  state.vehicles = drivers
    .filter((driver) => driver.verified)
    .map((driver) => ({
      id: driver.id,
      name: driver.name,
      kind: driver.role,
      plate: driver.plate,
      routeId: driver.routeId,
      capacity: driver.capacity,
      location: driver.location!,
      stale: now - driver.location!.updatedAt > 60_000,
    }));

  const date = new Date(now).toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
  const midnight = Date.parse(`${date}T00:00:00+08:00`);
  const availableTime = Math.max(0, now - midnight - 15 * 60_000);
  const historySpan = Math.min(availableTime, 10 * 60 * 60_000);
  state.trips = Array.from({ length: 16 }, (_, index) => {
    const passenger = passengers[index % passengers.length];
    const driver = drivers[index % 2 === 0 ? 0 : 2];
    const template = createSampleTrips(passenger, driver, state.landmarks)[
      index % 2
    ];
    const startedAt = midnight + availableTime - (index / 15) * historySpan;
    const status =
      index < 2
        ? "Accepted"
        : index === 2
          ? "In progress"
          : index > 13
            ? "Cancelled"
            : "Completed";
    return {
      ...template,
      id: `SAMPLE-BOOKING-${String(index + 1).padStart(3, "0")}`,
      status,
      createdAt: new Date(startedAt).toISOString(),
      rating: status === "Completed" ? 5 : null,
      timestamps: {
        Requested: startedAt,
        ...(status !== "Cancelled"
          ? { Accepted: startedAt + ((index % 4) + 1) * 60_000 }
          : {}),
        ...(status === "Completed"
          ? { Completed: Math.min(now, startedAt + 12 * 60_000) }
          : {}),
        ...(status === "In progress"
          ? { "In progress": startedAt + 5 * 60_000 }
          : {}),
        ...(status === "Cancelled"
          ? { Cancelled: startedAt + 2 * 60_000 }
          : {}),
      },
    };
  });
  state.runs = createDriverRuns(drivers[1], state.routes[0], now);
  state.stopRequests = [
    {
      id: "SAMPLE-PICKUP-001",
      routeId: state.routes[0].id,
      point: state.landmarks[1],
      passenger: passengers[1].name,
      userId: passengers[1].id,
      createdAt: now - 3 * 60_000,
    },
  ];
  state.reports = [
    {
      id: "SAMPLE-REPORT-001",
      details: "Pickup pin was on the opposite side of the market entrance.",
      tripId: state.trips[3].id,
      status: "open",
      reporter: passengers[0].name,
      createdAt: new Date(now - 20 * 60_000).toISOString(),
    },
    {
      id: "SAMPLE-REPORT-002",
      details: "Please review the vehicle plate shown on my trip receipt.",
      tripId: state.trips[4].id,
      status: "reviewing",
      reporter: passengers[1].name,
      createdAt: new Date(now - 35 * 60_000).toISOString(),
    },
    {
      id: "SAMPLE-REPORT-003",
      details: "Driver helped locate my bag after the trip. Issue resolved.",
      tripId: state.trips[5].id,
      status: "resolved",
      reporter: passengers[2].name,
      createdAt: new Date(now - 60 * 60_000).toISOString(),
    },
  ];
  state.logs = [
    "Reviewed driver application",
    "Updated route schedule",
    "Resolved passenger report",
    "Approved vehicle details",
    "Updated sample fare matrix",
    "Recorded completed trip",
  ].map((action, index) => ({
    id: index + 1,
    action,
    actor_id: index === 5 ? drivers[0].id : state.user.id,
    at: new Date(now - (index + 1) * 8 * 60_000).toISOString(),
  }));
  state.sampleMetrics = {
    uptimePercent: 99.8,
    responseMs: 124,
    expiringDocuments: 2,
  };
}
