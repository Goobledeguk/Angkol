import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { Snapshot } from "../types/types";
import { Button, Icon } from "../common/ui";
import { passengerColors as c, ps } from "../passenger/passengerStyles";

export type AdminDashboardProps = {
  data: Snapshot;
  busy: boolean;
  connected: boolean;
  notice: string;
  dismissNotice: () => void;
  action: (
    endpoint: string,
    input: unknown,
    method?: string,
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh?: () => Promise<boolean>;
};

export default function AdminDashboard({ data, logout }: AdminDashboardProps) {
  const [leaving, setLeaving] = useState(false);
  const owner = data.user.role === "Vehicle Owner / Operator";
  const pending = data.users.filter((u) => u.applicationStatus === "pending").length;
  const openReports = data.reports.filter((r) => r.status === "open").length;
  const live = data.vehicles.filter((v) => !v.stale).length;

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center", gap: 22 }}>
      <View style={{ gap: 14 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: "#E5F0E9",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="desktop-outline" size={28} color={c.green} />
        </View>
        <Text style={[ps.heading, { flexWrap: "wrap" }]}>
          {owner ? "Manage your fleet on the web" : "Operations run on the web portal"}
        </Text>
        <Text style={[ps.body, { fontSize: 15, lineHeight: 23 }]}>
          Signed in as {data.user.name}. Approvals, fleet, fares, and reports need a larger
          screen, so open the Angkol portal in a browser on your computer.
        </Text>
      </View>

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: c.line }}>
        {[
          { label: "Driver applications waiting", value: pending },
          { label: "Open passenger reports", value: openReports },
          { label: "Vehicles reporting location", value: live },
        ].map((row, index) => (
          <View
            key={row.label}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderTopWidth: index ? 1 : 0,
              borderTopColor: c.line,
            }}
          >
            <Text style={ps.body}>{row.label}</Text>
            <Text style={[ps.label, { fontVariant: ["tabular-nums"] }]}>{row.value}</Text>
          </View>
        ))}
      </View>

      <Button
        title={leaving ? "Signing out…" : "Sign out"}
        secondary
        disabled={leaving}
        onPress={() => {
          setLeaving(true);
          void logout().finally(() => setLeaving(false));
        }}
      />
    </ScrollView>
  );
}
