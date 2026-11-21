import React, { useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { signInAccount } from "./session";
import { Button, Field } from "../common/ui";
import BrandLogo from "../common/BrandLogo";
import { s } from "../common/styles";
import MobileAuth from "./MobileAuth";

export default function Auth({
  onSignedIn,
}: {
  onSignedIn: () => Promise<boolean>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (busy) {
      return;
    }
    if (!email.trim() || !password) {
      setError("Enter your email address and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signInAccount(email, password, true);
      await onSignedIn();
      setPassword("");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (Platform.OS !== "web") {
    return <MobileAuth onSignedIn={onSignedIn} />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: "#06392D" }}>
      <Image
        source={require("../../assets/calbayog-welcome.jpg")}
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
        resizeMode="cover"
        accessibilityLabel="Calbayog City coastline"
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(3, 32, 24, .62)" },
        ]}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 460,

            padding: 30,
            borderRadius: 28,
            gap: 24,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <BrandLogo iconOnly />
            <View style={{ gap: 8, flex: 1 }}>
            <Text
              style={[
                s.heading,
                { color: "white", fontSize: 30, lineHeight: 38 },
              ]}
            >
              Administrator sign in
            </Text>
            <Text style={[s.body, { color: "#DCE9E1" }]}>
              Calbayog City transport operations
            </Text>
            </View>
          </View>
          <Field
            light
            label="Email address"
            value={email}
            onChange={setEmail}
          />
          <Field
            light
            label="Password"
            value={password}
            onChange={setPassword}
            secret
          />
          {!!error && (
            <Text
              accessibilityRole="alert"
              style={[s.small, { color: "#FFD8CA" }]}
            >
              {error}
            </Text>
          )}
          <Button
            title={busy ? "Signing in…" : "Sign in"}
            onPress={submit}
            disabled={busy}
          />
                    <Text style={[s.small, { color: "#DCE9E1", textAlign: "center" }]}>
            Authorized technical team & vehicle owner access only.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
