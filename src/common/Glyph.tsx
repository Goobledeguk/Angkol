import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

/**
 * Angkol's own pictograms: thick, squared strokes drawn to sit next to
 * condensed signboard lettering. 24×24 grid, 2.4 stroke.
 */
export type GlyphName =
  | "tricycle"
  | "jeepney"
  | "terminal"
  | "home"
  | "routes"
  | "ticket"
  | "account"
  | "cash"
  | "records"
  | "bell"
  | "close";

const shapes: Record<GlyphName, React.ReactNode> = {
  tricycle: (
    <>
      <Path d="M2.5 8.2c2.6-2.3 6.4-2.3 9 0" />
      <Rect x="2.5" y="8.2" width="9" height="7.3" rx="1.4" />
      <Circle cx="6.5" cy="18.6" r="2.1" />
      <Circle cx="19.2" cy="18.6" r="2.1" />
      <Path d="M11.5 13.6h3.6l4.1 5M15.1 13.6l2-4.6h2.6" />
    </>
  ),
  jeepney: (
    <>
      <Path d="M3.5 5.5h12" />
      <Path d="M2 16.2V9.2a1.8 1.8 0 0 1 1.8-1.8h12.6l3.4 4H22v4.8z" />
      <Path d="M5 10.6h10" />
      <Circle cx="6.6" cy="17.6" r="2" />
      <Circle cx="17.4" cy="17.6" r="2" />
    </>
  ),
  terminal: (
    <>
      <Path d="M2.8 9.2 12 4l9.2 5.2" />
      <Path d="M5.5 9.2V20M18.5 9.2V20M3 20h18M8.5 15h7" />
    </>
  ),
  home: (
    <>
      <Path d="M3.8 11 12 4l8.2 7v9H3.8z" />
      <Path d="M10 20v-5.2h4V20" />
    </>
  ),
  routes: (
    <>
      <Path d="M6 17.5c0-6 12-5 12-11" />
      <Circle cx="6" cy="19" r="2" />
      <Rect x="16" y="3" width="4" height="4" rx="0.6" />
    </>
  ),
  ticket: (
    <>
      <Path d="M3.5 6h17v4a2 2 0 0 0 0 4v4h-17v-4a2 2 0 0 0 0-4z" />
      <Path d="M9.5 6.5v1.6M9.5 11.2v1.6M9.5 15.9v1.6" />
    </>
  ),
  account: (
    <>
      <Circle cx="12" cy="8" r="3.6" />
      <Path d="M4.8 20.2c.6-4 3.4-6 7.2-6s6.6 2 7.2 6" />
    </>
  ),
  cash: (
    <>
      <Rect x="2.8" y="6.2" width="18.4" height="11.6" rx="1.4" />
      <Circle cx="12" cy="12" r="2.6" />
      <Path d="M6 9.4v.1M18 14.5v.1" />
    </>
  ),
  records: (
    <>
      <Rect x="5" y="3" width="14" height="18" rx="1.4" />
      <Path d="M8.4 8h7.2M8.4 12h7.2M8.4 16h4.2" />
    </>
  ),
  bell: (
    <>
      <Path d="M6 16.2v-5a6 6 0 0 1 12 0v5l1.6 2H4.4z" />
      <Path d="M10 21h4" />
    </>
  ),
  close: <Path d="M6 6l12 12M18 6 6 18" />,
};

export function Glyph({
  name,
  size = 24,
  color = "#14201A",
  fill = "none",
  weight = 2.4,
}: {
  name: GlyphName;
  size?: number;
  color?: string;
  fill?: string;
  weight?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes[name]}
    </Svg>
  );
}

/** The glyph's raw shapes, for embedding inside another <Svg> (map markers). */
export function glyphShapes(name: GlyphName) {
  return shapes[name];
}
