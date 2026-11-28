import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MapGestures } from "./mapGestures";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { MapProps } from "./mapTypes";
import type { Point, Vehicle } from "../types/types";
import { DEFAULT_CENTER, distanceKm } from "../services/mapbox";
import { glyphShapes } from "../common/Glyph";
import roads from "./roads.json";
import { roadKey } from "./roadKey";
import { cleanRoute, joinEnds } from "../services/routeGeometry";
import {
  EARTH_M,
  cameraAt,
  fitCamera,
  hasTiles,
  mercX,
  mercY,
  pointAtScreen,
  scaleOf,
  tilesFor,
  zoomAbout,
  type Camera,
} from "./geo";

/** Sample lines snapped to real roads ahead of time (scripts/capture/roads.mjs). */
const onRoads = (coords: number[][]) => (roads as Record<string, number[][]>)[roadKey(coords)];

const INK = "#14201A";
const PAPER = "#EDF2EE";
const GRID = "#E0E8E2";
const BRAND = "#0F5D45";
const MUTED = "#66726B";
const ME = "#1C6FD1";
const FALLBACK: Point = { name: "", ...DEFAULT_CENTER };
/** Overlay drawn this far past each edge so panning never reveals a blank border. */
const BLEED = 0.6;

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const labelWidth = (text: string, size: number) => text.length * size * 0.56 + 4;

type Placed = { x: number; y: number; text: string; color: string; size: number };

/**
 * Greedy label placement: try above, below, right and left of the mark and
 * keep the first spot that stays in frame and clears everything placed so far.
 * Required labels (pickup, drop-off) fall back to a clamped spot; context
 * labels are dropped rather than drawn on top of something.
 */
function placeLabels(
  items: { at: { x: number; y: number }; text: string; color?: string; size?: number; gap?: number; required?: boolean }[],
  taken: Box[],
  width: number,
  height: number,
): Placed[] {
  const placed: Placed[] = [];
  for (const item of items) {
    const size = item.size ?? 11;
    const w = labelWidth(item.text, size);
    const h = size + 4;
    const gap = item.gap ?? 12;
    const { x, y } = item.at;
    const spots: Box[] = [
      { x: x - w / 2, y: y - gap - h, w, h },
      { x: x - w / 2, y: y + gap, w, h },
      { x: x + gap, y: y - h / 2, w, h },
      { x: x - gap - w, y: y - h / 2, w, h },
    ];
    const fits = (b: Box) => b.x >= 4 && b.y >= 4 && b.x + b.w <= width - 4 && b.y + b.h <= height - 30;
    let spot = spots.find((b) => fits(b) && !taken.some((t) => overlaps(b, t)));
    if (!spot && item.required) {
      const b = spots[0];
      spot = {
        ...b,
        x: Math.min(Math.max(4, b.x), width - 4 - w),
        y: Math.min(Math.max(4, b.y), height - 30 - h),
      };
    }
    if (!spot) {
      continue;
    }
    taken.push(spot);
    placed.push({ x: spot.x + 2, y: spot.y + h - 4, text: item.text, color: item.color ?? INK, size });
  }
  return placed;
}

function niceDistance(maxMeters: number) {
  const steps = [20, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  return [...steps].reverse().find((m) => m <= maxMeters) ?? 20;
}

/** A label with a white halo so it reads over the route line and streets. */
function Label({ x, y, text, color = INK, anchor = "middle", size = 11 }: { x: number; y: number; text: string; color?: string; anchor?: "start" | "middle" | "end"; size?: number }) {
  const common = { x, y, fontFamily: "ArchivoCond", fontSize: size, letterSpacing: 0.6, textAnchor: anchor } as const;
  return (
    <G>
      <SvgText {...common} stroke="#FFFFFF" strokeWidth={4} strokeLinejoin="round" fill="#FFFFFF">
        {text}
      </SvgText>
      <SvgText {...common} fill={color}>
        {text}
      </SvgText>
    </G>
  );
}

/** A standing person in a round badge: the passenger, or the phone's own position. */
function PersonMark({ x, y, color, halo }: { x: number; y: number; color: string; halo?: boolean }) {
  return (
    <G>
      {halo ? <Circle cx={x} cy={y} r={24} fill={color} opacity={0.16} /> : null}
      <Circle cx={x} cy={y} r={14} fill={color} stroke="#FFFFFF" strokeWidth={3} />
      <G transform={`translate(${x - 8.4} ${y - 8.6}) scale(0.7)`} fill="none" stroke="#FFFFFF" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
        {glyphShapes("person")}
      </G>
    </G>
  );
}


/**
 * Angkol's map. Mapbox street tiles (or plain paper without a token) with our
 * own route, stops, vehicles and people drawn on top. Drag to move, pinch or
 * double-tap to zoom, mouse wheel on the web. In pinpoint mode the pin stays
 * in the middle and the map moves under it.
 */
export default function RouteDiagram({
  height = 300,
  mode,
  pickup,
  destination,
  pickupLabel,
  destinationLabel,
  geometry,
  vehicles,
  terminals,
  stops,
  landmarks,
  me,
  pickupIsPerson = true,
  track = false,
  recenterKey,
  onSelect,
  onVehiclePress,
}: MapProps) {
  const window = useWindowDimensions();
  const [width, setWidth] = useState(Math.max(280, window.width - 40));

  // ------------------------------------------------------------ what to show
  // Keep only real [longitude, latitude] pairs. A malformed or half-loaded
  // geometry should fall back to the pickup→drop-off line, never hide the route.
  const given = (geometry?.coordinates ?? []).filter(
    (c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]),
  );
  // A driver on the way to a pickup has no destination yet. Use the driver's
  // current position as the other end so the approach line stays visible.
  const approachEnd =
    !destination && pickup && vehicles?.length === 1 ? vehicles[0].location : null;
  const routeEnd = destination ?? approachEnd;
  const snapped =
    given.length >= 2
      ? onRoads(given)
      : pickup && routeEnd
        ? onRoads([[pickup.longitude, pickup.latitude], [routeEnd.longitude, routeEnd.latitude]])
        : undefined;
  const ends =
    given.length >= 2
      ? given
      : pickup && routeEnd
        ? [[pickup.longitude, pickup.latitude], [routeEnd.longitude, routeEnd.latitude]]
        : [];
  // Join the road to the real pickup and drop-off without doubling back, and drop
  // the small loops and U-turn spurs routing services sometimes return.
  // Routing services snap the ends to a road, which can overshoot the real spot and hook back.
  const startAt = pickup ? [pickup.longitude, pickup.latitude] : ends[0];
  const endAt = routeEnd ? [routeEnd.longitude, routeEnd.latitude] : ends[ends.length - 1];
  const path = snapped
    ? joinEnds(startAt, snapped, endAt)
    : given.length >= 2
      ? pickup && routeEnd
        ? joinEnds(startAt, given, endAt)
        : cleanRoute(given)
      : given;
  const line: Point[] = path.map(([longitude, latitude]) => ({ name: "", latitude, longitude }));
  // While tracking one driver, drop the stretch they have already driven so the
  // route clears behind them instead of lingering once the path is taken.
  const trackingVehicle = track && vehicles?.length === 1 ? vehicles?.[0] : null;
  let drawLine = line;
  if (trackingVehicle && line.length > 2) {
    const here = trackingVehicle.location;
    let nearest = 0;
    let nearestKm = Infinity;
    for (let i = 0; i < line.length; i += 1) {
      const km = distanceKm(here, line[i]);
      if (km < nearestKm) {
        nearestKm = km;
        nearest = i;
      }
    }
    if (nearestKm <= 0.35) {
      drawLine = line.slice(nearest);
    }
  }
  const anchor = pickup ?? destination ?? me ?? line[0] ?? FALLBACK;
  const nearby = (vehicles ?? []).filter((v) => distanceKm(anchor, v.location) <= 3);
  const editing = mode === "pickup" ? pickup : mode === "destination" ? destination : null;

  const focus: Point[] = [
    ...(pickup ? [pickup] : []),
    ...(routeEnd ? [routeEnd] : []),
    ...line,
    ...(terminals ?? []).map((t) => t.point),
    ...(stops ?? []).map((s) => s.point),
    ...nearby.map((v) => v.location),
    ...(!pickup && !destination && !line.length && me ? [me] : []),
  ];
  const pad = Math.max(46, Math.min(width, height) * 0.18);
  const fitted = (): Camera =>
    mode
      ? cameraAt(editing ?? pickup ?? me ?? FALLBACK, 16.2)
      : fitCamera(focus.length ? focus : [anchor], width, height, pad, FALLBACK);

  // The camera only re-frames itself when the subject changes (a new pickup,
  // drop-off, route or vehicle set), never while the person is exploring.
  const at = (p?: Point | null) => (p ? `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}` : "-");
  const subject = mode
    ? `pin:${mode}:${recenterKey ?? ""}`
    : [
        at(pickup),
        at(destination),
        given.length,
        at(line[0]),
        at(line[Math.floor(line.length / 2)]),
        at(line[line.length - 1]),
        (terminals ?? []).map((t) => t.id).join(","),
        (stops ?? []).map((s) => s.id).join(","),
        nearby.map((v) => v.id).sort().join(","),
        Math.round(width),
        height,
      ].join("|");
  const [cam, setCam] = useState<Camera>(fitted);
  const [gestures] = useState(() => new MapGestures());
  const moved = useRef(false);
  const lastSubject = useRef(subject);
  const trackKey = track ? focus.map(at).join(";") : "";
  useEffect(() => {
    if (gestures.active) {
      // Never yank the map out from under a finger; the next update re-frames.
      return;
    }
    if (lastSubject.current !== subject) {
      lastSubject.current = subject;
      moved.current = false;
      setCam(fitted());
    } else if (track && !moved.current) {
      setCam(fitted());
    }
    // `fitted` reads the same inputs that make up `subject` and `trackKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, trackKey]);

  // ------------------------------------------------------------ gestures
  const frame = useRef<React.ComponentRef<typeof View>>(null);
  const commit = (next: Camera, userMoved: boolean) => {
    if (userMoved) {
      moved.current = true;
    }
    setCam(next);
  };
  const measure = () => {
    frame.current?.measureInWindow?.((x: number, y: number) => gestures.setOrigin(x, y));
  };
  useLayoutEffect(() => {
    gestures.sync({ cam, width, height, mode, vehicles: vehicles ?? [], onSelect, onVehiclePress, commit, measure });
  });
  // Clear the live transform in the same frame the committed camera is drawn.
  useLayoutEffect(() => {
    gestures.reset();
  }, [cam, gestures]);

  // Mouse wheel / trackpad zoom on the web.
  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }
    const node = frame.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) {
      return;
    }
    let latest: Camera | null = null;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      gestures.setOrigin(rect.left, rect.top);
      const fx = event.clientX - rect.left - rect.width / 2;
      const fy = event.clientY - rect.top - rect.height / 2;
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0025));
      moved.current = true;
      setCam((current) => {
        latest = zoomAbout(current, factor, fx, fy);
        return latest;
      });
      if (latest) {
        gestures.settleLater(latest);
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheel);
      gestures.cancelPending();
    };
  }, [gestures]);

  const zoomBy = (factor: number) => {
    gestures.cancelPending();
    gestures.settle(zoomAbout(cam, factor, 0, 0));
  };
  const recenter = () => {
    gestures.cancelPending();
    moved.current = false;
    if (mode && me) {
      gestures.settle(cameraAt(me, 16.4));
      moved.current = false;
    } else {
      setCam(fitted());
    }
  };

  // ------------------------------------------------------------ drawing
  const scale = scaleOf(cam.zoom);
  const bleedX = width * BLEED;
  const bleedY = height * BLEED;
  // Overlay coordinates: frame coordinates shifted by the bleed.
  const px = (p: Point) => ({
    x: bleedX + width / 2 + (mercX(p.longitude) - cam.cx) * scale,
    y: bleedY + height / 2 + (mercY(p.latitude) - cam.cy) * scale,
  });
  const inside = (p: { x: number; y: number }) =>
    p.x > -20 && p.x < width + bleedX * 2 + 20 && p.y > -20 && p.y < height + bleedY * 2 + 20;
  const inFrame = (p: { x: number; y: number }) =>
    p.x > bleedX - 10 && p.x < bleedX + width + 10 && p.y > bleedY - 10 && p.y < bleedY + height + 10;
  const toFrame = (p: { x: number; y: number }) => ({ x: p.x - bleedX, y: p.y - bleedY });

  const center = pointAtScreen(cam, width / 2, height / 2, width, height);
  const metersPerPx = (EARTH_M * Math.cos((center.latitude * Math.PI) / 180)) / scale;
  const scaleMeters = niceDistance(metersPerPx * 90);
  const scalePx = scaleMeters / metersPerPx;

  const routePts =
    drawLine.length >= 2
      ? drawLine.map(px)
      : line.length >= 2
        ? []
        : pickup && routeEnd && !mode
          ? [px(pickup), px(routeEnd)]
          : [];
  const routeD = routePts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const routeIsGuess = line.length < 2;

  const tiles = tilesFor(cam, width, height, Math.max(bleedX, bleedY));
  const W = width + bleedX * 2;
  const H = height + bleedY * 2;
  const grid: React.ReactNode[] = [];
  if (!hasTiles) {
    const step = 32;
    const offX = ((((width / 2 - cam.cx * scale) % step) + step) % step);
    const offY = ((((height / 2 - cam.cy * scale) % step) + step) % step);
    for (let x = offX; x < W; x += step) {
      grid.push(<Line key={`gx${x.toFixed(1)}`} x1={x} y1={0} x2={x} y2={H} stroke={GRID} strokeWidth={1} />);
    }
    for (let y = offY; y < H; y += step) {
      grid.push(<Line key={`gy${y.toFixed(1)}`} x1={0} y1={y} x2={W} y2={y} stroke={GRID} strokeWidth={1} />);
    }
  }

  // The street basemap already names places, so landmark labels only appear on the plain map.
  const context = hasTiles ? [] : [...(landmarks ?? [])].filter((p) => p.name !== pickup?.name && p.name !== destination?.name);

  // Labels are placed in frame coordinates; marks claim their space first.
  const taken: Box[] = [];
  const claim = (p: { x: number; y: number }, r: number) => {
    const f = toFrame(p);
    taken.push({ x: f.x - r, y: f.y - r, w: r * 2, h: r * 2 });
  };
  const showPickup = pickup && !(mode === "pickup");
  const showDestination = destination && !(mode === "destination");
  const pickupAt = showPickup ? px(pickup) : null;
  const destinationAt = showDestination ? px(destination) : null;
  const meAt = me ? px(me) : null;
  if (pickupAt && inFrame(pickupAt)) {claim(pickupAt, 15);}
  if (destinationAt && inFrame(destinationAt)) {claim(destinationAt, 10);}
  if (meAt && inFrame(meAt)) {claim(meAt, 15);}
  (terminals ?? []).forEach((t) => claim(px(t.point), 13));
  (stops ?? []).forEach((st) => claim(px(st.point), 7));
  const marks = (vehicles ?? []).map((v) => ({ v, at: px(v.location) })).filter(({ at: p }) => inside(p));
  marks.filter(({ at: p }) => inFrame(p)).forEach(({ at: p }) => claim(p, 17));
  taken.push({ x: 0, y: height - 34, w: 120, h: 34 }, { x: width - 52, y: 0, w: 52, h: 140 });
  const required = placeLabels(
    [
      ...(pickupAt && inFrame(pickupAt)
        ? [{ at: toFrame(pickupAt), text: (pickupLabel || pickup!.name).toUpperCase(), required: true, gap: 18 }]
        : []),
      ...(destinationAt && inFrame(destinationAt)
        ? [{ at: toFrame(destinationAt), text: (destinationLabel || destination!.name).toUpperCase(), required: true }]
        : []),
    ],
    taken,
    width,
    height,
  );
  const tags = marks.map(({ v, at: p }) => {
    if (!v.plate || !inFrame(p)) {
      return { v, at: p, tag: null };
    }
    const f = toFrame(p);
    const w = v.plate.length * 7.4 + 10;
    const spots = [
      { x: f.x + 18, y: f.y - 26, w, h: 17 },
      { x: f.x - 18 - w, y: f.y - 26, w, h: 17 },
      { x: f.x + 18, y: f.y + 9, w, h: 17 },
      { x: f.x - 18 - w, y: f.y + 9, w, h: 17 },
    ];
    const tag = spots.find((b) => b.x >= 2 && b.x + b.w <= width - 2 && b.y >= 2 && !taken.some((t) => overlaps(b, t)));
    if (tag) {
      taken.push(tag);
    }
    return { v, at: p, tag: tag ? { ...tag, x: tag.x + bleedX, y: tag.y + bleedY } : null };
  });
  const labels = [
    ...required,
    ...placeLabels(
      [
        ...(terminals ?? [])
          .map((t) => ({ at: px(t.point), text: t.name.toUpperCase(), gap: 16 }))
          .filter(({ at: p }) => inFrame(p))
          .map((l) => ({ ...l, at: toFrame(l.at) })),
        ...context
          .map((p) => ({ at: px(p), text: p.name.toUpperCase(), color: MUTED, size: 10, gap: 7 }))
          .filter(({ at: p }) => inFrame(p))
          .map((l) => ({ ...l, at: toFrame(l.at) })),
      ],
      taken,
      width,
      height,
    ),
  ].map((l) => ({ ...l, x: l.x + bleedX, y: l.y + bleedY }));

  // The vehicle type is the reliable signal; fleet rows default their kind to PUJ.
  const glyphFor = (v: Vehicle) =>
    v.vehicleType === "Tricycle" || (!v.vehicleType && v.kind === "Tricycle driver") ? "tricycle" : "jeepney";

  const webTouch = Platform.OS === "web" ? ({ touchAction: "none", cursor: "grab", userSelect: "none" } as object) : null;

  return (
    <View
      ref={frame}
      style={[styles.frame, { height }, webTouch]}
      onLayout={(e) => {
        setWidth(Math.max(1, e.nativeEvent.layout.width));
        measure();
      }}
      accessibilityRole={mode ? "adjustable" : "image"}
      accessibilityLabel={
        mode
          ? `Map. Move the map to place your ${mode} under the pin, or tap a spot.`
          : "Map. Drag to move, pinch to zoom."
      }
      {...gestures.responder.panHandlers}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX: gestures.tx }, { translateY: gestures.ty }, { scale: gestures.scale }] },
        ]}
      >
        {tiles.map((t) => (
          <Image
            key={t.key}
            source={{ uri: t.uri }}
            style={{ position: "absolute", left: t.left, top: t.top, width: t.size + 0.5, height: t.size + 0.5 }}
            fadeDuration={0}
            accessibilityIgnoresInvertColors
          />
        ))}
        <Svg width={W} height={H} style={{ position: "absolute", left: -bleedX, top: -bleedY }}>
          {grid}

          {context.map((p) => {
            const q = px(p);
            return inside(q) ? <Circle key={`l-${p.name}`} cx={q.x} cy={q.y} r={3} fill={MUTED} /> : null;
          })}

          {routePts.length >= 2 && (
            <G>
              <Polyline points={routeD} fill="none" stroke="#FFFFFF" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
              <Polyline
                points={routeD}
                fill="none"
                stroke={BRAND}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={routeIsGuess ? "6 6" : undefined}
              />
            </G>
          )}

          {(terminals ?? []).map((t) => {
            const q = px(t.point);
            return inside(q) ? (
              <G key={`t-${t.id}`}>
                <Rect x={q.x - 12} y={q.y - 12} width={24} height={24} rx={5} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
                <G transform={`translate(${q.x - 8.4} ${q.y - 8.4}) scale(0.7)`} fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                  {glyphShapes("terminal")}
                </G>
              </G>
            ) : null;
          })}

          {(stops ?? []).map((s) => {
            const q = px(s.point);
            return inside(q) ? <Rect key={`s-${s.id}`} x={q.x - 6} y={q.y - 6} width={12} height={12} fill="#FFFFFF" stroke={BRAND} strokeWidth={3} /> : null;
          })}

          {destinationAt && inside(destinationAt) && (
            <Rect x={destinationAt.x - 7} y={destinationAt.y - 7} width={14} height={14} fill={INK} stroke="#FFFFFF" strokeWidth={2} />
          )}

          {meAt && inside(meAt) && !(pickupAt && Math.hypot(pickupAt.x - meAt.x, pickupAt.y - meAt.y) < 6) && (
            <PersonMark x={meAt.x} y={meAt.y} color={ME} halo />
          )}

          {pickupAt && inside(pickupAt) && (
            pickupIsPerson ? (
              <PersonMark x={pickupAt.x} y={pickupAt.y} color={INK} />
            ) : (
              <G>
                <Circle cx={pickupAt.x} cy={pickupAt.y} r={9} fill="#FFFFFF" stroke={INK} strokeWidth={3.5} />
                <Circle cx={pickupAt.x} cy={pickupAt.y} r={3} fill={INK} />
              </G>
            )
          )}

          {tags.map(({ v, at: q, tag }) => (
            <G key={`v-${v.id}`} opacity={v.stale ? 0.45 : 1}>
              <Circle cx={q.x} cy={q.y} r={16} fill={BRAND} stroke="#FFFFFF" strokeWidth={3} />
              <G transform={`translate(${q.x - 10.8} ${q.y - 10.8}) scale(0.9)`} fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                {glyphShapes(glyphFor(v))}
              </G>
              {tag && v.plate ? (
                <G>
                  <Rect x={tag.x} y={tag.y} width={tag.w} height={tag.h} rx={3} fill={INK} />
                  <SvgText x={tag.x + 5} y={tag.y + 12.5} fontFamily="ArchivoCond" fontSize={12} fill="#FFFFFF" letterSpacing={0.6}>
                    {v.plate.toUpperCase()}
                  </SvgText>
                </G>
              ) : null}
            </G>
          ))}

          {labels.map((l) => (
            <Label key={`${l.text}-${l.x}-${l.y}`} x={l.x} y={l.y} text={l.text} color={l.color} anchor="start" size={l.size} />
          ))}
        </Svg>
      </Animated.View>

      {mode ? (
        // The pin never moves; its tip marks the exact spot.
        <View pointerEvents="none" style={[styles.pin, { left: width / 2 - 18, top: height / 2 - 44 }]}>
          <Svg width={36} height={46}>
            <Path d="M18 45 C18 45 4 27 4 17 A14 14 0 1 1 32 17 C32 27 18 45 18 45 Z" fill={mode === "pickup" ? INK : BRAND} stroke="#FFFFFF" strokeWidth={2.5} />
            <G transform="translate(9.6 8.6) scale(0.7)" fill="none" stroke="#FFFFFF" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
              {mode === "pickup" ? glyphShapes("person") : <Rect x={6} y={6} width={12} height={12} fill="#FFFFFF" />}
            </G>
          </Svg>
          <View style={styles.pinShadow} />
        </View>
      ) : null}

      <View pointerEvents="none" style={styles.scale}>
        <Svg width={scalePx + 30} height={30}>
          <Line x1={1} y1={24} x2={1 + scalePx} y2={24} stroke={INK} strokeWidth={3} />
          <Line x1={1} y1={19} x2={1} y2={29} stroke={INK} strokeWidth={2} />
          <Line x1={1 + scalePx} y1={19} x2={1 + scalePx} y2={29} stroke={INK} strokeWidth={2} />
          <Label x={1} y={14} text={scaleMeters >= 1000 ? `${scaleMeters / 1000} km` : `${scaleMeters} m`} anchor="start" size={10} />
        </Svg>
      </View>

      <View style={styles.controls}>
        <MapButton icon="add" label="Zoom in" onPress={() => zoomBy(2)} />
        <MapButton icon="remove" label="Zoom out" onPress={() => zoomBy(0.5)} />
        <MapButton
          icon={mode && me ? "locate" : "scan-outline"}
          label={mode && me ? "Move the pin to my location" : "Show everything"}
          onPress={recenter}
        />
      </View>
      {hasTiles ? <Text pointerEvents="none" style={styles.credit}>© Mapbox © OpenStreetMap</Text> : null}
    </View>
  );
}

function MapButton({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.control, pressed && { backgroundColor: "#E4ECE7" }]}
    >
      <Ionicons name={icon} size={18} color={INK} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 10, overflow: "hidden", backgroundColor: PAPER },
  controls: { position: "absolute", right: 8, top: 8, gap: 6 },
  control: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D5DED8",
  },
  pin: { position: "absolute", width: 36, height: 50, alignItems: "center" },
  pinShadow: { width: 10, height: 4, borderRadius: 5, backgroundColor: "rgba(20,32,26,0.35)", marginTop: -2 },
  scale: { position: "absolute", left: 13, bottom: 4 },
  credit: {
    position: "absolute",
    right: 6,
    bottom: 4,
    fontFamily: "Archivo",
    fontSize: 9,
    color: "#56625B",
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 4,
    borderRadius: 3,
  },
});
