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
import { Icon } from "../common/ui";
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
            <View style={styles.location}>
              <Icon name="location-outline" size={16} color="white" />
              <Text style={styles.locationText}>CALBAYOG CITY, SAMAR</Text>
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              Your city.{"\n"}Your next ride.
            </Text>
            <Text style={styles.description}>
              From familiar streets to your next stop. Travel around Calbayog
              with Angkol.
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
    gap: 20,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  location: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start" },
  locationText: {
    color: "#DCEDE3",
    fontFamily: "Manrope",
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 1.5,
    flexShrink: 1,
  },
  title: {
    color: "white",
    fontFamily: "Manrope",
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  description: {
    color: "#E5EEE8",
    fontFamily: "Manrope",
    fontSize: 14,
    lineHeight: 23,
  },
  button: {
    minHeight: 56,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    backgroundColor: c.green,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginTop: 6,
  },
  buttonText: {
    color: "white",
    fontFamily: "Manrope",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "900",
  },
});
