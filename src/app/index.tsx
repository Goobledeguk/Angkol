import { Redirect, router } from "expo-router";
import { Platform } from "react-native";
import WelcomeScreen from "../auth/WelcomeScreen";
export default function WelcomeRoute() {
  if (Platform.OS === "web") {
    return <Redirect href="/sign-in" />;
  }
  return <WelcomeScreen onGetStarted={() => router.replace("/sign-in")} />;
}
