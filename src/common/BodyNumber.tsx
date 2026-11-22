import React from "react";
import { Text, View } from "react-native";
import { passengerColors as c } from "../passenger/passengerStyles";

const LTO_PLATE = /^[A-Z]{2,4}\s?\d{3,4}$/i;

/**
 * How riders actually recognise their ride. Tricycles carry a body number
 * painted on the sidecar under their TODA's name; jeepneys show an LTO plate.
 */
export function BodyNumber({
  value,
  toda,
  size = "lg",
  align = "flex-start",
}: {
  value?: string | null;
  toda?: string | null;
  size?: "lg" | "sm";
  align?: "flex-start" | "center";
}) {
  const big = size === "lg";
  if (!value) {
    return null;
  }
  if (LTO_PLATE.test(value)) {
    return (
      <View
        accessible
        accessibilityLabel={`Plate ${value}`}
        style={{
          alignSelf: align,
          backgroundColor: "#FFFFFF",
          borderWidth: big ? 3 : 2,
          borderColor: c.ink,
          borderRadius: big ? 8 : 5,
          paddingHorizontal: big ? 14 : 6,
          paddingTop: big ? 2 : 0,
        }}
      >
        <Text
          style={{
            fontFamily: "ArchivoBoard",
            fontSize: big ? 40 : 17,
            lineHeight: big ? 46 : 21,
            letterSpacing: big ? 3 : 1.4,
            color: c.ink,
            fontVariant: ["tabular-nums"],
          }}
        >
          {value.toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <View
      accessible
      accessibilityLabel={`${toda ? `${toda}, ` : ""}body number ${value}`}
      style={{
        alignSelf: align,
        alignItems: "center",
        backgroundColor: c.yellow,
        borderRadius: big ? 10 : 6,
        borderWidth: big ? 3 : 2,
        borderColor: c.ink,
        paddingHorizontal: big ? 16 : 7,
        paddingTop: big ? 6 : 2,
        paddingBottom: big ? 2 : 0,
        minWidth: big ? 120 : 0,
      }}
    >
      {toda ? (
        <Text
          numberOfLines={1}
          style={{
            fontFamily: "ArchivoCond",
            fontSize: big ? 12 : 8,
            lineHeight: big ? 14 : 10,
            letterSpacing: big ? 1.4 : 0.8,
            color: c.ink,
            textTransform: "uppercase",
          }}
        >
          {toda}
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: "ArchivoBoard",
          fontSize: big ? 56 : 20,
          lineHeight: big ? 58 : 22,
          color: c.ink,
          fontVariant: ["tabular-nums"],
          textShadowColor: c.red,
          textShadowOffset: { width: big ? 3 : 1.5, height: big ? 3 : 1.5 },
          textShadowRadius: 0.1,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
