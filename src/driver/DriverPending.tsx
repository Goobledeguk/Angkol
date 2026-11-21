import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button, Icon } from "../common/ui";
import { passengerColors as c, ps } from "../passenger/passengerStyles";
import type { User } from "../types/types";

export default function DriverPending({
  user,
  refresh,
  logout,
}: {
  user: User;
  refresh: () => Promise<boolean>;
  logout: () => Promise<void>;
}) {
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const declined = user.applicationStatus === "declined";
  const franchise = user.franchiseName || "the franchise owner";

  async function checkAgain() {
    setChecking(true);
    try {
      await refresh();
      setChecked(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center", gap: 20 }}>
      <View style={{ gap: 14 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: declined ? "#FCEEEA" : "#FFF2D9",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={declined ? "close-circle-outline" : "time-outline"}
            size={28}
            color={declined ? "#C53B1D" : "#9A6A22"}
          />
        </View>
        <Text style={[ps.heading, { flexWrap: "wrap" }]}>
          {declined ? "Your application was declined" : "Your application is under review"}
        </Text>
        <Text style={[ps.body, { fontSize: 15, lineHeight: 23, flexWrap: "wrap" }]}>
          {declined
            ? `${franchise} declined your PUJ/PUV driver application. Contact them directly if you think this is a mistake.`
            : `${franchise} needs to approve your PUJ/PUV driver application before you can start trips. Once they approve it, your driver dashboard opens here.`}
        </Text>
      </View>

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 16, gap: 10 }}>
        <Row label="Name" value={user.name} />
        <Row label="License" value={user.license || "Not provided"} />
        <Row label="Franchise" value={user.franchiseName || "Not provided"} />
      </View>

      {checked && !declined ? (
        <Text style={[ps.body, { color: c.green }]} accessibilityLiveRegion="polite">
          Still waiting for approval.
        </Text>
      ) : null}

      <View style={{ gap: 10 }}>
        {!declined ? (
          <Button title={checking ? "Checking…" : "Check status"} onPress={checkAgain} disabled={checking} />
        ) : null}
        <Button title="Sign out" secondary onPress={() => void logout()} />
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text style={ps.body}>{label}</Text>
      <Text style={[ps.body, { color: c.ink, fontWeight: "700", flexShrink: 1, textAlign: "right" }]}>{value}</Text>
    </View>
  );
}
