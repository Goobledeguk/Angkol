import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useURL } from "expo-linking";
import { router } from "expo-router";
import { Button, Field } from "../common/ui";
import { passengerColors as c, ps } from "../passenger/passengerStyles";
import { openRecoveryLink, updatePassword } from "./session";

export default function ResetPassword() {
  const url = useURL();
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!url) {
      return;
    }
    let active = true;
    openRecoveryLink(url)
      .then(() => active && setReady(true))
      .catch((e: Error) => active && setProblem(e.message));
    return () => {
      active = false;
    };
  }, [url]);

  async function save() {
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updatePassword(password);
      router.replace("/sign-in");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 20, justifyContent: "center" }}>
          <View style={{ gap: 6 }}>
            <Text style={ps.heading}>Set a new password</Text>
            <Text style={[ps.body, { fontSize: 15, lineHeight: 23 }]}>
              {problem || (ready ? "Choose a password with at least 10 characters." : "Checking your reset link…")}
            </Text>
          </View>
          {ready ? (
            <>
              <Field label="New password" value={password} onChange={setPassword} secret />
              <Field label="Confirm new password" value={confirm} onChange={setConfirm} secret />
              {error ? (
                <Text accessibilityRole="alert" style={[ps.body, { color: "#C53B1D" }]}>
                  {error}
                </Text>
              ) : null}
              <Button title={saving ? "Saving…" : "Save password"} onPress={save} disabled={saving} />
            </>
          ) : null}
          {problem ? <Button title="Back to sign in" secondary onPress={() => router.replace("/sign-in")} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
