import React from "react";
import { Text, View } from "react-native";
import { passengerColors as c } from "../passenger/passengerStyles";

const MARK_TOP = 21;

/**
 * Pickup → destination as two stops on a rail, the same marks the map uses:
 * a ring for the pickup, a filled square for the drop-off.
 */
export function RouteBoard({
  from,
  to,
  compact = false,
}: {
  from?: string;
  to?: string;
  compact?: boolean;
}) {
  const size = compact ? 16 : 17;
  const gap = compact ? 8 : 12;
  const name = {
    fontFamily: "Archivo",
    fontWeight: "600" as const,
    fontSize: size,
    lineHeight: size + 5,
    color: c.ink,
  };
  const caption = {
    fontFamily: "Archivo",
    fontSize: 12,
    lineHeight: 16,
    color: c.muted,
  };
  const rail = { position: "absolute" as const, left: 6, width: 2, backgroundColor: c.ink };
  return (
    <View accessible accessibilityLabel={`From ${from || "pickup"} to ${to || "destination"}`}>
      <View style={{ flexDirection: "row", gap: 14, paddingBottom: gap }}>
        <View style={{ width: 14 }}>
          <View style={[rail, { top: MARK_TOP + 6, bottom: -gap }]} />
          <View
            style={{
              marginTop: MARK_TOP,
              width: 14,
              height: 14,
              borderRadius: 7,
              borderWidth: 3,
              borderColor: c.ink,
              backgroundColor: "#FFFFFF",
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={caption}>From</Text>
          <Text style={name} numberOfLines={2}>
            {from || "Choose your pickup"}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 14 }}>
        <View style={{ width: 14 }}>
          <View style={[rail, { top: 0, height: MARK_TOP }]} />
          <View style={{ marginTop: MARK_TOP, marginLeft: 1, width: 12, height: 12, backgroundColor: c.ink }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={caption}>To</Text>
          <Text style={name} numberOfLines={2}>
            {to || "Where are you going?"}
          </Text>
        </View>
      </View>
    </View>
  );
}
