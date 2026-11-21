import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api, clearSession } from "./services/api";
import { resumeSharing, startSharing, stopSharing } from "./services/location";
import { supabase } from "./services/supabase";
import { uploadPendingLicense } from "./services/documents";
import type { Snapshot } from "./types/types";
import { useNow } from "./common/useNow";
import { useAppActive } from "./common/useAppActive";
import { hasLiveTrip, isDriverRole } from "./domain/roles";
import Auth from "./auth/Auth";
import PassengerApp from "./passenger/PassengerApp";
import DriverApp from "./driver/DriverApp";
import DriverPending from "./driver/DriverPending";
import AdminDashboard from "./admin/AdminDashboard";

const LIVE_POLL_MS = 10_000;
const ONLINE_POLL_MS = 20_000;

export default function AngkolApp() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [notice, setNotice] = useState("");
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(!!supabase);
  const inflight = useRef(0);
  const insets = useSafeAreaInsets();
  const [fade] = useState(() => new Animated.Value(0));
  const [restoring, setRestoring] = useState(!!supabase);
  const now = useNow(30_000);
  const hasData = !!data;
  const userId = data?.user?.id;

  const refresh = useCallback(async () => {
    try {
      setData(await api<Snapshot>("/state"));
      setConnected(true);
      return true;
    } catch (error) {
      setConnected(false);
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let active = true;
    void (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session.session && active) {
          setData(await api<Snapshot>("/state"));
        }
      } catch {
        await clearSession();
      } finally {
        if (active) {
          setRestoring(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [hasData, userId, fade]);

  useEffect(() => {
    if (!supabase || !userId) {return;}
    const client = supabase;
    const reload = () => {
      void refresh().catch(() => undefined);
    };
    const channel = client
      .channel(`angkol:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, reload)
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [userId, refresh]);

  const live = !!data && hasLiveTrip(data);
  const resume = useCallback(() => {
    if (userId) {
      void refresh().catch(() => undefined);
    }
  }, [userId, refresh]);
  const foreground = useAppActive(resume);
  const pollEvery = !foreground ? 0 : live ? LIVE_POLL_MS : sharing ? ONLINE_POLL_MS : 0;
  useEffect(() => {
    if (!pollEvery) {
      return;
    }
    const timer = setInterval(() => {
      void refresh().catch(() => undefined);
    }, pollEvery);
    return () => clearInterval(timer);
  }, [pollEvery, refresh]);

  const needsLicenseUpload =
    !!data && isDriverRole(data.user.role) && !data.user.licenseDocAttached;
  const userEmail = data?.user.email ?? "";
  useEffect(() => {
    if (!needsLicenseUpload || !userId || !userEmail) {
      return;
    }
    let active = true;
    void uploadPendingLicense(userId, userEmail).then((uploaded) => {
      if (uploaded && active) {
        void refresh().catch(() => undefined);
      }
    });
    return () => {
      active = false;
    };
  }, [needsLicenseUpload, userId, userEmail, refresh]);

  const driverShouldShare =
    !!data &&
    isDriverRole(data.user.role) &&
    data.user.verified &&
    data.user.applicationStatus !== "pending" &&
    data.user.applicationStatus !== "declined" &&
    data.user.available;

  useEffect(() => {
    if (!driverShouldShare || sharing || !userId) {
      return;
    }
    let active = true;
    void (async () => {
      let resumed = false;
      try {
        resumed = await resumeSharing(userId);
      } catch {
        resumed = false;
      }
      if (!active) {
        return;
      }
      if (resumed) {
        setSharing(true);
      } else {
        await api("/availability", { available: false }).catch(() => undefined);
        await refresh().catch(() => undefined);
      }
    })();
    return () => {
      active = false;
    };
  }, [driverShouldShare, sharing, userId, refresh]);

  const action = useCallback(
    async (endpoint: string, input: unknown, method?: string) => {
      inflight.current += 1;
      setBusy(true);
      try {
        await api(endpoint, input, method);
        await refresh();
        return true;
      } catch (error) {
        setNotice((error as Error).message);
        return false;
      } finally {
        inflight.current -= 1;
        if (inflight.current === 0) {
          setBusy(false);
        }
      }
    },
    [refresh],
  );

  async function logout() {
    await stopSharing();
    await clearSession();
    setData(null);
    setSharing(false);
    setNotice("");
    router.setParams({ screen: undefined });
  }

  const view = useMemo(
    () => (data ? { ...data, serverTime: Math.max(now, data.serverTime) } : null),
    [data, now],
  );

  if (restoring) {
    return (
      <View
        style={{ flex: 1, backgroundColor: "#0B5D45", alignItems: "center", justifyContent: "center", gap: 28 }}
        accessibilityLabel="Loading Angkol"
      >
        <Image
          source={require("../assets/angkol-icon.png")}
          style={{ width: 104, height: 104 }}
          resizeMode="contain"
        />
        <ActivityIndicator color="#CFE6DA" />
      </View>
    );
  }

  if (!view) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top", "bottom"]}>
        <Auth onSignedIn={refresh} />
      </SafeAreaView>
    );
  }

  const props = {
    data: view,
    notice,
    busy,
    connected,
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
          {view.user.role === "Administrator" || view.user.role === "Vehicle Owner / Operator" ? (
            <AdminDashboard {...props} />
          ) : view.user.role === "Passenger" ? (
            <PassengerApp {...props} />
          ) : view.user.applicationStatus === "pending" || view.user.applicationStatus === "declined" ? (
            <DriverPending user={view.user} refresh={refresh} logout={logout} />
          ) : (
            <DriverApp
              {...props}
              sharing={sharing}
              toggleSharing={async () => {
                if (sharing) {
                  await stopSharing();
                  setSharing(false);
                  if (view.user.available) {
                    await action("/availability", { available: false });
                  }
                  return;
                }
                try {
                  await startSharing(view.user.id);
                  setSharing(true);
                  if (!view.user.available) {
                    await action("/availability", { available: true });
                  }
                } catch (error) {
                  setNotice((error as Error).message);
                }
              }}
            />
          )}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
