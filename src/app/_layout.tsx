import { useFonts } from "expo-font";
import { useEffect } from "react";
import { Image, Platform, View, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as NavigationBar from "expo-navigation-bar";

export default function Layout() {
  const [loaded, error] = useFonts([
    {
      fontFamily: "Archivo",
      fontDefinitions: [
        { path: require("../../assets/fonts/Archivo-Regular.ttf"), weight: 400 },
        { path: require("../../assets/fonts/Archivo-Medium.ttf"), weight: 500 },
        { path: require("../../assets/fonts/Archivo-SemiBold.ttf"), weight: 600 },
        { path: require("../../assets/fonts/Archivo-Bold.ttf"), weight: 700 },
      ],
    },
    {
      fontFamily: "ArchivoBoard",
      fontDefinitions: [{ path: require("../../assets/fonts/Archivo-Display.ttf") }],
    },
    {
      fontFamily: "ArchivoCond",
      fontDefinitions: [{ path: require("../../assets/fonts/Archivo-CondBold.ttf") }],
    },
  ]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    void (async () => {
      try {
        const nav = NavigationBar as any;
        if (typeof nav.setPositionAsync === "function") {
          await nav.setPositionAsync("relative");
        }
        if (typeof nav.setBackgroundColorAsync === "function") {
          await nav.setBackgroundColorAsync("#FFFFFF");
        }
        if (typeof nav.setButtonStyleAsync === "function") {
          await nav.setButtonStyleAsync("dark");
        }
      } catch {}
    })();
  }, []);

  if (!loaded && !error) {
    return (
      <SafeAreaProvider style={{ flex: 1 }}>
        <View style={styles.splash}>
          <StatusBar style="light" />
          <Image
            source={require("../../assets/angkol-icon.png")}
            style={styles.splashIcon}
            resizeMode="contain"
            accessibilityLabel="Angkol Splash"
          />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#F6F4EE" },
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: "#0B5D45",
    alignItems: "center",
    justifyContent: "center",
  },
  splashIcon: {
    width: 104,
    height: 104,
  },
});
