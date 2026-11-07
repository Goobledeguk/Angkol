import { createSampleTrips } from "../services/sampleTrips";
import type { DriverRun, Point, Route, Trip, User } from "../types/types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MINUTE_IN_MS = 60 * 1000;

/** Completed sample trips populate driver records and the existing earnings chart. */
export function createDriverTrips(
  driver: User,
  passenger: User,
  landmarks: Point[],
  referenceTime: number,
): Trip[] {
  const templates = createSampleTrips(passenger, driver, landmarks);
  const trips = Array.from({ length: 7 }, (_, index): Trip => {
    const template = templates[index % 2];
    const completedAt = referenceTime - index * DAY_IN_MS;
    const startedAt = completedAt - (template.minutes + 4) * MINUTE_IN_MS;

    return {
      ...template,
      id: `SAMPLE-DRIVER-TRIP-${index + 1}`,
      createdAt: new Date(startedAt).toISOString(),
      expires: startedAt,
      status: "Completed",
      timestamps: {
        Requested: startedAt,
        Accepted: startedAt + MINUTE_IN_MS,
        Arrived: startedAt + 3 * MINUTE_IN_MS,
        "In progress": startedAt + 4 * MINUTE_IN_MS,
        Completed: completedAt,
      },
      rating: index % 2 === 0 ? 5 : 4,
    };
  });

  return [...trips, { ...templates[2], id: "SAMPLE-DRIVER-CANCELLED" }];
}

/** Fictional PUJ/PUV run totals are derived from passenger counts and route fares. */
export function createDriverRuns(
  driver: User,
  route: Route,
  referenceTime: number,
): DriverRun[] {
  return Array.from({ length: 7 }, (_, index): DriverRun => {
    const endedAt = referenceTime - index * DAY_IN_MS;
    const startedAt = endedAt - 25 * MINUTE_IN_MS;
    const passengers = Math.min(driver.capacity, 5 + (index % 4));

    return {
      id: `SAMPLE-DRIVER-RUN-${index + 1}`,
      driverId: driver.id,
      driver: driver.name,
      plate: driver.plate,
      capacity: driver.capacity,
      routeId: route.id,
      routeName: route.name,
      stops: route.stops,
      fare: route.fare,
      sampleFare: true,
      reference: "Fictional sample run",
      status: "Completed",
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      stopIndex: route.stops.length - 1,
      onboard: 0,
      totalBoarded: passengers,
      cashFares: passengers * route.fare,
      revision: 2,
      events: [
        {
          at: new Date(startedAt).toISOString(),
          stop: route.stops[0].name,
          boarded: passengers,
          alighted: 0,
          onboard: passengers,
          type: "departure",
        },
        {
          at: new Date(endedAt).toISOString(),
          stop: route.stops[route.stops.length - 1].name,
          boarded: 0,
          alighted: passengers,
          onboard: 0,
          type: "complete",
        },
      ],
    };
  });
}
