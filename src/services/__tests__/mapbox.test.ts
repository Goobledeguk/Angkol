import type { Point } from "../../types/types";
import { destination, geometry, pickup } from "./fixtures";

type Mapbox = typeof import("../mapbox");
const token = "pk." + "fake-test-token+".repeat(4);
const scene = {
  width: 600,
  height: 390,
  view: { latitude: 12.07, longitude: 124.59, zoom: 13 },
};
const straightLine = {
  type: "LineString",
  coordinates: [
    [124.59, 12.07],
    [124.61, 12.09],
  ],
};
let mapbox: Mapbox;
let fetchMock: jest.SpiedFunction<typeof fetch>;

function loadMapbox(value: string) {
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = value;
  let isolated!: Mapbox;
  jest.isolateModules(() => {
    isolated = jest.requireActual<Mapbox>("../mapbox");
  });
  return isolated;
}

function response(json: unknown, ok = true) {
  fetchMock.mockResolvedValueOnce({
    ok,
    json: jest.fn().mockResolvedValue(json),
  } as unknown as Response);
}

function decodePath(url: string) {
  const encoded = decodeURIComponent(
    url.match(/path-5\+0f5d45-0\.95\(([^)]+)\)/)![1],
  );
  const coordinates: number[][] = [];
  let latitude = 0;
  let longitude = 0;
  let index = 0;
  function delta() {
    let value = 0;
    let shift = 0;
    let chunk: number;
    do {
      chunk = encoded.charCodeAt(index++) - 63;
      value |= (chunk & 31) << shift;
      shift += 5;
    } while (chunk >= 32);
    return value & 1 ? ~(value >> 1) : value >> 1;
  }
  while (index < encoded.length) {
    latitude += delta();
    longitude += delta();
    coordinates.push([longitude / 1e5, latitude / 1e5]);
  }
  return coordinates;
}

beforeEach(() => {
  jest.replaceProperty(process, "env", { ...process.env });
  fetchMock = jest
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("Unexpected fetch"));
  mapbox = loadMapbox(`  ${token}  `);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("map viewport and coordinates", () => {
  test.each([
    [[]],
    [[{ ...pickup, latitude: Number.NaN }]],
    [[{ ...pickup, longitude: Infinity }]],
  ])("uses the default viewport for unusable points %p", (points) => {
    expect(mapbox.viewportFor(points)).toStrictEqual({
      latitude: 12.0676,
      longitude: 124.5942,
      zoom: 13,
    });
  });

  it("centers on the single valid point and caps maximum zoom", () => {
    const view = mapbox.viewportFor(
      [pickup, { ...destination, latitude: Infinity }],
      800,
      800,
    );
    expect(view.latitude).toBeGreaterThan(12.07);
    expect(view.latitude - 12.07).toBeLessThan(0.0005);
    expect(view.longitude).toBe(124.59);
    expect(view.zoom).toBe(16);
  });

  it("centers the route bounds and zooms farther out on a narrow image", () => {
    const view = mapbox.viewportFor([pickup, destination], 600, 390);
    const narrow = mapbox.viewportFor([pickup, destination], 100, 390);
    expect(view.latitude).toBeGreaterThan(12.08);
    expect(view.latitude - 12.08).toBeLessThan(0.005);
    expect(view.longitude).toBeCloseTo(124.6, 8);
    expect(view.zoom).toBeGreaterThan(narrow.zoom);
  });

  it("uses finite polar bounds and clamps the minimum zoom", () => {
    const view = mapbox.viewportFor(
      [
        { name: "NW", latitude: 90, longitude: -180 },
        { name: "SE", latitude: -90, longitude: 180 },
      ],
      1,
      1,
    );
    expect(Number.isFinite(view.latitude)).toBe(true);
    expect(view.latitude).toBeGreaterThanOrEqual(0);
    expect(view.longitude).toBe(0);
    expect(view.zoom).toBe(2);
  });

  it("shifts the camera north so the top marker head is not clipped", () => {
    const tall = mapbox.viewportFor([pickup, destination], 600, 2000);
    const short = mapbox.viewportFor([pickup, destination], 600, 160);
    expect(short.latitude).toBeGreaterThan((pickup.latitude + destination.latitude) / 2);
    expect(short.zoom).toBeLessThan(tall.zoom);
  });

  it("maps the center pixel to the camera coordinates", () => {
    const point = mapbox.pointAt(scene.view, 300, 195, 600, 390);
    expect(point.latitude).toBeCloseTo(12.07, 8);
    expect(point.longitude).toBeCloseTo(124.59, 8);
  });

  it("maps a pixel to the east and south of the center in the correct directions", () => {
    const point = mapbox.pointAt(scene.view, 500, 300, 600, 390);
    expect(point.latitude).toBeLessThan(12.07);
    expect(point.longitude).toBeGreaterThan(124.59);
  });

  it("returns zero distance for identical coordinates", () => {
    expect(mapbox.distanceKm(pickup, { ...pickup, name: "Same point" })).toBe(
      0,
    );
  });

  it("gives approximately 111.19 km for one degree at the equator in either direction", () => {
    const west: Point = { name: "West", latitude: 0, longitude: 0 };
    const east: Point = { name: "East", latitude: 0, longitude: 1 };
    expect(mapbox.distanceKm(west, east)).toBeCloseTo(111.1949, 3);
    expect(mapbox.distanceKm(east, west)).toBeCloseTo(111.1949, 3);
  });
});

describe("static map URLs", () => {
  test.each(["", "sk." + "x".repeat(50), "pk.short"])(
    "disables maps for a missing or invalid public token %p",
    (value) => {
      const unconfigured = loadMapbox(value);
      expect(unconfigured.hasMapbox).toBe(false);
      expect(unconfigured.staticMapUrl(scene)).toBeNull();
    },
  );

  it("formats the camera, dimensions, and token without overlays", () => {
    expect(mapbox.hasMapbox).toBe(true);
    expect(mapbox.staticMapUrl(scene)).toBe(
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/124.590000,12.070000,13,0/600x390@2x?access_token=${encodeURIComponent(token)}&logo=false&attribution=false`,
    );
  });

  it("places up to eight markers before the pickup and destination pins", () => {
    const markers = Array.from({ length: 10 }, (_, index) => ({
      ...pickup,
      longitude: 120 + index,
    }));
    const url = mapbox.staticMapUrl({
      ...scene,
      markers,
      pickup,
      destination,
    })!;
    expect(url.match(/pin-s\+0f5d45/g)).toHaveLength(8);
    expect(url).toContain(
      "pin-s+0f5d45(127,12.07),pin-s+14201a(124.59,12.07),pin-s+14201a(124.61,12.09)/",
    );
    expect(url).not.toContain("(128,12.07)");
  });

  it("omits a path with fewer than two coordinates", () => {
    expect(
      mapbox.staticMapUrl({
        ...scene,
        path: { type: "LineString", coordinates: [[124.59, 12.07]] },
      }),
    ).toBe(mapbox.staticMapUrl(scene));
  });

  it("URI-encodes Google's precision-five example in the path overlay", () => {
    const coordinates = [
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ];
    const url = mapbox.staticMapUrl({
      ...scene,
      path: { type: "LineString", coordinates },
    });
    expect(url).toContain(
      "path-5+0f5d45-0.95(_p~iF~ps%7CU_ulLnnqC_mqNvxq%60%40)",
    );
  });

  it("downsamples only as needed to fit the URL budget and keeps both endpoints", () => {
    const coordinates = Array.from({ length: 6001 }, (_, index) => [
      110 + index / 1000,
      10 + index / 2000,
    ]);
    const url = mapbox.staticMapUrl({
      ...scene,
      path: { type: "LineString", coordinates },
      pickup,
      destination,
      markers: [pickup],
    })!;
    expect(url.length).toBeLessThan(8192);
    expect(url).toMatch(
      /pin-s\+0f5d45.*path-5\+0f5d45.*pin-s\+14201a.*pin-s\+14201a/,
    );
    const decoded = decodePath(url);
    expect(decoded.length).toBeGreaterThan(2);
    expect(decoded.length).toBeLessThan(coordinates.length);
    expect(decoded[0]).toEqual(coordinates[0]);
    expect(decoded.at(-1)).toEqual(coordinates.at(-1));
  });
});

describe("directions", () => {
  it("requests driving directions and parses the first route", async () => {
    response({
      routes: [{ distance: 2700, duration: 455, geometry }, { distance: 9999 }],
    });
    await expect(mapbox.directions(pickup, destination)).resolves.toStrictEqual(
      { distanceKm: 2.7, minutes: 8, geometry },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.mapbox.com/directions/v5/mapbox/driving/124.59,12.07;124.61,12.09?geometries=geojson&overview=full&continue_straight=false&access_token=${encodeURIComponent(token)}`,
    );
  });

  it.each([
    {},
    { distance: 1, duration: 10 },
    { distance: -1, duration: -20, geometry: null },
  ])(
    "applies minimum distance and duration and fills in geometry for %p",
    async (route) => {
      response({ routes: [route] });
      await expect(
        mapbox.directions(pickup, destination),
      ).resolves.toStrictEqual({
        distanceKm: 0.1,
        minutes: 1,
        geometry: straightLine,
      });
    },
  );

  it.each([{}, { routes: [] }])(
    "rejects a successful response without a route: %p",
    async (json) => {
      response(json);
      await expect(mapbox.directions(pickup, destination)).rejects.toThrow(
        "No drivable route found",
      );
    },
  );

  it("rejects a non-OK response", async () => {
    response({}, false);
    await expect(mapbox.directions(pickup, destination)).rejects.toThrow(
      "Could not calculate a route",
    );
  });

  it("rejects a network error", async () => {
    const failure = new Error("offline");
    fetchMock.mockRejectedValueOnce(failure);
    await expect(mapbox.directions(pickup, destination)).rejects.toBe(failure);
  });

  it("rejects a missing token before reaching the network", async () => {
    await expect(
      loadMapbox("").directions(pickup, destination),
    ).rejects.toThrow("Mapbox is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("geocoding", () => {
  it("reverse-geocodes a Philippine coordinate and returns the first feature's text", async () => {
    response({ features: [{ text: "Market" }, { text: "Pier" }] });
    await expect(mapbox.reverseGeocode(12.07, 124.59)).resolves.toBe("Market");
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/124.59,12.07.json?limit=1&country=ph&access_token=${encodeURIComponent(token)}`,
    );
  });

  test.each([{}, { features: [] }, { features: [{ place_name: "Market" }] }])(
    "returns no reverse label for %p",
    async (json) => {
      response(json);
      await expect(mapbox.reverseGeocode(12.07, 124.59)).resolves.toBe("");
    },
  );

  it("returns no reverse label for a non-OK response", async () => {
    response({}, false);
    await expect(mapbox.reverseGeocode(12.07, 124.59)).resolves.toBe("");
  });

  it("encodes search text and filters results without a coordinate pair", async () => {
    response({
      features: [
        {
          text: "Market",
          place_name: "Full market name",
          center: [124.59, 12.07],
        },
        { place_name: "Pier", center: [124.61, 12.09] },
        { text: "", center: [0, 0] },
        { text: "Missing center" },
        { text: "Malformed center", center: [124.59] },
      ],
    });
    await expect(mapbox.searchPlaces("Market & Pier")).resolves.toStrictEqual([
      pickup,
      destination,
      { name: "Location", longitude: 0, latitude: 0 },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/Market%20%26%20Pier.json?limit=6&country=ph&proximity=124.5942,12.0676&types=poi,address,place,locality&access_token=${encodeURIComponent(token)}`,
    );
  });

  it("returns an empty search for a response with no features", async () => {
    response({});
    await expect(mapbox.searchPlaces("Market")).resolves.toEqual([]);
  });

  it("returns an empty search for a non-OK response", async () => {
    response({}, false);
    await expect(mapbox.searchPlaces("Market")).resolves.toEqual([]);
  });

  test.each(["", "   "])(
    "skips a network call for blank search text %p",
    async (query) => {
      await expect(mapbox.searchPlaces(query)).resolves.toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("skips geocoding network calls when unconfigured", async () => {
    const unconfigured = loadMapbox("");
    await expect(unconfigured.searchPlaces("Market")).resolves.toEqual([]);
    await expect(unconfigured.reverseGeocode(12.07, 124.59)).resolves.toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each(["search", "reverse"])(
    "propagates network errors from %s geocoding",
    async (kind) => {
      const failure = new Error("offline");
      fetchMock.mockRejectedValueOnce(failure);
      const result =
        kind === "search"
          ? mapbox.searchPlaces("Market")
          : mapbox.reverseGeocode(12.07, 124.59);
      await expect(result).rejects.toBe(failure);
    },
  );
});
