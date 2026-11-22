import React from "react";
import { Text, View } from "react-native";
import { passengerColors as c, ps } from "./passengerStyles";

/** A ride ticket: serial and status on top, a tear line, then the details. */
export function Ticket({
  serial,
  when,
  children,
  stamp,
}: {
  serial: string;
  when: string;
  children: React.ReactNode;
  stamp?: string;
}) {
  return (
    <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 10 }}>
      <View style={{ padding: 16, gap: 2 }}>
        <View style={ps.between}>
          <Text style={ps.label}>Ticket {serial}</Text>
          {stamp ? (
            <Text accessibilityLabel={stamp} style={[ps.small, { color: c.ink, fontWeight: "600" }]}>
              {stamp}
            </Text>
          ) : null}
        </View>
        <Text style={ps.small}>{when}</Text>
      </View>
      <View style={{ borderTopWidth: 1, borderStyle: "dashed", borderColor: "#B9BBB5", marginHorizontal: 16 }} />
      <View style={{ padding: 16, gap: 12 }}>{children}</View>
    </View>
  );
}
