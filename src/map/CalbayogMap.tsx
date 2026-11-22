import React from "react";
import type { MapProps } from "./mapTypes";
import RouteDiagram from "./RouteDiagram";

/**
 * Angkol's drawn map: Mapbox streets underneath when a token is configured,
 * plain paper otherwise. Markers, labels and the route are always our own.
 */
export default function CalbayogMap(props: MapProps) {
  return <RouteDiagram {...props} />;
}
