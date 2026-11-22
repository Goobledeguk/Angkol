import React from "react";
import type { MapProps } from "./mapTypes";
import { hasMapbox } from "../services/mapbox";
import StaticMap from "./StaticMap";
import RouteDiagram from "./RouteDiagram";

/**
 * Street tiles when a Mapbox token is configured; otherwise Angkol's own
 * drawn route diagram, framed to whatever the screen is about.
 */
export default function CalbayogMap(props: MapProps) {
  return hasMapbox ? <StaticMap {...props} /> : <RouteDiagram {...props} />;
}
