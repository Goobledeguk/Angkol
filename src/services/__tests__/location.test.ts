import {
  Accuracy,
  PermissionStatus,
  requestForegroundPermissionsAsync,
  watchPositionAsync,
} from "expo-location";
import type { LocationObject, LocationPermissionResponse } from "expo-location";
import { insideServiceArea, startSharing, stopSharing } from "../location";
import { DEFAULT_CENTER } from "../mapbox";
import { db } from "../supabase";
import { now } from "./fixtures";
import { createSupabaseFake, type SupabaseFake } from "./supabaseFake";

jest.mock("../supabase", () => ({ db: jest.fn() }));
jest.mock("expo-location", () => ({
  Accuracy: { High: 4 },
  PermissionStatus: {
    GRANTED: "granted",
    DENIED: "denied",
    UNDETERMINED: "undetermined",
  },
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

const requestPermission = jest.mocked(requestForegroundPermissionsAsync);
const watch = jest.mocked(watchPositionAsync);
let fake: SupabaseFake;

function permission(status: PermissionStatus) {
  return { status } as LocationPermissionResponse;
}

const position: LocationObject = {
  coords: {
    latitude: 12.07,
    longitude: 124.59,
    altitude: null,
    accuracy: 5,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: now - 1000,
};

function vehicleLookup(
  driverId = "driver-1",
  vehicleId?: string,
  error?: string,
) {
  fake.table(
    "vehicles",
    [
      ["select", "vehicle_id"],
      ["eq", "driver_id", driverId],
      ["order", "vehicle_id"],
      ["limit", 1],
      ["maybeSingle"],
    ],
    vehicleId ? { vehicle_id: vehicleId } : null,
    error,
  );
}

function positionWrites(fix: LocationObject, time: number, vehicleId?: string) {
  const { latitude, longitude } = fix.coords;
  const patch = {
    current_lat: latitude,
    current_lng: longitude,
    location_updated_at: new Date(time).toISOString(),
  };
  fake.table("drivers", [
    ["update", patch],
    ["eq", "user_id", "driver-1"],
  ]);
  fake.table("vehicles", [
    ["update", patch],
    ["eq", "driver_id", "driver-1"],
  ]);
  fake.table("vehicle_locations", [
    [
      "insert",
      {
        driver_id: "driver-1",
        latitude,
        longitude,
        ...(vehicleId ? { vehicle_id: vehicleId } : {}),
      },
    ],
  ]);
}

beforeEach(() => {
  jest.useFakeTimers({ now });
  requestPermission
    .mockReset()
    .mockResolvedValue(permission(PermissionStatus.GRANTED));
  watch.mockReset().mockImplementation(async () => ({ remove: jest.fn() }));
  fake = createSupabaseFake();
  jest
    .mocked(db)
    .mockReturnValue(fake.client as unknown as ReturnType<typeof db>);
});

afterEach(async () => {
  await stopSharing();
  jest.useRealTimers();
  fake.verify();
});

test.each([PermissionStatus.DENIED, PermissionStatus.UNDETERMINED])(
  "rejects location permission status %s",
  async (status) => {
    requestPermission.mockResolvedValueOnce(permission(status));
    await expect(startSharing("driver-1")).rejects.toThrow(
      "Location permission is required to share your position.",
    );
    expect(watch).not.toHaveBeenCalled();
    expect(fake.client.from).not.toHaveBeenCalled();
  },
);

it("watches after permission using high accuracy and defined sampling intervals", async () => {
  vehicleLookup();
  await startSharing("driver-1");
  expect(watch).toHaveBeenCalledWith(
    { accuracy: Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
    expect.any(Function),
  );
  expect(requestPermission.mock.invocationCallOrder[0]).toBeLessThan(
    watch.mock.invocationCallOrder[0],
  );
});

test.each([
  ["PUJ-1", undefined],
  [undefined, undefined],
  [undefined, "vehicle lookup failed"],
])(
  "writes driver and vehicle fixes and records the available vehicle ID %p (%p)",
  async (vehicleId, error) => {
    vehicleLookup("driver-1", vehicleId, error);
    positionWrites(position, now, vehicleId);
    await startSharing("driver-1");
    watch.mock.calls[0][1](position);
    await Promise.resolve();
    expect(fake.client.from.mock.calls).toEqual([
      ["vehicles"],
      ["drivers"],
      ["vehicles"],
      ["vehicle_locations"],
    ]);
  },
);

it("throttles every write, ignores small moves and records a fresh fix after thirty seconds", async () => {
  const moved = {
    ...position,
    coords: { ...position.coords, latitude: 12.0702 },
  };
  const jitter = { ...moved, coords: { ...moved.coords, latitude: 12.07021 } };
  vehicleLookup("driver-1", "PUJ-1");
  positionWrites(position, now, "PUJ-1");
  positionWrites(moved, now + 5000, "PUJ-1");
  positionWrites(jitter, now + 35000, "PUJ-1");
  await startSharing("driver-1");
  const callback = watch.mock.calls[0][1];
  const emit = (elapsed: number, fix: LocationObject) => {
    jest.setSystemTime(now + elapsed);
    callback(fix);
  };

  emit(0, position);
  emit(0, moved);
  emit(4999, moved);
  expect(fake.client.from).toHaveBeenCalledTimes(4);
  emit(5000, moved);
  emit(10000, jitter);
  emit(34999, jitter);
  expect(fake.client.from).toHaveBeenCalledTimes(7);
  emit(35000, jitter);
  await stopSharing();
  emit(70000, position);
  expect(fake.client.from).toHaveBeenCalledTimes(10);
});

it("removes the previous watch before starting a replacement and stops the replacement once", async () => {
  const removeFirst = jest.fn();
  const removeSecond = jest.fn();
  watch
    .mockResolvedValueOnce({ remove: removeFirst })
    .mockResolvedValueOnce({ remove: removeSecond });
  vehicleLookup();
  vehicleLookup("driver-2");
  await startSharing("driver-1");
  await startSharing("driver-2");
  expect(removeFirst).toHaveBeenCalledTimes(1);
  expect(removeFirst.mock.invocationCallOrder[0]).toBeLessThan(
    watch.mock.invocationCallOrder[1],
  );
  expect(removeSecond).not.toHaveBeenCalled();
  await stopSharing();
  await stopSharing();
  expect(removeSecond).toHaveBeenCalledTimes(1);
});

it("preserves the current watch if restart permission is denied", async () => {
  const remove = jest.fn();
  watch.mockResolvedValueOnce({ remove });
  vehicleLookup();
  await startSharing("driver-1");
  requestPermission.mockResolvedValueOnce(permission(PermissionStatus.DENIED));
  await expect(startSharing("driver-2")).rejects.toThrow(
    "Location permission is required",
  );
  expect(remove).not.toHaveBeenCalled();
  expect(watch).toHaveBeenCalledTimes(1);
  await stopSharing();
  expect(remove).toHaveBeenCalledTimes(1);
});

it("propagates watch startup errors and allows a subsequent start", async () => {
  const offline = new Error("location unavailable");
  const remove = jest.fn();
  watch.mockRejectedValueOnce(offline).mockResolvedValueOnce({ remove });
  vehicleLookup();
  vehicleLookup();
  await expect(startSharing("driver-1")).rejects.toBe(offline);
  await expect(startSharing("driver-1")).resolves.toBeUndefined();
  await stopSharing();
  expect(remove).toHaveBeenCalledTimes(1);
});

test.each([
  [0.269, true],
  [0.271, false],
  [Number.NaN, false],
])(
  "checks a northward offset of %p degrees against the city service radius",
  (offset, expected) => {
    expect(
      insideServiceArea({
        ...DEFAULT_CENTER,
        latitude: DEFAULT_CENTER.latitude + offset,
      }),
    ).toBe(expected);
  },
);
