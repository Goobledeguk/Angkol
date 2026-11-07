import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { api, clearSession } from "./services/api";
import type { Snapshot } from "./types/types";
import Auth from "./auth/Auth";
import PassengerApp from "./passenger/PassengerApp";
import DriverApp from "./driver/DriverApp";
import AdminDashboard from "./admin/AdminDashboard";
import { Icon } from "./common/ui";
import { ps, passengerColors as c } from "./passenger/passengerStyles";

export default function AngkolApp() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [notice, setNotice] = useState("");
  const [sharing, setSharing] = useState(false);

  async function refresh() {
    setData(await api<Snapshot>("/state"));
    return true;
  }

  async function action(endpoint: string, input: unknown, method?: string) {
    try {
      await api(endpoint, input, method);
      await refresh();
      setNotice("Saved successfully.");
      return true;
    } catch (error) {
      setNotice((error as Error).message);
      return false;
    }
  }

  async function logout() {
    await clearSession();
    setData(null);
    setSharing(false);
    setNotice("");
    router.setParams({ screen: undefined });
  }

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <Auth onSignedIn={refresh} />
      </SafeAreaView>
    );
  }

  const props = {
    data,
    notice,
    busy: false,
    connected: true,
    dismissNotice: () => setNotice(""),
    refresh,
    action,
    logout,
  };
  return (
    <SafeAreaView
      style={{
        flex: 1,
      }}
    >
      {data.user.pendingFranchiseApproval && data.user.role === "PUJ / PUV driver" ? (
        <View style={{ flex: 1, backgroundColor: c.background, padding: 24, justifyContent: "center" }}>
          <View style={[ps.card, { gap: 14, padding: 22 }]}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#FFF2D9", alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
              <Icon name="time-outline" size={30} color="#B37A2A" />
            </View>
            <Text style={[ps.heading, { fontSize: 24, textAlign: "center" }]}>Pending franchise approval</Text>
            <Text style={[ps.body, { textAlign: "center", flexWrap: "wrap" }]}>
              {data.user.name}, your PUJ/PUV driver account for{" "}
              <Text style={{ fontWeight: "700", color: c.ink }}>{data.user.franchiseName || "your franchise"}</Text>{" "}
              is waiting for the franchise admin to accept you.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={logout}
              style={[ps.button, { backgroundColor: c.green }]}
            >
              <Icon name="log-out-outline" size={20} color="white" />
              <Text style={ps.buttonText}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      ) : data.user.role === "Administrator" || data.user.role === "Vehicle Owner / Operator" ? (
        <AdminDashboard {...props} />
      ) : data.user.role === "Passenger" ? (
        <PassengerApp {...props} />
      ) : (
        <DriverApp
          {...props}
          sharing={sharing}
          toggleSharing={async () => {
            setSharing((value) => !value);
            setNotice("Location sharing updated.");
          }}
        />
      )}
    </SafeAreaView>
  );
}
