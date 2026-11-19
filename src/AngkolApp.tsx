import React, { useEffect, useState } from "react";
import { Animated, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api, clearSession } from "./services/api";
import type { Snapshot } from "./types/types";
import Auth from "./auth/Auth";
import PassengerApp from "./passenger/PassengerApp";
import DriverApp from "./driver/DriverApp";
import AdminDashboard from "./admin/AdminDashboard";

export default function AngkolApp() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [notice, setNotice] = useState("");
  const [sharing, setSharing] = useState(false);
  const insets = useSafeAreaInsets();
  const [fade] = useState(() => new Animated.Value(0));
  const hasData = !!data;
  const userId = data?.user?.id;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [hasData, userId, fade]);

  async function refresh() {
    setData(await api<Snapshot>("/state"));
    return true;
  }

  async function action(endpoint: string, input: unknown, method?: string) {
    try {
      await api(endpoint, input, method);
      await refresh();
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top", "bottom"]}>
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
  const bottomPad = Math.max(insets.bottom, 8);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top", "left", "right"]}>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <View style={{ flex: 1, paddingBottom: bottomPad }}>
          {data.user.role === "Administrator" || data.user.role === "Vehicle Owner / Operator" ? (
            <AdminDashboard {...props} />
          ) : data.user.role === "Passenger" ? (
            <PassengerApp {...props} />
          ) : (
            <DriverApp
              {...props}
              sharing={sharing}
              toggleSharing={async () => {
                setSharing((value) => !value);
              }}
            />
          )}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
