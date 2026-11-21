import * as Location from "expo-location";
import {
  currentPoint,
  insideServiceArea,
  isSharing,
  resumeSharing,
  stopSharing,
} from "../location";
import { reverseGeocode } from "../mapbox";
import { db } from "../supabase";
import { createSupabaseFake } from "./supabaseFake";

jest.mock("expo-location", () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

jest.mock("../mapbox", () => {
  const actual = jest.requireActual("../mapbox");
  return { ...actual, reverseGeocode: jest.fn() };
});

jest.mock("../supabase", () => ({ db: jest.fn() }));

const loc = Location as jest.Mocked<typeof Location>;
const geocode = reverseGeocode as jest.MockedFunction<typeof reverseGeocode>;
const supabase = jest.mocked(db);
let fake: ReturnType<typeof createSupabaseFake>;

const position = (latitude: number, longitude: number) =>
  ({ coords: { latitude, longitude } }) as Location.LocationObject;

beforeEach(() => {
  jest.clearAllMocks();
  fake = createSupabaseFake();
  supabase.mockReturnValue(fake.client as unknown as ReturnType<typeof db>);
});

afterEach(async () => {
  await stopSharing();
  fake.verify();
});

function expectVehicleLookup() {
  fake.table("vehicles", [
    ["select", "vehicle_id"],
    ["eq", "driver_id", "driver-1"],
    ["order", "vehicle_id"],
    ["limit", 1],
    ["maybeSingle"],
  ]);
}

describe("insideServiceArea", () => {
  it("accepts points in Calbayog", () => {
    expect(insideServiceArea({ latitude: 12.0676, longitude: 124.5942 })).toBe(
      true,
    );
    expect(insideServiceArea({ latitude: 12.0716, longitude: 124.5661 })).toBe(
      true,
    );
  });

  it("rejects points far outside the city", () => {
    expect(insideServiceArea({ latitude: 14.5995, longitude: 120.9842 })).toBe(
      false,
    );
    expect(insideServiceArea({ latitude: 11.2433, longitude: 125.0048 })).toBe(
      false,
    );
  });
});

describe("currentPoint", () => {
  it("returns the device position named by reverse geocoding", async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);
    loc.getCurrentPositionAsync.mockResolvedValue(position(12.0701, 124.5961));
    geocode.mockResolvedValue("Rosales Boulevard");

    await expect(currentPoint()).resolves.toEqual({
      name: "Rosales Boulevard",
      latitude: 12.0701,
      longitude: 124.5961,
    });
    expect(loc.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 4 });
  });

  it("falls back to a generic name when geocoding fails", async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);
    loc.getCurrentPositionAsync.mockResolvedValue(position(12.0701, 124.5961));
    geocode.mockRejectedValue(new Error("offline"));

    await expect(currentPoint()).resolves.toMatchObject({
      name: "My current location",
    });
  });

  it("falls back to a generic name when geocoding returns nothing", async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);
    loc.getCurrentPositionAsync.mockResolvedValue(position(12.0701, 124.5961));
    geocode.mockResolvedValue("");

    await expect(currentPoint()).resolves.toMatchObject({
      name: "My current location",
    });
  });

  it("explains what to do when permission is denied", async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "denied",
    } as never);

    await expect(currentPoint()).rejects.toThrow(/pick your pickup on the map/);
    expect(loc.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("refuses positions outside the service area", async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);
    loc.getCurrentPositionAsync.mockResolvedValue(position(14.5995, 120.9842));

    await expect(currentPoint()).rejects.toThrow(/outside Calbayog/);
    expect(geocode).not.toHaveBeenCalled();
  });
});

describe("resumeSharing", () => {
  it("does not prompt and reports false without an existing grant", async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue({
      status: "undetermined",
    } as never);

    await expect(resumeSharing("driver-1")).resolves.toBe(false);
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(loc.watchPositionAsync).not.toHaveBeenCalled();
    expect(isSharing()).toBe(false);
  });

  it("starts watching when permission was already granted", async () => {
    expectVehicleLookup();
    loc.getForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);
    loc.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);
    loc.watchPositionAsync.mockResolvedValue({ remove: jest.fn() } as never);

    await expect(resumeSharing("driver-1")).resolves.toBe(true);
    expect(loc.watchPositionAsync).toHaveBeenCalledTimes(1);
    expect(isSharing()).toBe(true);
  });

  it("stopSharing removes the watcher", async () => {
    expectVehicleLookup();
    const remove = jest.fn();
    loc.getForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);
    loc.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);
    loc.watchPositionAsync.mockResolvedValue({ remove } as never);

    await resumeSharing("driver-1");
    await stopSharing();

    expect(remove).toHaveBeenCalledTimes(1);
    expect(isSharing()).toBe(false);
  });
});
