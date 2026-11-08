import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import type { MapProps } from "./mapTypes";

/** A bundled map preview from the existing design, with no remote tiles or GPS. */
export default function StaticMap({
  height = 390,
  mode,
  pickup,
  destination,
  onSelect,
}: MapProps) {
  const samplePoint = destination ||
    pickup || {
      name: "Calbayog City Hall",
      latitude: 12.0676,
      longitude: 124.5942,
    };
  return (
    <View style={[styles.container, { height }]}>
      <Image
        source={require("../../assets/calbayog-map.png")}
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
        resizeMode="cover"
        accessibilityLabel="Calbayog City map"
      />
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={mode ? `Select ${mode}` : "Calbayog map"}
        onPress={() => {
          if (mode) {
            onSelect?.(samplePoint);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#E6EEE5",
  },
});
