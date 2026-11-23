import { cleanRoute, joinEnds } from "../routeGeometry";

describe("cleanRoute", () => {
  it("removes a multi-vertex spur near the start that returns within 15 m", () => {
    const start = [0, 0];
    const end = [0.01, 0];
    const coords = [
      start, [-0.0003, 0], [-0.0006, 0.00015],
      [-0.0003, 0.00005], [0.0003, 0.00005], end,
    ];
    expect(cleanRoute(coords)).toEqual([start, [0.0003, 0.00005], end]);
  });

  it("removes a spur near the end when the endpoint falls beside the outbound leg", () => {
    const start = [0, 0];
    const end = [0.0095, 0.00008];
    expect(cleanRoute([start, [0.006, 0], [0.01, 0], end])).toEqual([
      start, [0.006, 0], end,
    ]);
  });

  it("shortcuts a small self-intersecting loop at the segment crossing", () => {
    const start = [-0.01, 0];
    const end = [0.02, -0.001];
    const coords = [
      start, [0, 0], [0.002, 0], [0.002, 0.001],
      [0.001, 0.001], [0.001, -0.001], end,
    ];
    const result = cleanRoute(coords);
    expect(result).toEqual([start, [0, 0], [0.001, 0], [0.001, -0.001], end]);
  });

  it("keeps a legitimate loop over the absolute length limit", () => {
    const coords = [
      [-0.05, 0], [0, 0], [0.004, 0], [0.004, 0.004],
      [0.002, 0.004], [0.002, -0.002], [0.05, -0.002],
    ];
    expect(cleanRoute(coords)).toEqual(coords);
  });

  it("keeps a short loop that accounts for most of the route", () => {
    const coords = [
      [0, 0], [0.002, 0], [0.002, 0.001], [0.001, 0.001], [0.001, -0.0001],
    ];
    expect(cleanRoute(coords)).toEqual(coords);
  });

  it("drops consecutive duplicates and preserves the exact original endpoints", () => {
    const start = [124.59, 12.07];
    const middle = [124.6, 12.08];
    const end = [124.61, 12.09];
    const coords = [start, [...start], middle, [...middle], [...end], end];
    const result = cleanRoute(coords);
    expect(result).toEqual([start, middle, end]);
    expect(result[0]).toBe(start);
    expect(result.at(-1)).toBe(end);
    expect(coords).toHaveLength(6);
  });

  it("keeps both endpoints on a fully retraced path and handles shorter inputs", () => {
    const start = [0, 0];
    const end = [0, 0];
    const result = cleanRoute([start, [0.001, 0], end]);
    expect(result).toEqual([start, end]);
    expect(result[0]).toBe(start);
    expect(result[1]).toBe(end);
    expect(cleanRoute([start, [...start], end])).toEqual([start, end]);
    expect(cleanRoute([start])).toEqual([start]);
    expect(cleanRoute([])).toEqual([]);
  });
});

describe("joinEnds", () => {
  it("trims to segment projections at both ends of the road", () => {
    const start = [0.001, 0.0003];
    const end = [0.009, 0.0003];
    expect(joinEnds(start, [[0, 0], [0.005, 0], [0.01, 0]], end)).toEqual([
      start, [0.001, 0], [0.005, 0], [0.009, 0], end,
    ]);
  });

  it("trims through an early vertex when a later segment passes closest to pickup", () => {
    const start = [0.004, 0];
    const end = [0.008, 0];
    expect(joinEnds(start, [[0, 0], [0.001, 0], [0.005, 0], end], end)).toEqual([
      start, [0.005, 0], end,
    ]);
  });

  it("retains road vertices when the true endpoints are ahead of the road connectors", () => {
    const start = [-0.001, 0];
    const end = [0.011, 0];
    const road = [[0, 0], [0.01, 0]];
    expect(joinEnds(start, road, end)).toEqual([start, ...road, end]);
    expect(joinEnds(start, [], end)).toEqual([start, end]);
  });
});

it("cleans Mapbox directions geometry while preserving the returned distance and duration", async () => {
  jest.replaceProperty(process, "env", {
    ...process.env,
    EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: "pk." + "fake-token".repeat(5),
  });
  const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      routes: [{
        distance: 2700,
        duration: 455,
        geometry: { type: "LineString", coordinates: [[0, 0], [-0.001, 0], [0.01, 0]] },
      }],
    }),
  } as Response);

  try {
    let directions!: typeof import("../mapbox").directions;
    jest.isolateModules(() => {
      ({ directions } = jest.requireActual<typeof import("../mapbox")>("../mapbox"));
    });
    await expect(directions(
      { name: "Pickup", longitude: 0, latitude: 0 },
      { name: "Dropoff", longitude: 0.01, latitude: 0 },
    )).resolves.toEqual({
      distanceKm: 2.7,
      minutes: 8,
      geometry: { type: "LineString", coordinates: [[0, 0], [0.01, 0]] },
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("continue_straight")).toBe("false");
  } finally {
    jest.restoreAllMocks();
  }
});
