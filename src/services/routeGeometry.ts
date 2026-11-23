const SPUR_TOLERANCE_M = 15;
const LOOP_LIMIT_M = 600;
const RAD = Math.PI / 180;

function distance(a: number[], b: number[]) {
  const h =
    Math.sin(((b[1] - a[1]) * RAD) / 2) ** 2 +
    Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) *
      Math.sin(((b[0] - a[0]) * RAD) / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(Math.min(1, h)));
}

function samePoint(a: number[], b: number[]) {
  return a[0] === b[0] && a[1] === b[1];
}

function deduplicate(coords: number[][]) {
  const points = [coords[0]];
  for (let i = 1; i < coords.length - 1; i++) {
    if (!samePoint(points[points.length - 1], coords[i])) {
      points.push(coords[i]);
    }
  }
  const last = coords[coords.length - 1];
  if (points.length > 1 && samePoint(points[points.length - 1], last)) {
    points.pop();
  }
  return [...points, last];
}

function interpolate(a: number[], b: number[], t: number) {
  if (t === 0) {
    return a;
  }
  if (t === 1) {
    return b;
  }
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// Scale longitude locally so the projection uses approximately metric axes.
function projection(point: number[], a: number[], b: number[]) {
  const scale = Math.cos(point[1] * RAD);
  const x = (b[0] - a[0]) * scale;
  const y = b[1] - a[1];
  const lengthSquared = x * x + y * y;
  if (!lengthSquared) {
    return 0;
  }
  return (((point[0] - a[0]) * scale) * x + (point[1] - a[1]) * y) / lengthSquared;
}

function cumulativeLengths(points: number[][]) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]));
  }
  return lengths;
}

function removeSpur(points: number[][]) {
  const lengths = cumulativeLengths(points);
  for (let i = 0; i < points.length - 2; i++) {
    const start = points[i];
    const next = points[i + 1];
    const longitudeScale = Math.cos(start[1] * RAD);
    const latitudeMargin = SPUR_TOLERANCE_M / 111_194;
    const longitudeMargin = latitudeMargin / Math.max(0.000001, longitudeScale);
    for (let j = i + 2; j < points.length; j++) {
      const a = points[j - 1];
      const b = points[j];
      if (start[0] < Math.min(a[0], b[0]) - longitudeMargin ||
        start[0] > Math.max(a[0], b[0]) + longitudeMargin ||
        start[1] < Math.min(a[1], b[1]) - latitudeMargin ||
        start[1] > Math.max(a[1], b[1]) + latitudeMargin) {
        continue;
      }
      const dot = (next[0] - start[0]) * (b[0] - a[0]) * longitudeScale ** 2 +
        (next[1] - start[1]) * (b[1] - a[1]);
      if (dot >= 0) {
        continue;
      }
      const t = Math.max(0, Math.min(1, projection(start, a, b)));
      const gap = distance(start, interpolate(a, b, t));
      const returnAt = lengths[j - 1] + (lengths[j] - lengths[j - 1]) * t;
      if (gap > SPUR_TOLERANCE_M || returnAt - lengths[i] <= 3 * gap) {
        continue;
      }

      // Match the outbound and inbound halves by distance along the path.
      // Checking every vertex also handles a retraced path with several bends.
      let match = j;
      let retraces = true;
      for (let k = i + 1; k < j && lengths[k] <= returnAt; k++) {
        const mirroredAt = returnAt - (lengths[k] - lengths[i]);
        while (match > i + 1 && lengths[match - 1] > mirroredAt) {
          match--;
        }
        const fraction = (mirroredAt - lengths[match - 1]) /
          (lengths[match] - lengths[match - 1]);
        const mirror = interpolate(points[match - 1], points[match], fraction);
        if (distance(points[k], mirror) > SPUR_TOLERANCE_M) {
          retraces = false;
          break;
        }
      }
      if (retraces) {
        return deduplicate([...points.slice(0, i + 1), ...points.slice(j)]);
      }
    }
  }
  return null;
}

function crossing(a: number[], b: number[], c: number[], d: number[]) {
  const x = b[0] - a[0];
  const y = b[1] - a[1];
  const u = d[0] - c[0];
  const v = d[1] - c[1];
  const denominator = x * v - y * u;
  if (denominator === 0) {
    return null;
  }
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const t = (dx * v - dy * u) / denominator;
  const s = (dx * y - dy * x) / denominator;
  if (t < 0 || t > 1 || s < 0 || s > 1) {
    return null;
  }
  return { t, s };
}

function removeLoop(points: number[][]) {
  const lengths = cumulativeLengths(points);
  const limit = Math.min(LOOP_LIMIT_M, lengths[lengths.length - 1] * 0.35);
  for (let i = 0; i < points.length - 3; i++) {
    const a = points[i];
    const b = points[i + 1];
    for (let j = i + 2; j < points.length - 1; j++) {
      const between = lengths[j] - lengths[i + 1];
      if (between >= limit) {
        break;
      }
      const hit = crossing(a, b, points[j], points[j + 1]);
      if (!hit) {
        continue;
      }
      const loopLength = between + (1 - hit.t) * (lengths[i + 1] - lengths[i]) +
        hit.s * (lengths[j + 1] - lengths[j]);
      if (loopLength > 0 && loopLength < limit) {
        return deduplicate([
          ...points.slice(0, i + 1),
          interpolate(a, b, hit.t),
          ...points.slice(j + 1),
        ]);
      }
    }
  }
  return null;
}

export function cleanRoute(coords: number[][]): number[][] {
  if (coords.length < 2) {
    return coords.slice();
  }
  let points = deduplicate(coords);
  while (true) {
    const cleaned = removeSpur(points) ??
      removeSpur(points.slice().reverse())?.reverse() ?? removeLoop(points);
    if (!cleaned) {
      return points;
    }
    points = cleaned;
  }
}

function roadEntry(point: number[], road: number[][]) {
  if (projection(point, road[0], road[1]) <= 0) {
    return { index: 0, point: road[0] };
  }

  let closest = { index: 0, point: road[0] };
  let bestDistance = distance(point, road[0]);
  for (let i = 0; i < road.length - 1; i++) {
    const t = Math.max(0, Math.min(1, projection(point, road[i], road[i + 1])));
    const candidate = interpolate(road[i], road[i + 1], t);
    const gap = distance(point, candidate);
    if (gap < bestDistance) {
      closest = { index: i + t, point: candidate };
      bestDistance = gap;
    }
  }
  return closest;
}

export function joinEnds(
  start: [number, number] | number[],
  road: number[][],
  end: number[],
): number[][] {
  const points = road.length >= 2 ? deduplicate(road) : road;
  if (points.length < 2) {
    return cleanRoute([start, ...points, end]);
  }

  const entry = roadEntry(start, points);
  const exit = roadEntry(end, points.slice().reverse());
  const exitIndex = points.length - 1 - exit.index;
  if (entry.index > exitIndex) {
    return cleanRoute([start, end]);
  }
  return cleanRoute([
    start,
    entry.point,
    ...points.slice(Math.floor(entry.index) + 1, Math.ceil(exitIndex)),
    exit.point,
    end,
  ]);
}
