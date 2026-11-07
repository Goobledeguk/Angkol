import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Image,
  StyleSheet,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { registerSampleAccount, signInSampleAccount } from "./sampleAccounts";
import { api } from "../services/api";
import type { Role } from "../types/types";
import { Icon } from "../common/ui";
import { ps, passengerColors as c } from "../passenger/passengerStyles";

type IconName = React.ComponentProps<typeof Icon>["name"];

function AuthField({
  label,
  icon,
  value,
  onChange,
  secret,
  phone,
  number,
}: {
  label: string;
  icon: IconName;
  value: string;
  onChange: (value: string) => void;
  secret?: boolean;
  phone?: boolean;
  number?: boolean;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text
        style={[ps.small, { fontWeight: "700", textTransform: "uppercase" }]}
      >
        {label}
      </Text>
      <View style={[ps.input, ps.row, { paddingVertical: 0, minHeight: 54 }]}>
        <Icon name={icon} size={22} />
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          style={{ flex: 1, paddingVertical: 15, fontSize: 14, color: c.ink }}
          placeholder={label === "Email address" ? "you@example.com" : label}
          placeholderTextColor="#A2B0A7"
          secureTextEntry={secret}
          keyboardType={
            phone
              ? "phone-pad"
              : number
                ? "numeric"
                : label === "Email address"
                  ? "email-address"
                  : "default"
          }
          autoCapitalize={
            secret || label === "Email address" ? "none" : "words"
          }
          autoCorrect={!secret && label !== "Email address"}
        />
      </View>
    </View>
  );
}

function SolidButton({
  title,
  onPress,
  disabled,
  icon = "lock-closed-outline",
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        ps.button,
        { minHeight: 54 },
        disabled && { opacity: 0.45 },
        pressed && ps.pressed,
      ]}
    >
      <Icon name={icon} size={22} color="white" />
      <Text style={[ps.buttonText, { fontSize: 15 }]}>{title}</Text>
    </Pressable>
  );
}

export default function MobileAuth({
  onSignedIn,
}: {
  onSignedIn: () => Promise<boolean>;
}) {
  const insets = useSafeAreaInsets();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const [signup, setSignup] = useState(false),
    [step, setStep] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [role, setRole] = useState<"Commuter" | "Driver">("Commuter"),
    [driverType, setDriverType] = useState<Role>("Tricycle driver");
  const [assocOpen, setAssocOpen] = useState(false);
  const [franchiseOpen, setFranchiseOpen] = useState(false);
  const [franchiseSubmitted, setFranchiseSubmitted] = useState<{
    name: string;
    franchiseName: string;
  } | null>(null);
  const [licenseDoc, setLicenseDoc] = useState(false);
  const [orcrDoc, setOrcrDoc] = useState(false);
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [license, setLicense] = useState(""),
    [association, setAssociation] = useState(""),
    [franchiseName, setFranchiseName] = useState(""),
    [plate, setPlate] = useState(""),
    [permitNo, setPermitNo] = useState(""),
    [capacity, setCapacity] = useState("3"),
    [consent, setConsent] = useState(false);

  // Gesture-driven bottom sheet with dynamic logo/header scaling
  const translateY = useSharedValue(0);
  const contextY = useSharedValue(0);
  const maxHeader = 300;
  const minHeader = Math.max(insets.top + 72, 150);
  const maxUp = -((maxHeader - minHeader) / (maxHeader - 130)) * 150;

  const panGesture = Gesture.Pan()
    .onStart(() => {
      contextY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateY.value = Math.max(maxUp, Math.min(30, contextY.value + e.translationY));
    })
    .onEnd((e) => {
      if (e.velocityY < -350 || translateY.value < maxUp * 0.4) {
        translateY.value = withSpring(maxUp, { damping: 20, stiffness: 140 });
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 140 });
      }
    });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const height = interpolate(translateY.value, [maxUp, 0], [minHeader, maxHeader], Extrapolation.CLAMP);
    return { height };
  });

  const logoAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(translateY.value, [maxUp, 0], [0.72, 1], Extrapolation.CLAMP);
    const opacity = interpolate(translateY.value, [maxUp, maxUp * 0.5, 0], [0.88, 0.96, 1], Extrapolation.CLAMP);
    return { transform: [{ scale }], opacity };
  });

  const sheetAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  function changeMode(create: boolean) {
    setSignup(create);
    setStep(1);
    setError("");
    translateY.value = withSpring(0);
  }

  function next() {
    setError("");
    if (!name.trim() || !phone.trim() || !email.trim() || !password) {
      setError("Complete your name, phone number, email, and password.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 10) {
      setError("Use at least 10 characters for your password.");
      return;
    }
    if (!consent) {
      setError(
        "Please review and acknowledge the account and location information.",
      );
      return;
    }
    setStep(2);
  }

  async function submit() {
    if (busy) {
      return;
    }
    if (signup && role === "Driver") {
      if (driverType === "PUJ / PUV driver") {
        if (!license.trim()) {
          setError("Enter your License No.");
          return;
        }
      } else {
        if (!license.trim() || !plate.trim()) {
          setError("Enter your License No. and Plate No.");
          return;
        }
        if (!permitNo.trim()) {
          setError("Enter your tricycle Permit No. (Prangkisa / Franchise Permit).");
          return;
        }
      }
    }
    setBusy(true);
    setError("");
    try {
      if (signup) {
        if (role === "Driver" && driverType === "PUJ / PUV driver") {
          await api("/register", {
            email,
            password,
            name: name.trim(),
            role: "PUJ / PUV driver",
            phone: phone.trim(),
            license: license.trim(),
            franchiseName: franchiseName.trim(),
            licenseDocAttached: licenseDoc,
          });
          setFranchiseSubmitted({ name: name.trim(), franchiseName: franchiseName.trim() });
          setPassword("");
          return;
        }
        await registerSampleAccount({
          email,
          password,
          name: name.trim(),
          role: role === "Driver" ? driverType : "Passenger",
          phone: phone.trim(),
          license: license.trim(),
          association: driverType === "Tricycle driver" ? association.trim() : "",
          franchiseName: driverType === "PUJ / PUV driver" ? franchiseName.trim() : "",
          plate: driverType === "Tricycle driver" ? plate.trim() : "",
          permitNo: driverType === "Tricycle driver" ? permitNo.trim() : "",
          capacity: driverType === "PUJ / PUV driver" ? 12 : Number(capacity) || 3,
        });
      } else {
        await signInSampleAccount(email, password);
      }
      await onSignedIn();
      setPassword("");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  

  const requirements = [
    "Valid government-issued driver's license for public utility operation.",
    "Active transport association or cooperative membership in Calbayog.",
    "Registered plate or body number matching authorized local franchise.",
    "Tricycle drivers: valid Prangkisa / Franchise Permit (Permit No.).",
  ];

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: true });
  }, [signup, step]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === 2) {
        setStep(1);
        return true;
      }
      if (signup) {
        changeMode(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step, signup]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {!signup && (
          <Animated.View
            style={[
              {
                width: "100%",
                alignSelf: "stretch",
                flexShrink: 0,
                overflow: "hidden",
                position: "relative",
              },
              headerAnimatedStyle,
            ]}
          >
            <Image
              source={require("../../assets/calbayog-welcome.jpg")}
              style={[
                StyleSheet.absoluteFill,
                { width: "100%", height: "100%" },
              ]}
              resizeMode="cover"
              accessibilityLabel="Calbayog City coastline"
            />
            {/* Background-black opacity replacing background-white opacity */}
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: "rgba(0, 0, 0, 0.45)" },
              ]}
            />
            <View
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                alignItems: "center",
                justifyContent: "center",
                paddingBottom: 22,
              }}
            >
              <Animated.View style={[{ alignItems: "center" }, logoAnimatedStyle]}>
                <Image
                  source={require("../../assets/angkol-white-centered.png")}
                  style={{
                    width: 640,
                    height: 212,
                    maxWidth: "92%",
                  }}
                  resizeMode="contain"
                  accessibilityLabel="Angkol"
                />
              </Animated.View>
            </View>
          </Animated.View>
        )}

        {signup ? (
          <View
            style={{
              flex: 1,
              paddingHorizontal: 25,
              paddingTop: 24,
              paddingBottom: 35,
              gap: 19,
            }}
          >
            <View style={ps.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                disabled={busy}
                style={ps.iconButton}
                onPress={() => (step === 2 ? setStep(1) : changeMode(false))}
              >
                <Icon name="arrow-back" size={25} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[ps.heading, { fontSize: 24, flexWrap: "wrap" }]}>
                  Create your account
                </Text>
                <Text style={[ps.body, { flexWrap: "wrap" }]}>
                  {role} registration Â· Step {step} of 2
                </Text>
              </View>
            </View>
            <View
              style={{
                height: 6,
                borderRadius: 4,
                backgroundColor: "#D8EEE3",
                marginVertical: 2,
              }}
            >
              <View
                style={{
                  height: 6,
                  borderRadius: 4,
                  backgroundColor: c.green,
                  width: step === 1 ? "48%" : "100%",
                }}
              />
            </View>
            <View>
              <Text style={[ps.section, { fontSize: 22, flexWrap: "wrap" }]}>
                {step === 1
                  ? "Basic information"
                  : role === "Driver"
                    ? "Driver & vehicle details"
                    : "Confirm details"}
              </Text>
              <Text style={[ps.body, { flexWrap: "wrap" }]}>
                {step === 1
                  ? "Provide your contact and security details."
                  : role === "Driver"
                    ? "Provide franchise information for administrator verification."
                    : "Review your information before finishing."}
              </Text>
            </View>

            {step === 1 && (
              <View style={{ gap: 10 }}>
                <Text
                  style={[
                    ps.small,
                    { fontWeight: "700", textTransform: "uppercase" },
                  ]}
                >
                  I am registering as a
                </Text>
                {(
                  [
                    {
                      name: "Commuter",
                      sub: "Book rides & check routes in Calbayog",
                      icon: "person",
                    },
                    {
                      name: "Driver",
                      sub: "Accept hails & operate routes with Angkol",
                      icon: "steering",
                    },
                  ] as const
                ).map((item) => (
                  <Pressable
                    key={item.name}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: role === item.name }}
                    disabled={busy}
                    onPress={() => setRole(item.name)}
                    style={[
                      ps.card,
                      { padding: 12 },
                      role === item.name && {
                        borderColor: c.green,
                        borderWidth: 1.5,
                        backgroundColor: "#EEF6F0",
                      },
                    ]}
                  >
                    <View style={ps.row}>
                      <View
                        style={[
                          ps.iconButton,
                          {
                            backgroundColor:
                              role === item.name ? c.green : "#F4F8F5",
                            width: 40,
                            minHeight: 40,
                          },
                        ]}
                      >
                        <Icon
                          name={
                            item.name === "Commuter"
                              ? "person-outline"
                              : "bicycle-outline"
                          }
                          size={23}
                          color={role === item.name ? "white" : "#84978B"}
                        />
                      </View>
                      <View style={{ flex: 1, paddingRight: 6 }}>
                        <Text style={[ps.section, { fontSize: 16, flexWrap: "wrap" }]}>
                          {item.name}
                        </Text>
                        <Text style={[ps.body, { flexWrap: "wrap" }]}>{item.sub}</Text>
                      </View>
                      {role === item.name && (
                        <Icon name="checkmark-circle-outline" size={20} />
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {Boolean(error) && (
              <View accessibilityRole="alert" style={ps.hint}>
                <Text style={[ps.hintText, { flexWrap: "wrap" }]}>{error}</Text>
              </View>
            )}

            {step === 1 && (
              <>
                <AuthField
                  label="Full name"
                  icon="person-outline"
                  value={name}
                  onChange={setName}
                />
                <AuthField
                  label="Phone number"
                  icon="call-outline"
                  value={phone}
                  onChange={setPhone}
                  phone
                />
                <AuthField
                  label="Email address"
                  icon="mail-outline"
                  value={email}
                  onChange={setEmail}
                />
                <AuthField
                  label="Password"
                  icon="lock-closed-outline"
                  value={password}
                  onChange={setPassword}
                  secret
                />
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: consent }}
                  onPress={() => setConsent((value) => !value)}
                  style={[ps.row, { alignItems: "flex-start", gap: 12 }]}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: consent ? c.green : "#A4B5AC",
                      backgroundColor: consent ? c.green : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 2,
                    }}
                  >
                    {consent && <Icon name="checkmark" size={16} color="white" />}
                  </View>
                  <Text style={[ps.body, { flex: 1, flexWrap: "wrap" }]}>
                    I understand how Angkol uses my account and optional location
                    information for trips.
                  </Text>
                </Pressable>

                <SolidButton
                  title="Continue"
                  icon="arrow-forward-outline"
                  onPress={next}
                  disabled={busy}
                />
              </>
            )}

            {step === 2 && (
              <>
                <View style={ps.card}>
                  <Text style={[ps.section, { flexWrap: "wrap" }]}>{name}</Text>
                  <Text style={ps.body}>{phone}</Text>
                  <Text style={ps.body}>{email}</Text>
                  <Text style={[ps.small, { color: c.green, flexWrap: "wrap" }]}>
                    {role === "Driver" ? "Driver partner" : "Commuter account"} Ã‚Â·
                    Email/password sign-in
                  </Text>
                </View>
                {role === "Driver" && (
                  <>
                    <View style={{ gap: 8 }}>
                      <Text style={[ps.small, { fontWeight: "700", textTransform: "uppercase" }]}>Register as</Text>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        {[
                          { kind: "Tricycle driver" as Role, label: "Tricycle", sub: "TODA / Prangkisa", icon: "bicycle-outline" as IconName },
                          { kind: "PUJ / PUV driver" as Role, label: "PUJ / PUV", sub: "Business / Franchise", icon: "bus-outline" as IconName },
                        ].map((item) => {
                          const selected = driverType === item.kind;
  return (
                            <Pressable
                              key={item.kind}
                              accessibilityRole="radio"
                              accessibilityState={{ checked: selected }}
                              onPress={() => setDriverType(item.kind)}
                              style={[
                                ps.card,
                                { flex: 1, padding: 12, gap: 6, minHeight: 104, borderWidth: selected ? 2 : 1, borderColor: selected ? c.green : "#E3ECE5", backgroundColor: selected ? "#EAF6EF" : "#FFFFFF" },
                              ]}
                            >
                              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: selected ? c.green : "#F0F4F2", alignItems: "center", justifyContent: "center" }}>
                                <Icon name={item.icon} size={22} color={selected ? "white" : "#5B7468"} />
                              </View>
                              <Text style={[ps.label, { fontSize: 15, color: selected ? c.green : c.ink }]}>{item.label}</Text>
                              <Text style={[ps.small, { fontSize: 10 }]}>{item.sub}</Text>
                              {selected ? <View style={{ position: "absolute", top: 8, right: 8 }}><Icon name="checkmark-circle" size={18} color={c.green} /></View> : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <AuthField label="License No." icon="card-outline" value={license} onChange={setLicense} />
                    {driverType === "PUJ / PUV driver" ? (
                      <View style={{ gap: 7 }}>
                        <Text style={[ps.small, { fontWeight: "700", textTransform: "uppercase" }]}>Business / Franchise</Text>
                        <Pressable accessibilityRole="button" onPress={() => setFranchiseOpen((v) => !v)} style={[ps.input, ps.row, { paddingVertical: 0, minHeight: 54, justifyContent: "space-between" }]}>
                          <Text style={{ flex: 1, color: franchiseName ? c.ink : "#A2B0A7", fontSize: 14 }} numberOfLines={1}>{franchiseName || "Select business / franchise"}</Text>
                          <Icon name={franchiseOpen ? "chevron-up-outline" : "chevron-down-outline"} size={20} color="#6A7E73" />
                        </Pressable>
                        {franchiseOpen ? (
                          <View style={[ps.input, { paddingVertical: 4, gap: 2 }]}>
                            {["Calbayog Metro Express", "North Samar Transport Coop", "Samar PUJ Operators Association", "Visayas Commuter Lines"].map((item) => (
                              <Pressable key={item} onPress={() => { setFranchiseName(item); setFranchiseOpen(false); }} style={{ paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10, backgroundColor: franchiseName === item ? "#E5F4ED" : "transparent" }}>
                                <Text style={[ps.body, { color: franchiseName === item ? c.green : c.ink, fontWeight: franchiseName === item ? "700" : "500" }]}>{item}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                        <Text style={[ps.small, { color: "#5B7468", flexWrap: "wrap" }]}>PUJ/PUV requirements: License No. and Business/Franchise.</Text>
                      </View>
                    ) : (
                      <>
                        <AuthField label="Plate No." icon="bicycle-outline" value={plate} onChange={setPlate} />
                        <View style={{ gap: 7 }}>
                          <Text style={[ps.small, { fontWeight: "700", textTransform: "uppercase" }]}>TODA (optional)</Text>
                          <Pressable accessibilityRole="button" onPress={() => setAssocOpen((v) => !v)} style={[ps.input, ps.row, { paddingVertical: 0, minHeight: 54, justifyContent: "space-between" }]}>
                            <Text style={{ flex: 1, color: association ? c.ink : "#A2B0A7", fontSize: 14 }} numberOfLines={1}>{association || "Select TODA / Not part of an association"}</Text>
                            <Icon name={assocOpen ? "chevron-up-outline" : "chevron-down-outline"} size={20} color="#6A7E73" />
                          </Pressable>
                          {assocOpen ? (
                            <View style={[ps.input, { paddingVertical: 4, gap: 2 }]}>
                              {[
                                { value: "", label: "Not part of an association / TODA" },
                                { value: "Magsaysay TODA", label: "Magsaysay TODA" },
                                { value: "Capoocan Tricycle Operators & Drivers Assn.", label: "Capoocan Tricycle Operators & Drivers Assn." },
                                { value: "Rawisâ€“Nijaga TODA", label: "Rawisâ€“Nijaga TODA" },
                                { value: "Obrero Transport Cooperative", label: "Obrero Transport Cooperative" },
                                { value: "San Policarpo TODA", label: "San Policarpo TODA" },
                                { value: "Gadgaran Drivers Association", label: "Gadgaran Drivers Association" },
                              ].map((item) => (
                                <Pressable key={item.label} onPress={() => { setAssociation(item.value); setAssocOpen(false); }} style={{ paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10, backgroundColor: association === item.value ? "#E5F4ED" : "transparent" }}>
                                  <Text style={[ps.body, { color: association === item.value ? c.green : c.ink, fontWeight: association === item.value ? "700" : "500" }]}>{item.label}</Text>
                                </Pressable>
                              ))}
                            </View>
                          ) : null}
                        </View>
                        <AuthField label="Permit No. (Prangkisa)" icon="document-text-outline" value={permitNo} onChange={setPermitNo} />
                        <Text style={[ps.small, { color: "#5B7468", flexWrap: "wrap" }]}>Prangkisa / Franchise Permit number. Required for every tricycle driver.</Text>
                        <AuthField label="Passenger capacity" icon="people-outline" value={capacity} onChange={setCapacity} number />
                      </>
                    )}
                  </>
                )}
                                        <View style={{ gap: 8 }}>
                          <Text style={[ps.small, { fontWeight: "700", textTransform: "uppercase" }]}>Documents (prototype)</Text>
                          <Pressable accessibilityRole="button" onPress={() => { setLicenseDoc((v) => !v); Alert.alert("Prototype", "License ID attached (demo)."); }} style={[ps.buttonLight, ps.row, { minHeight: 48, justifyContent: "center", borderRadius: 14 }]}>
                            <Icon name={licenseDoc ? "checkmark-circle" : "cloud-upload-outline"} size={20} color={c.green} />
                            <Text style={[ps.buttonText, { color: c.green }]}>{licenseDoc ? "License ID attached" : "Submit file / take photo (License ID)"}</Text>
                          </Pressable>
                          {driverType === "Tricycle driver" ? (
                            <Pressable accessibilityRole="button" onPress={() => { setOrcrDoc((v) => !v); Alert.alert("Prototype", "OR/CR attached (demo). Tricycle only."); }} style={[ps.buttonLight, ps.row, { minHeight: 48, justifyContent: "center", borderRadius: 14 }]}>
                              <Icon name={orcrDoc ? "checkmark-circle" : "camera-outline"} size={20} color={c.green} />
                              <Text style={[ps.buttonText, { color: c.green }]}>{orcrDoc ? "OR/CR attached" : "Submit file / take photo (OR/CR – Tricycle only)"}</Text>
                            </Pressable>
                          ) : (
                            <Text style={[ps.small, { color: "#5B7468" }]}>OR/CR is required for Tricycle registration only.</Text>
                          )}
                        </View>
<SolidButton
                  title={
                    busy ? "Creating your account…" : "Create account securely"
                  }
                  icon="shield-checkmark-outline"
                  disabled={busy}
                  onPress={submit}
                />
              </>
            )}

            
          </View>
        ) : (
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                {
                  flex: 1,
                  backgroundColor: "white",
                  marginTop: -28,
                  borderTopLeftRadius: 30,
                  borderTopRightRadius: 30,
                  paddingHorizontal: 25,
                  paddingTop: 12,
                  paddingBottom: 35,
                  gap: 16,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 14,
                },
                sheetAnimatedStyle,
              ]}
            >
              {/* Clean drag handle indicator bar */}
              <View
                style={{
                  alignItems: "center",
                  paddingVertical: 6,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: "#D0DDD5",
                  }}
                />
              </View>

              <View>
                <Text style={[ps.heading, { fontSize: 26, flexWrap: "wrap" }]}>
                  Welcome back
                </Text>
                <Text style={[ps.body, { flexWrap: "wrap" }]}>
                  Sign in with your Angkol account
                </Text>
              </View>

              {Boolean(error) && (
                <View accessibilityRole="alert" style={ps.hint}>
                  <Text style={[ps.hintText, { flexWrap: "wrap" }]}>{error}</Text>
                </View>
              )}

              <AuthField
                label="Email address"
                icon="mail-outline"
                value={email}
                onChange={setEmail}
              />
              <AuthField
                label="Password"
                icon="lock-closed-outline"
                value={password}
                onChange={setPassword}
                secret
              />

              <SolidButton
                title={busy ? "Signing inâ€¦" : "Sign in"}
                onPress={submit}
                disabled={busy}
              />

              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => changeMode(true)}
                style={{ paddingVertical: 6 }}
              >
                <Text style={[ps.body, { textAlign: "center", fontSize: 13, flexWrap: "wrap" }]}>
                  New to Angkol?{" "}
                  <Text style={{ color: c.green, fontWeight: "700" }}>Create an account</Text>
                </Text>
              </Pressable>

             
            </Animated.View>
          </GestureDetector>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
