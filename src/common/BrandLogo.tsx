import React from "react";
import { Image, View } from "react-native";

/** Display the supplied artwork without its transparent canvas margins. */
export default function BrandLogo({
  compact = false,
  iconOnly = false,
  wordmarkOnly = false,
  tint = "white",
}: {
  compact?: boolean;
  iconOnly?: boolean;
  wordmarkOnly?: boolean;
  tint?: string;
}) {
  const size = compact ? 36 : 62;
  const titleWidth = compact ? 112 : 170;
  const iconScale = size / 1741;
  const titleScale = titleWidth / 2928;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      {!wordmarkOnly && <View
        style={{
          width: size,
          height: 1761 * iconScale,
          overflow: "hidden",
          borderRadius: size * 0.18,
        }}
      >
        <Image
          source={require("../../assets/angkol-icon.png")}
          accessibilityLabel="Angkol icon"
          style={{
            position: "absolute",
            width: 2949 * iconScale,
            height: 1923 * iconScale,
            left: -604 * iconScale,
            top: -81 * iconScale,
          }}
        />
      </View>}
      {!iconOnly && <View
        style={{
          width: titleWidth,
          height: 766 * titleScale,
          overflow: "hidden",
        }}
      >
        <Image
          source={require("../../assets/angkol-title.png")}
          accessibilityLabel="Angkol"
          style={{
            position: "absolute",
            width: 2949 * titleScale,
            height: 1923 * titleScale,
            left: -11 * titleScale,
            top: -671 * titleScale,
            tintColor: tint,
          }}
        />
      </View>}
    </View>
  );
}
