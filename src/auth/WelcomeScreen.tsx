import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { passengerColors as c } from "../passenger/passengerStyles";

export default function WelcomeScreen({
  onGetStarted,
}: {
  onGetStarted: () => void;
}) {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Image
        source={require("../../assets/calbayog-welcome-portrait.png")}
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
        resizeMode="cover"
        accessibilityLabel="Aerial view of Calbayog City"
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(3, 29, 23, 0.45)" },
        ]}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} bounces={false}>
          <View style={styles.bottom}>
            <Text accessibilityRole="header" style={styles.title}>
              Your City.{"\n"}Your Next Ride.
            </Text>
            <Text style={styles.description}>
              From familiar streets to your next stop, Travel around Calbayog with ease.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onGetStarted}
              style={({ pressed }) => [
                styles.button,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.buttonText}>Get started</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.dark },
  content: {
    flexGrow: 1,
    justifyContent: "flex-end",
    padding: 28,
    paddingBottom: 32,
  },
  bottom: {
    gap: 25,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  location: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start" },
  locationText: {
    color: "#DCEDE3",
    fontFamily: "Archivo",
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 1.5,
    flexShrink: 1,
  },
  title: {
    color: "white",
    fontFamily: "Archivo",
    fontWeight: "700",
    fontSize: 39,
    lineHeight: 39,
    letterSpacing: -0.8,
  },
  description: {
    color: "#E5EEE8",
    fontFamily: "Archivo",
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    minHeight: 56,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginTop: 6,
  },
  buttonText: {
    color: c.brand,
    fontFamily: "Archivo",
    fontWeight: "700",
    fontSize: 17,
    textAlign: "center",
  },
});
