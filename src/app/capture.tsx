import { useLocalSearchParams } from "expo-router";
import { Platform, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import AdminDashboard from "../admin/AdminDashboard";
import MobileAuth from "../auth/MobileAuth";
import WelcomeScreen from "../auth/WelcomeScreen";
import DriverApp from "../driver/DriverApp";
import DriverPending from "../driver/DriverPending";
import PassengerApp from "../passenger/PassengerApp";
import { passengerColors } from "../passenger/passengerStyles";
import { captureScenes } from "../testing/captureScenes";

const noop = async () => true;

export default function CaptureRoute() {
  const { scene: id } = useLocalSearchParams<{ scene?: string }>();
  const insets = useSafeAreaInsets();
  if (!__DEV__ || Platform.OS !== "web") {
    return null;
  }

  const scene = captureScenes.find((entry) => entry.id === id);
  if (!scene) {
    return null;
  }

  const nativeID = `capture-${scene.id}`;
  if (scene.role === "auth") {
    return (
      <SafeAreaView
        nativeID={nativeID}
        style={{ flex: 1, backgroundColor: "#FFFFFF" }}
        edges={["top", "bottom"]}
      >
        {scene.id === "welcome" ? (
          <WelcomeScreen onGetStarted={noop} />
        ) : (
          <MobileAuth onSignedIn={noop} />
        )}
      </SafeAreaView>
    );
  }

  const props = {
    data: scene.snapshot,
    notice: "",
    busy: false,
    connected: true,
    dismissNotice: noop,
    refresh: noop,
    action: noop,
    logout: async () => {
      await noop();
    },
  };

  return (
    <SafeAreaView
      nativeID={nativeID}
      style={{ flex: 1, backgroundColor: passengerColors.background }}
      edges={["top", "left", "right"]}
    >
      <View style={{ flex: 1, paddingBottom: Math.max(insets.bottom, 8) }}>
        {scene.role === "admin" ? (
          <AdminDashboard {...props} />
        ) : scene.role === "passenger" ? (
          <PassengerApp {...props} />
        ) : scene.role === "pending" ? (
          <DriverPending
            user={props.data.user}
            refresh={props.refresh}
            logout={props.logout}
          />
        ) : (
          <DriverApp {...props} sharing toggleSharing={props.logout} />
        )}
      </View>
    </SafeAreaView>
  );
}
