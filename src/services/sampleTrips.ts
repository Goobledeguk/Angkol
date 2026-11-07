import type { Point, Trip, User } from "../types/types";

/** Fictional past journeys for the passenger trip-history screens. */
export function createSampleTrips(
  passenger: User,
  driver: User,
  landmarks: Point[],
): Trip[] {
  const examples = [
    {
      id: "SAMPLE-TRIP-001",
      pickup: landmarks[0],
      destination: landmarks[1],
      createdAt: "2026-10-16T16:30:00+08:00",
      distance: 2.3,
      minutes: 9,
      fare: 35,
      status: "Completed" as const,
      rating: 5,
    },
    {
      id: "SAMPLE-TRIP-002",
      pickup: landmarks[2],
      destination: landmarks[0],
      createdAt: "2026-10-15T10:15:00+08:00",
      distance: 6.1,
      minutes: 18,
      fare: 66,
      status: "Completed" as const,
      rating: null,
    },
    {
      id: "SAMPLE-TRIP-003",
      pickup: landmarks[1],
      destination: landmarks[0],
      createdAt: "2026-10-14T08:45:00+08:00",
      distance: 2.3,
      minutes: 9,
      fare: 35,
      status: "Cancelled" as const,
      rating: null,
    },
  ];

  return examples.map((example): Trip => {
    const startedAt = Date.parse(example.createdAt);
    const completed = example.status === "Completed";

    return {
      id: example.id,
      pickup: example.pickup.name,
      destination: example.destination.name,
      pickupPoint: example.pickup,
      destinationPoint: example.destination,
      distance: example.distance,
      minutes: example.minutes,
      fare: example.fare,
      geometry: {
        type: "LineString",
        coordinates: [
          [example.pickup.longitude, example.pickup.latitude],
          [example.destination.longitude, example.destination.latitude],
        ],
      },
      fareReference: "Fictional sample fare",
      sampleFare: true,
      expires: startedAt,
      passengerId: passenger.id,
      passenger: passenger.name,
      driverId: driver.id,
      driver: driver.name,
      driverAssociation: driver.association,
      plate: driver.plate,
      pickupNote: "By the main entrance",
      status: example.status,
      createdAt: example.createdAt,
      timestamps: completed
        ? {
            Requested: startedAt,
            Accepted: startedAt + 60_000,
            Arrived: startedAt + 180_000,
            "In progress": startedAt + 240_000,
            Completed: startedAt + (example.minutes + 4) * 60_000,
          }
        : {
            Requested: startedAt,
            Cancelled: startedAt + 120_000,
          },
      rating: example.rating,
    };
  });
}
