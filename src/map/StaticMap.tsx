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
  hasMapbox,
  reverseGeocode,
  staticMapUrl,
  viewportFor,
} from "../services/mapbox";

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

  const points: Point[] = [
    ...(pickup ? [pickup] : []),
    ...(destination ? [destination] : []),
    ...(vehicles ?? []).map((vehicle) => vehicle.location),
    ...(terminals ?? []).map((terminal) => terminal.point),
    ...(stops ?? []).map((stop) => stop.point),
  ];

  const view = viewportFor(points, width, height);
  const source = staticMapUrl({
    points,
    path: geometry,
    width,
    height,
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
    const latitude =
      view.north - (Math.min(y, height) / height) * (view.north - view.south);
    const longitude =
      view.west + (Math.min(x, width) / width) * (view.east - view.west);
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
          resizeMode="cover"
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
