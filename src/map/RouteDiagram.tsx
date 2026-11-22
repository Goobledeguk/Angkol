import React, { useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions, type GestureResponderEvent } from "react-native";
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import type { MapProps } from "./mapTypes";
import type { Point } from "../types/types";
import { DEFAULT_CENTER, distanceKm } from "../services/mapbox";
import { glyphShapes } from "../common/Glyph";

const INK = "#111512";
const PAPER = "#F4F3EE";
const GRID = "#EAE9E4";
const YELLOW = "#FFC20E";
const MUTED = "#6B706C";
const TILE = 512;
const EARTH_M = 40075016;

const mercX = (lng: number) => (lng + 180) / 360;
const mercY = (lat: number) => {
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
const latFromY = (y: number) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI - 2 * Math.PI * y));

type View2D = { cx: number; cy: number; scale: number };

function fit(points: Point[], width: number, height: number, pad: number): View2D {
  const valid = points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  const base = valid.length ? valid : [{ name: "", ...DEFAULT_CENTER }];
  const xs = base.map((p) => mercX(p.longitude));
  const ys = base.map((p) => mercY(p.latitude));
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const spanX = Math.max(maxX - minX, 1e-7);
  const spanY = Math.max(maxY - minY, 1e-7);
  const fitScale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const scale = Math.max(TILE * 2 ** 12.5, Math.min(TILE * 2 ** 16.4, fitScale));
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, scale };
}

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
  const steps = [50, 100, 200, 250, 500, 1000, 2000, 5000];
  return [...steps].reverse().find((m) => m <= maxMeters) ?? 50;
}

/** A label with a paper-coloured halo so it reads over the route line. */
function Label({ x, y, text, color = INK, anchor = "middle", size = 11 }: { x: number; y: number; text: string; color?: string; anchor?: "start" | "middle" | "end"; size?: number }) {
  const common = { x, y, fontFamily: "ArchivoCond", fontSize: size, letterSpacing: 0.6, textAnchor: anchor } as const;
  const label = text;
  return (
    <G>
      <SvgText {...common} stroke={PAPER} strokeWidth={4} strokeLinejoin="round" fill={PAPER}>
        {label}
      </SvgText>
      <SvgText {...common} fill={color}>
        {label}
      </SvgText>
    </G>
  );
}

/**
 * Angkol's map: a drawn route diagram instead of a borrowed basemap.
 * Each screen frames its own subject: the approaching driver, the ride,
 * the corridor, or the spot being picked.
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
  onSelect,
}: MapProps) {
  const window = useWindowDimensions();
  const [width, setWidth] = useState(Math.max(280, window.width - 40));

  const line: Point[] = (geometry?.coordinates ?? []).map(([longitude, latitude]) => ({ name: "", latitude, longitude }));
  const anchor = pickup ?? destination ?? line[0] ?? { name: "", ...DEFAULT_CENTER };
  const nearby = (vehicles ?? []).filter((v) => distanceKm(anchor, v.location) <= 3);
  const focus: Point[] = [
    ...(pickup ? [pickup] : []),
    ...(destination ? [destination] : []),
    ...line,
    ...(terminals ?? []).map((t) => t.point),
    ...(stops ?? []).map((s) => s.point),
    ...nearby.map((v) => v.location),
  ];
  const view = fit(focus.length ? focus : [anchor], width, height, Math.max(46, Math.min(width, height) * 0.2));
  const px = (p: Point) => ({
    x: width / 2 + (mercX(p.longitude) - view.cx) * view.scale,
    y: height / 2 + (mercY(p.latitude) - view.cy) * view.scale,
  });
  const inside = (p: { x: number; y: number }) => p.x > -20 && p.x < width + 20 && p.y > -20 && p.y < height + 20;

  const metersPerPx = (EARTH_M * Math.cos((anchor.latitude * Math.PI) / 180)) / view.scale;
  const scaleMeters = niceDistance(metersPerPx * 90);
  const scalePx = scaleMeters / metersPerPx;

  const routePts = line.length >= 2 ? line.map(px) : pickup && destination ? [px(pickup), px(destination)] : [];
  const routeD = routePts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const routeIsGuess = line.length < 2;

  function select(event: GestureResponderEvent) {
    if (!mode || !onSelect) {
      return;
    }
    const native = event.nativeEvent as unknown as { locationX?: number; locationY?: number; offsetX?: number; offsetY?: number };
    const x = native.locationX ?? native.offsetX ?? width / 2;
    const y = native.locationY ?? native.offsetY ?? height / 2;
    const longitude = (view.cx + (x - width / 2) / view.scale) * 360 - 180;
    const latitude = latFromY(view.cy + (y - height / 2) / view.scale);
    onSelect({ name: "Pinned spot", latitude, longitude });
  }

  const grid: React.ReactNode[] = [];
  for (let x = 16; x < width; x += 32) {
    grid.push(<Line key={`gx${x}`} x1={x} y1={0} x2={x} y2={height} stroke={GRID} strokeWidth={1} />);
  }
  for (let y = 16; y < height; y += 32) {
    grid.push(<Line key={`gy${y}`} x1={0} y1={y} x2={width} y2={y} stroke={GRID} strokeWidth={1} />);
  }

  const context = [...(landmarks ?? [])].filter((p) => p.name !== pickup?.name && p.name !== destination?.name);

  // Everything drawn as a mark claims its space before any label is placed.
  const taken: Box[] = [];
  const claim = (at: { x: number; y: number }, r: number) => taken.push({ x: at.x - r, y: at.y - r, w: r * 2, h: r * 2 });
  const pickupAt = pickup ? px(pickup) : null;
  const destinationAt = destination ? px(destination) : null;
  if (pickupAt && inside(pickupAt)) {claim(pickupAt, 11);}
  if (destinationAt && inside(destinationAt)) {claim(destinationAt, 10);}
  (terminals ?? []).forEach((t) => claim(px(t.point), 13));
  (stops ?? []).forEach((st) => claim(px(st.point), 7));
  const marks = nearby.map((v) => ({ v, at: px(v.location) })).filter(({ at }) => inside(at));
  marks.forEach(({ at }) => claim(at, 17));
  const tags = marks
    .map(({ v, at }) => {
      if (!v.plate) {
        return { v, at, tag: null };
      }
      const w = v.plate.length * 7.4 + 10;
      const spots = [
        { x: at.x + 18, y: at.y - 26, w, h: 17 },
        { x: at.x - 18 - w, y: at.y - 26, w, h: 17 },
        { x: at.x + 18, y: at.y + 9, w, h: 17 },
        { x: at.x - 18 - w, y: at.y + 9, w, h: 17 },
      ];
      const tag = spots.find(
        (b) => b.x >= 2 && b.x + b.w <= width - 2 && b.y >= 2 && !taken.some((t) => overlaps(b, t)),
      );
      if (tag) {
        taken.push(tag);
      }
      return { v, at, tag: tag ?? null };
    });
  taken.push({ x: 0, y: height - 34, w: 120, h: 34 }, { x: 0, y: 0, w: 64, h: 62 });
  const labels = placeLabels(
    [
      ...(pickupAt && inside(pickupAt)
        ? [{ at: pickupAt, text: (pickupLabel || pickup!.name).toUpperCase(), required: true }]
        : []),
      ...(destinationAt && inside(destinationAt)
        ? [{ at: destinationAt, text: (destinationLabel || destination!.name).toUpperCase(), required: true }]
        : []),
      ...(terminals ?? [])
        .map((t) => ({ at: px(t.point), text: t.name.toUpperCase(), gap: 16 }))
        .filter(({ at }) => inside(at)),
      ...context
        .map((p) => ({ at: px(p), text: p.name.toUpperCase(), color: MUTED, size: 10, gap: 7 }))
        .filter(({ at }) => inside(at)),
    ],
    taken,
    width,
    height,
  );

  return (
    <View style={[styles.frame, { height }]} onLayout={(e) => setWidth(Math.max(1, e.nativeEvent.layout.width))}>
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} fill={PAPER} />
        {grid}

        {context.map((p) => {
          const at = px(p);
          return inside(at) ? (
            <G key={`l-${p.name}`}>
              <Circle cx={at.x} cy={at.y} r={3} fill={MUTED} />
            </G>
          ) : null;
        })}

        {routePts.length >= 2 && (
          <G>
            <Polyline points={routeD} fill="none" stroke={INK} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
            <Polyline
              points={routeD}
              fill="none"
              stroke={YELLOW}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={routeIsGuess ? "6 6" : undefined}
            />
          </G>
        )}

        {(terminals ?? []).map((t) => {
          const at = px(t.point);
          return inside(at) ? (
            <G key={`t-${t.id}`}>
              <Rect x={at.x - 12} y={at.y - 12} width={24} height={24} rx={5} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
              <G transform={`translate(${at.x - 8.4} ${at.y - 8.4}) scale(0.7)`} fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                {glyphShapes("terminal")}
              </G>
            </G>
          ) : null;
        })}

        {(stops ?? []).map((s) => {
          const at = px(s.point);
          return inside(at) ? <Rect key={`s-${s.id}`} x={at.x - 6} y={at.y - 6} width={12} height={12} fill={YELLOW} stroke={INK} strokeWidth={2.5} /> : null;
        })}

        {pickup && inside(px(pickup)) && (
          <G>
            <Circle cx={px(pickup).x} cy={px(pickup).y} r={9} fill="#FFFFFF" stroke={INK} strokeWidth={3.5} />
            <Circle cx={px(pickup).x} cy={px(pickup).y} r={3} fill={INK} />
          </G>
        )}

        {destination && inside(px(destination)) && (
          <G>
            <Rect x={px(destination).x - 7} y={px(destination).y - 7} width={14} height={14} fill={INK} />
          </G>
        )}

        {tags.map(({ v, at, tag }) => {
          const glyph = v.vehicleType === "Jeepney" || v.kind === "PUJ / PUV driver" ? "jeepney" : "tricycle";
          return (
            <G key={`v-${v.id}`} opacity={v.stale ? 0.45 : 1}>
              <Circle cx={at.x} cy={at.y} r={16} fill={YELLOW} stroke={INK} strokeWidth={3} />
              <G transform={`translate(${at.x - 10.8} ${at.y - 10.8}) scale(0.9)`} fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                {glyphShapes(glyph)}
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
          );
        })}

        {labels.map((l) => (
          <Label key={`${l.text}-${l.x}-${l.y}`} x={l.x} y={l.y} text={l.text} color={l.color} anchor="start" size={l.size} />
        ))}

        <G>
          <Line x1={14} y1={height - 14} x2={14 + scalePx} y2={height - 14} stroke={INK} strokeWidth={3} />
          <Line x1={14} y1={height - 19} x2={14} y2={height - 9} stroke={INK} strokeWidth={2} />
          <Line x1={14 + scalePx} y1={height - 19} x2={14 + scalePx} y2={height - 9} stroke={INK} strokeWidth={2} />
          <Label x={14} y={height - 22} text={scaleMeters >= 1000 ? `${scaleMeters / 1000} km` : `${scaleMeters} m`} anchor="start" size={10} />
        </G>
      </Svg>
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole={mode ? "button" : "image"}
        accessibilityLabel={mode ? `Tap to set ${mode} on the map` : "Route map"}
        onPress={mode ? select : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 10, overflow: "hidden", backgroundColor: PAPER },
});
