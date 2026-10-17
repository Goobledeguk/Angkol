import React, { useState } from "react";
import { View, Text, ScrollView, Platform } from "react-native";
import { signInSampleAccount } from "./sampleAccounts";
import type { Role } from "./types";
import { Button, Card, Choice, Field, Heading, Icon } from "./ui";
import { s } from "./styles";
import MobileAuth from "./MobileAuth";
export default function Auth({
  onSignedIn,
}: {
  onSignedIn: () => Promise<boolean>;
}) {
  const isWeb = Platform.OS === "web";
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("Passenger"),
    [license, setLicense] = useState(""),
    [association, setAssociation] = useState(""),
    [plate, setPlate] = useState(""),
    [capacity, setCapacity] = useState("3");
  async function submit() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signInSampleAccount(email, password, true);
      await onSignedIn();
      setPassword("");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!isWeb) {
    return <MobileAuth onSignedIn={onSignedIn} />;
  }
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F7F9F6",
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ maxWidth: 500, width: "100%", gap: 24 }}>
        <View style={s.brand}>
          <Icon name="navigate-circle" size={40} />
          <Text style={s.brandName}>angkol.</Text>
        </View>
        <Heading
          title={
            isWeb
              ? "Calbayog administrator portal"
              : signup
                ? "Join your local commute"
                : "Welcome back, Angkol"
          }
          sub="Your neighborhood. Your next stop. Calbayog, Samar."
        />
        <Card>
          {!isWeb && (
            <View style={s.chips}>
              <Choice
                label="Sign in"
                selected={!signup}
                onPress={() => setSignup(false)}
              />
              {!isWeb && (
                <Choice
                  label="Create account"
                  selected={signup}
                  onPress={() => setSignup(true)}
                />
              )}
            </View>
          )}
          {signup && (
            <>
              <Field label="Full name" value={name} onChange={setName} />
              <Field label="Contact number" value={phone} onChange={setPhone} />
              <Text style={s.label}>I am a</Text>
              <View style={s.chips}>
                {(
                  ["Passenger", "Tricycle driver", "PUJ / PUV driver"] as Role[]
                ).map((r) => (
                  <Choice
                    key={r}
                    label={r}
                    selected={role === r}
                    onPress={() => setRole(r)}
                  />
                ))}
              </View>
            </>
          )}
          {isWeb && (
            <Text style={s.small}>
              Administrator access only. Passengers and drivers use the Angkol
              mobile app.
            </Text>
          )}
          <Field label="Email address" value={email} onChange={setEmail} />
          <Field
            label="Password (at least 10 characters)"
            value={password}
            onChange={setPassword}
            secret
          />
          {signup && role.includes("driver") && (
            <>
              <Field
                label="Professional license number"
                value={license}
                onChange={setLicense}
              />
              <Field
                label="Transport association / cooperative"
                value={association}
                onChange={setAssociation}
              />
              <Field
                label="Plate or body number"
                value={plate}
                onChange={setPlate}
              />
              <Field
                label="Passenger capacity"
                value={capacity}
                onChange={setCapacity}
                numeric
              />
              <Text style={s.small}>
                Driver accounts require administrator approval before accepting
                rides or sharing locations.
              </Text>
            </>
          )}
          {Boolean(error) && (
            <Text accessibilityRole="alert" style={{ color: "#A34232" }}>
              {error}
            </Text>
          )}
          <Button
            title={
              busy ? "Please wait…" : signup ? "Create account" : "Sign in"
            }
            disabled={busy}
            onPress={submit}
          />
          <Text style={s.small}>
            Accounts and trips are stored by the Angkol server. Device location
            is shared only when you choose to enable it.
          </Text>
        </Card>
      </View>
    </ScrollView>
  );
}
