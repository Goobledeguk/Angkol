import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
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
        ? "Only reviewers can see it."
        : "Front side, all four corners in frame.",
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
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 32, gap: 24 }}>
      <View style={{ gap: 12 }}>
        <Text style={[ps.bannerTitle, { fontSize: 34, lineHeight: 38, flexWrap: "wrap" }]}>
          {declined ? "Application declined" : "Your application is in review"}
        </Text>
        <Text style={[ps.body, { fontSize: 15, lineHeight: 23, flexWrap: "wrap" }]}>
          {declined
            ? `${reviewer} declined your application. Contact them directly if you think this is a mistake.`
            : `${reviewer} checks every driver first. This screen turns into your dashboard once you’re approved.`}
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
                      step.state === "done" ? c.ink : c.surface,
                    borderWidth: step.state === "done" ? 0 : 2,
                    borderColor: step.state === "now" ? c.amber : c.line,
                  }}
                >
                  <Icon
                    name={step.state === "done" ? "checkmark" : step.state === "now" ? "ellipse" : "ellipse-outline"}
                    size={step.state === "done" ? 16 : 10}
                    color={step.state === "done" ? "white" : step.state === "now" ? c.amber : c.line}
                  />
                </View>
                {index < steps.length - 1 && (
                  <View
                    style={{
                      flex: 1,
                      width: 2,
                      minHeight: 20,
                      backgroundColor: step.state === "done" ? c.ink : c.line,
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

      {!declined && hasLicense && (
        <View style={{ gap: 8 }}>
          <View
            accessible
            accessibilityLabel={`License ${user.license || "on file"} received`}
            style={{ borderRadius: 12, borderWidth: 2, borderColor: c.ink, overflow: "hidden", backgroundColor: "#FFFFFF" }}
          >
            <View style={{ backgroundColor: c.ink, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={[ps.label, { fontSize: 14, color: "#FFFFFF" }]}>Driver’s license · photo received</Text>
            </View>
            <View style={{ padding: 14, gap: 4 }}>
              <Text style={{ fontFamily: "ArchivoBoard", fontSize: 30, lineHeight: 32, color: c.ink, letterSpacing: 1, fontVariant: ["tabular-nums"] }}>
                {user.license || "On file"}
              </Text>
              <Text style={ps.label}>{user.name}</Text>
              <Text style={ps.small}>{tricycle ? "Tricycle" : "Jeepney"} · {user.plate || "no plate yet"}</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={uploading}
            onPress={() => void addLicense("camera")}
            style={({ pressed }) => [ps.secondaryButton, pressed && ps.pressed]}
          >
            <Text style={ps.secondaryText}>{uploading ? "Uploading…" : "Replace the photo"}</Text>
          </Pressable>
          {problem ? (
            <Text style={[ps.body, { color: "#B33A1E" }]} accessibilityLiveRegion="assertive">
              {problem}
            </Text>
          ) : null}
        </View>
      )}

      {checked && !declined ? (
        <Text style={[ps.body, { color: c.ink }]} accessibilityLiveRegion="polite">
          Not approved yet. We check again automatically while this screen is open.
        </Text>
      ) : null}

      <View style={{ gap: 10 }}>
        {!declined && hasLicense ? (
          <Button title={checking ? "Checking…" : "Check status"} onPress={checkAgain} disabled={checking} />
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => void logout()}
          style={({ pressed }) => [ps.secondaryButton, { backgroundColor: "transparent" }, pressed && ps.pressed]}
        >
          <Text style={[ps.secondaryText, { color: c.muted }]}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
