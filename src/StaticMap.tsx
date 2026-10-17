import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
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
        source={require("../assets/calbayog-map.png")}
        style={StyleSheet.absoluteFill}
        resizeMode="stretch"
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
      <View pointerEvents="none" style={styles.hint}>
        <Text style={styles.hintText}>
          {mode ? `Tap to select ${mode}` : "Calbayog, Samar"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#E6EEE5",
  },
  hint: {
    position: "absolute",
    top: 12,
    left: 55,
    minWidth: 155,
    backgroundColor: "#FFFFFF",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    boxShadow: "0px 2px 8px #0002",
  },
  hintText: {
    color: "#176B48",
    fontSize: 12,
  },
});
