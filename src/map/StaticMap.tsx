import React, { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from "react-native";
import type { MapProps } from "./mapTypes";
import type { Point } from "../types/types";
import {
  DEFAULT_CENTER,
  distanceKm,
  hasMapbox,
  pointAt,
  reverseGeocode,
  staticMapUrl,
  viewportFor,
} from "../services/mapbox";

const NEARBY_KM = 15;

/**
 * Mapbox Static Images map.
 *
 * Native modules are not required: the map is a single HTTPS image with the
 * route and pins already drawn by Mapbox. Taps are converted back into
 * coordinates with the same bounding box used to request the image.
 */
export default function StaticMap({
  height = 390,
  mode,
  pickup,
  destination,
  geometry,
  vehicles,
  terminals,
  stops,
  onSelect,
}: MapProps) {
  const window = useWindowDimensions();
  const [width, setWidth] = useState(Math.max(280, window.width - 48));

  const places: Point[] = [
    ...(terminals ?? []).map((terminal) => terminal.point),
    ...(stops ?? []).map((stop) => stop.point),
  ];
  const focus: Point[] = [
    ...(pickup ? [pickup] : []),
    ...(destination ? [destination] : []),
    ...places,
    ...(geometry?.coordinates ?? []).map(([longitude, latitude]) => ({ name: "", latitude, longitude })),
  ];
  const anchor = focus[0] ?? { name: "", ...DEFAULT_CENTER };
  const nearbyVehicles = (vehicles ?? [])
    .map((vehicle) => vehicle.location)
    .filter((location) => distanceKm(anchor, location) <= NEARBY_KM);

  const imageWidth = Math.min(1280, Math.max(1, Math.round(width)));
  const imageHeight = Math.min(1280, Math.max(1, Math.round(height)));
  const view = viewportFor(
    focus.length ? focus : [anchor, ...nearbyVehicles],
    imageWidth,
    imageHeight,
  );
  const source = staticMapUrl({
    pickup,
    destination,
    markers: [...places, ...nearbyVehicles],
    path: geometry,
    view,
    width: imageWidth,
    height: imageHeight,
  });

  async function select(event: GestureResponderEvent) {
    if (!mode || !onSelect) {return;}
    const native = event.nativeEvent as unknown as {
      locationX?: number;
      locationY?: number;
      offsetX?: number;
      offsetY?: number;
    };
    const x = native.locationX ?? native.offsetX ?? width / 2;
    const y = native.locationY ?? native.offsetY ?? height / 2;
    const { latitude, longitude } = pointAt(
      view,
      x * (imageWidth / Math.max(width, 1)),
      y * (imageHeight / Math.max(height, 1)),
      imageWidth,
      imageHeight,
    );
    let name = "";
    try {
      name = await reverseGeocode(latitude, longitude);
    } catch {
      name = "";
    }
    onSelect({
      name: name || "Selected location",
      latitude,
      longitude,
    });
  }

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={(event) =>
        setWidth(Math.max(1, event.nativeEvent.layout.width))
      }
    >
      {source ? (
        <Image
          source={{ uri: source }}
          style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
          resizeMode="stretch"
          accessibilityLabel="Calbayog City map"
        />
      ) : (
        <Image
          source={require("../../assets/calbayog-map.png")}
          style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
          resizeMode="cover"
          accessibilityLabel="Calbayog City map"
        />
      )}
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole={mode ? "button" : "image"}
        accessibilityLabel={
          mode ? `Select ${mode} on the map` : "Calbayog City map"
        }
        onPress={mode ? select : undefined}
      />
      {hasMapbox && (
        <Text style={styles.attribution}>© Mapbox © OpenStreetMap</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#E6EEE5",
  },
  attribution: {
    position: "absolute",
    right: 8,
    bottom: 6,
    fontSize: 9,
    color: "#4B5A52",
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingHorizontal: 4,
    borderRadius: 3,
  },
});
