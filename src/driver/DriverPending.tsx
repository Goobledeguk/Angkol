import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button, Icon } from "../common/ui";
import { haptic } from "../common/haptics";
import { pickLicensePhoto, uploadLicense } from "../services/documents";
import { passengerColors as c, ps } from "../passenger/passengerStyles";
import type { User } from "../types/types";

type Step = { title: string; detail: string; state: "done" | "now" | "next" };

export default function DriverPending({
  user,
  refresh,
  logout,
}: {
  user: User;
  refresh: () => Promise<boolean>;
  logout: () => Promise<void>;
}) {
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState("");
  const declined = user.applicationStatus === "declined";
  const tricycle = user.role === "Tricycle driver";
  const reviewer = tricycle
    ? "The Calbayog transport office"
    : user.franchiseName || "Your franchise owner";
  const hasLicense = !!user.licenseDocAttached;

  async function checkAgain() {
    setChecking(true);
    try {
      await refresh();
      setChecked(true);
    } finally {
      setChecking(false);
    }
  }

  async function addLicense(source: "camera" | "library") {
    setProblem("");
    setUploading(true);
    try {
      const photo = await pickLicensePhoto(source);
      if (!photo) {
        return;
      }
      await uploadLicense(user.id, photo.base64);
      haptic.success();
      await refresh();
    } catch (e) {
      setProblem((e as Error).message || "The photo did not upload. Try again.");
    } finally {
      setUploading(false);
    }
  }

  const steps: Step[] = [
    {
      title: "Account created",
      detail: `${tricycle ? "Tricycle" : "PUJ/PUV"} driver · ${user.name}`,
      state: "done",
    },
    {
      title: hasLicense ? "License photo received" : "Add your driver license photo",
      detail: hasLicense
        ? "Stored privately. Only reviewers can see it."
        : "Reviewers need a clear photo of the front of your license.",
      state: hasLicense ? "done" : "now",
    },
    {
      title: "Review",
      detail: tricycle
        ? "Your license and plate are checked against city records."
        : `${reviewer} confirms you drive for the franchise.`,
      state: hasLicense ? "now" : "next",
    },
  ];

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center", gap: 24 }}>
      <View style={{ gap: 12 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            borderCurve: "continuous",
            backgroundColor: declined ? "#FCEEEA" : "#FFF2D9",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={declined ? "close-circle-outline" : "id-card-outline"}
            size={28}
            color={declined ? "#C53B1D" : "#9A6A22"}
          />
        </View>
        <Text style={[ps.heading, { flexWrap: "wrap" }]}>
          {declined ? "Your application was declined" : "Almost ready to drive"}
        </Text>
        <Text style={[ps.body, { fontSize: 15, lineHeight: 23, flexWrap: "wrap" }]}>
          {declined
            ? `${reviewer} declined your application. Contact them directly if you think this is a mistake.`
            : `${reviewer} approves every driver before they can take passengers. Your dashboard opens here as soon as that happens.`}
        </Text>
      </View>

      {!declined && (
        <View style={{ gap: 0 }}>
          {steps.map((step, index) => (
            <View key={step.title} style={{ flexDirection: "row", gap: 14 }}>
              <View style={{ alignItems: "center", width: 28 }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor:
                      step.state === "done" ? c.green : step.state === "now" ? "#FFF2D9" : "#EDF1EE",
                  }}
                >
                  <Icon
                    name={step.state === "done" ? "checkmark" : step.state === "now" ? "ellipse" : "ellipse-outline"}
                    size={step.state === "done" ? 16 : 10}
                    color={step.state === "done" ? "white" : step.state === "now" ? "#9A6A22" : "#9AA99F"}
                  />
                </View>
                {index < steps.length - 1 && (
                  <View
                    style={{
                      flex: 1,
                      width: 2,
                      minHeight: 20,
                      backgroundColor: step.state === "done" ? c.green : c.line,
                    }}
                  />
                )}
              </View>
              <View style={{ flex: 1, paddingBottom: index < steps.length - 1 ? 20 : 0, gap: 2 }}>
                <Text style={[ps.label, step.state === "next" && { color: c.muted }]}>{step.title}</Text>
                <Text style={ps.small}>{step.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {!declined && !hasLicense && (
        <View style={{ gap: 10 }}>
          <Button
            title={uploading ? "Uploading…" : "Take a photo of my license"}
            onPress={() => void addLicense("camera")}
            disabled={uploading}
          />
          <Button
            title="Choose from my photos"
            secondary
            onPress={() => void addLicense("library")}
            disabled={uploading}
          />
          {problem ? (
            <Text style={[ps.body, { color: "#B33A1E" }]} accessibilityLiveRegion="assertive">
              {problem}
            </Text>
          ) : null}
        </View>
      )}

      {checked && !declined ? (
        <Text style={[ps.body, { color: c.green }]} accessibilityLiveRegion="polite">
          Not approved yet. We check again automatically while this screen is open.
        </Text>
      ) : null}

      <View style={{ gap: 10 }}>
        {!declined && hasLicense ? (
          <Button title={checking ? "Checking…" : "Check status"} onPress={checkAgain} disabled={checking} />
        ) : null}
        <Button title="Sign out" secondary onPress={() => void logout()} />
      </View>
    </ScrollView>
  );
}
