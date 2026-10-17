import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { api, clearSession } from "./api";
import type { Snapshot } from "./types";
import Auth from "./Auth";
import PassengerApp from "./PassengerApp";
import DriverApp from "./DriverApp";
import AdminDashboard from "./AdminDashboard";

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
    return <Auth onSignedIn={refresh} />;
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
    <View style={{ flex: 1 }}>
      {data.user.role === "Administrator" ? (
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
    </View>
  );
}
