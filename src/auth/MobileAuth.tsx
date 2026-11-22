import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Image,
  StyleSheet,
  Text,
  ScrollView,
  Pressable,
  TextInput,
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
import { registerAccount, requestPasswordReset, signInAccount } from "./session";
import { pickLicensePhoto, savePendingLicense, type LicensePhoto } from "../services/documents";
import { isPhMobile, normalizePhMobile } from "../domain/format";
import type { Role } from "../types/types";
import { Icon } from "../common/ui";
import { ps, passengerColors as c } from "../passenger/passengerStyles";

type IconName = React.ComponentProps<typeof Icon>["name"];

function formatBirthday(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) {
    return d;
  }
  if (d.length <= 4) {
    return `${d.slice(0, 2)}-${d.slice(2)}`;
  }
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
}

function isValidBirthday(value: string): boolean {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    return false;
  }
  const [mm, dd, yyyy] = value.split("-").map(Number);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 2026) {
    return false;
  }
  const date = new Date(yyyy, mm - 1, dd);
  return date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd;
}

function formatPlate(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const letters = clean.replace(/[^A-Z]/g, "").slice(0, 2);
  const digits = clean.replace(/[^0-9]/g, "").slice(0, 5);
  if (letters.length < 2) {
    return letters + digits.slice(0, 0);
  }
  return `${letters}-${digits}`;
}

function isValidPlate(value: string): boolean {
  return /^[A-Z]{2}-\d{5}$/.test(value);
}

function AuthField({
  label,
  icon,
  value,
  onChange,
  secret,
  phone,
  number,
  maxLength,
  autoCapitalize,
  placeholder,
}: {
  label: string;
  icon: IconName;
  value: string;
  onChange: (value: string) => void;
  secret?: boolean;
  phone?: boolean;
  number?: boolean;
  maxLength?: number;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  placeholder?: string;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text
        style={[ps.small, { fontWeight: "700", color: "#18382C" }]}
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
          placeholder={placeholder ?? (label === "Email address" ? "you@example.com" : label)}
          placeholderTextColor="#A2B0A7"
          secureTextEntry={secret}
          maxLength={maxLength}
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
            autoCapitalize ?? (secret || label === "Email address" ? "none" : "words")
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
  icon,
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
      {icon ? <Icon name={icon} size={20} color={c.onBrand} /> : null}
      <Text style={[ps.buttonText, { fontSize: 16 }]}>{title}</Text>
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
    [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [info, setInfo] = useState("");
  const [role, setRole] = useState<"Commuter" | "Driver">("Commuter"),
    [driverType, setDriverType] = useState<Role>("Tricycle driver");
  const [assocOpen, setAssocOpen] = useState(false);
  const [franchiseOpen, setFranchiseOpen] = useState(false);
  const [licensePhoto, setLicensePhoto] = useState<LicensePhoto | null>(null);
  const licenseDoc = !!licensePhoto;
  const [name, setName] = useState(""),
    [birthday, setBirthday] = useState(""),
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

  function clearErr(key: string) {
    setFieldErr((e) => (e[key] ? { ...e, [key]: "" } : e));
  }
  function fieldError(key: string) {
    const msg = fieldErr[key];
    return msg ? (
      <View accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Text style={[ps.small, { color: "#C53B1D", flexWrap: "wrap", paddingHorizontal: 4 }]}>
          {msg}
        </Text>
      </View>
    ) : null;
  }

  const changeMode = React.useCallback((create: boolean) => {
    setSignup(create);
    setStep(1);
    setFieldErr({});
    setInfo("");
    setName("");
    setBirthday("");
    setPhone("");
    setEmail("");
    setPassword("");
    setLicense("");
    setAssociation("");
    setFranchiseName("");
    setPlate("");
    setPermitNo("");
    setCapacity("3");
    setConsent(false);
    setLicensePhoto(null);
    // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue is mutated via .value by design
    translateY.value = withSpring(0);
  }, [translateY]);

  const KENT_OWNER_FRANCHISE = "Calbayog Metro Express";

  function next() {
    const e: Record<string, string> = {};
    if (!name.trim()) {
      e.name = "Full name is required.";
    }
    if (!birthday.trim()) {
      e.birthday = "Birthday is required.";
    } else if (!isValidBirthday(birthday)) {
      e.birthday = "Enter a valid birthday in MM-DD-YYYY format.";
    }
    if (!phone.trim()) {
      e.phone = "Phone number is required.";
    } else if (!isPhMobile(phone)) {
      e.phone = "Use a Philippine mobile number, like 0917 123 4567.";
    }
    if (!email.trim()) {
      e.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = "Enter a valid email address.";
    }
    if (!password) {
      e.password = "Password is required.";
    } else if (password.length < 10) {
      e.password = "Use at least 10 characters for your password.";
    }
    if (!consent) {
      e.consent = "Please review and acknowledge this information.";
    }
    setFieldErr(e);
    if (Object.keys(e).length === 0) {
      setStep(2);
    }
  }

  async function submit() {
    if (busy) {
      return;
    }
    const e: Record<string, string> = {};
    if (signup && role === "Driver") {
      if (!license.trim()) {
        e.license = "License No. is required.";
      }
      if (driverType === "PUJ / PUV driver") {
        if (!franchiseName.trim()) {
          e.franchise = "Select a business / franchise.";
        }
      } else {
        if (!plate.trim()) {
          e.plate = "Plate No. is required.";
        } else if (!isValidPlate(plate)) {
          e.plate = "Enter a valid Plate No. in LL-DDDDD format (2 letters, 5 numbers).";
        }
        if (!permitNo.trim()) {
          e.permit = "Permit No. (Prangkisa) is required.";
        }
      }
    }
    if (Object.keys(e).length) {
      setFieldErr(e);
      return;
    }
    setBusy(true);
    setFieldErr({});
    setInfo("");
    try {
      if (signup) {
        const base = { email, password, name: name.trim(), phone: normalizePhMobile(phone), birthday, consent };
        const pujDriver = role === "Driver" && driverType === "PUJ / PUV driver";
        const tricycleDriver = role === "Driver" && driverType === "Tricycle driver";
        const { needsConfirmation } = await registerAccount(
          pujDriver
            ? {
                ...base,
                role: "PUJ / PUV driver",
                license: license.trim(),
                franchiseName: franchiseName.trim() || KENT_OWNER_FRANCHISE,
                licenseDocAttached: licenseDoc,
              }
            : tricycleDriver
              ? {
                  ...base,
                  role: "Tricycle driver",
                  license: license.trim(),
                  association: association.trim(),
                  plate: plate.trim(),
                  permitNo: permitNo.trim(),
                  capacity: Number(capacity) || 3,
                  licenseDocAttached: licenseDoc,
                }
              : { ...base, role: "Passenger" },
        );
        if (licensePhoto) {
          await savePendingLicense(email, licensePhoto).catch(() => undefined);
        }
        if (needsConfirmation) {
          const sentTo = email.trim();
          changeMode(false);
          setEmail(sentTo);
          setInfo(`We sent a confirmation link to ${sentTo}. Open it, then sign in here.`);
          return;
        }
        setPassword("");
      } else {
        await signInAccount(email, password);
        setPassword("");
      }
      await onSignedIn();
    } catch (error) {
      const err = error as any;
      const msg = err?.message || "Something went wrong.";
      setFieldErr(signup ? { form: msg } : { password: msg });
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (busy) {
      return;
    }
    if (!email.trim()) {
      setFieldErr({ email: "Enter your email address first." });
      return;
    }
    setBusy(true);
    setFieldErr({});
    try {
      await requestPasswordReset(email);
      setInfo(`We sent a password reset link to ${email.trim()}.`);
    } catch (error) {
      setFieldErr({ email: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  

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
  }, [step, signup, changeMode]);

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
                  {role} registration, step {step} of 2
                </Text>
              </View>
            </View>
            <View
              style={{
                height: 6,
                borderRadius: 4,
                backgroundColor: c.brandSoft,
                marginVertical: 2,
              }}
            >
              <View
                style={{
                  height: 6,
                  borderRadius: 4,
                  backgroundColor: c.ink,
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
                    { fontWeight: "700", color: "#18382C" },
                  ]}
                >
                  I am registering as a
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {(
                    [
                      {
                        name: "Commuter",
                        sub: "Book rides & check routes in Calbayog",
                        icon: "person-outline",
                      },
                      {
                        name: "Driver",
                        sub: "Accept hails & operate routes with Angkol",
                        icon: "bicycle-outline",
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
                        {
                          flex: 1,
                          padding: 12,
                          gap: 6,
                          minHeight: 104,
                          borderWidth: role === item.name ? 2 : 1,
                          borderColor: role === item.name ? c.ink : "#E3ECE5",
                          backgroundColor: role === item.name ? c.brandSoft : "#FFFFFF",
                        },
                      ]}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: role === item.name ? c.ink : "#F0F4F2",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon
                          name={item.icon as IconName}
                          size={22}
                          color={role === item.name ? "white" : "#84978B"}
                        />
                      </View>
                      <Text style={[ps.label, { fontSize: 15, color: role === item.name ? c.ink : c.ink }]}>
                        {item.name}
                      </Text>
                      <Text style={[ps.small, { fontSize: 10, flexWrap: "wrap" }]}>{item.sub}</Text>
                      {role === item.name ? (
                        <View style={{ position: "absolute", top: 8, right: 8 }}>
                          <Icon name="checkmark-circle" size={18} color={c.ink} />
                        </View>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {step === 1 && (
              <>
                <View style={{ gap: 4 }}>
                  <AuthField
                    label="Full name"
                    icon="person-outline"
                    value={name}
                    onChange={(v) => { setName(v); clearErr("name"); }}
                  />
                  {fieldError("name")}
                </View>
                <View style={{ gap: 4 }}>
                  <AuthField
                    label="Birthday"
                    icon="calendar-outline"
                    value={birthday}
                    onChange={(v) => { setBirthday(formatBirthday(v)); clearErr("birthday"); }}
                    placeholder="MM-DD-YYYY"
                    maxLength={10}
                    number
                  />
                  {fieldError("birthday")}
                </View>
                <View style={{ gap: 4 }}>
                  <AuthField
                    label="Phone number"
                    icon="call-outline"
                    value={phone}
                    onChange={(v) => { setPhone(v); clearErr("phone"); }}
                    phone
                  />
                  {fieldError("phone")}
                </View>
                <View style={{ gap: 4 }}>
                  <AuthField
                    label="Email address"
                    icon="mail-outline"
                    value={email}
                    onChange={(v) => { setEmail(v); clearErr("email"); }}
                  />
                  {fieldError("email")}
                </View>
                <View style={{ gap: 4 }}>
                  <AuthField
                    label="Password"
                    icon="lock-closed-outline"
                    value={password}
                    onChange={(v) => { setPassword(v); clearErr("password"); }}
                    secret
                  />
                  {fieldError("password")}
                </View>
                <View style={{ gap: 4 }}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: consent }}
                    onPress={() => { setConsent((value) => !value); clearErr("consent"); }}
                    style={[ps.row, { alignItems: "flex-start", gap: 12 }]}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: consent ? c.ink : "#A4B5AC",
                        backgroundColor: consent ? c.ink : "transparent",
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
                  {fieldError("consent")}
                </View>

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
                  <Text style={[ps.small, { color: c.ink, flexWrap: "wrap" }]}>
                    {role === "Driver" ? "Driver partner" : "Commuter account"}
                    
                  </Text>
                </View>
                {role === "Driver" && (
                  <>
                    <View style={{ gap: 8 }}>
                      <Text style={[ps.small, { fontWeight: "700", color: "#18382C" }]}>Register as</Text>
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
                                { flex: 1, padding: 12, gap: 6, minHeight: 104, borderWidth: selected ? 2 : 1, borderColor: selected ? c.ink : "#E3ECE5", backgroundColor: selected ? c.brandSoft : "#FFFFFF" },
                              ]}
                            >
                              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: selected ? c.ink : "#F0F4F2", alignItems: "center", justifyContent: "center" }}>
                                <Icon name={item.icon} size={22} color={selected ? "white" : "#5B7468"} />
                              </View>
                              <Text style={[ps.label, { fontSize: 15, color: selected ? c.ink : c.ink }]}>{item.label}</Text>
                              <Text style={[ps.small, { fontSize: 10 }]}>{item.sub}</Text>
                              {selected ? <View style={{ position: "absolute", top: 8, right: 8 }}><Icon name="checkmark-circle" size={18} color={c.ink} /></View> : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <View style={{ gap: 4 }}>
                      <AuthField label="License No." icon="card-outline" value={license} onChange={(v) => { setLicense(v); clearErr("license"); }} />
                      {fieldError("license")}
                    </View>
                    {driverType === "PUJ / PUV driver" ? (
                      <View style={{ gap: 7 }}>
                        <Text style={[ps.small, { fontWeight: "700", color: "#18382C" }]}>Business / Franchise</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel={franchiseName ? `Business or franchise: ${franchiseName}` : "Select business or franchise"} accessibilityState={{ expanded: franchiseOpen }} onPress={() => setFranchiseOpen((v) => !v)} style={[ps.input, ps.row, { paddingVertical: 0, minHeight: 54, justifyContent: "space-between", borderColor: fieldErr.franchise ? "#C53B1D" : undefined }]}>
                          <Text style={{ flex: 1, color: franchiseName ? c.ink : "#A2B0A7", fontSize: 14 }} numberOfLines={1}>{franchiseName || "Select business / franchise"}</Text>
                          <Icon name={franchiseOpen ? "chevron-up-outline" : "chevron-down-outline"} size={20} color="#6A7E73" />
                        </Pressable>
                        {franchiseOpen ? (
                          <View style={[ps.input, { paddingVertical: 4, gap: 2 }]}>
                            {[KENT_OWNER_FRANCHISE, "North Samar Transport Coop", "Samar PUJ Operators Association", "Visayas Commuter Lines"].map((item) => (
                              <Pressable key={item} accessibilityRole="radio" accessibilityState={{ selected: franchiseName === item }} onPress={() => { setFranchiseName(item); setFranchiseOpen(false); clearErr("franchise"); }} style={{ paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10, backgroundColor: franchiseName === item ? c.brandSoft : "transparent" }}>
                                <Text style={[ps.body, { color: franchiseName === item ? c.ink : c.ink, fontWeight: franchiseName === item ? "700" : "500" }]}>{item}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                        {fieldError("franchise")}
                      </View>
                    ) : (
                      <>
                        <View style={{ gap: 4 }}>
                          <AuthField
                            label="Plate No."
                            icon="bicycle-outline"
                            value={plate}
                            onChange={(v) => { setPlate(formatPlate(v)); clearErr("plate"); }}
                            placeholder="LL-DDDDD"
                            maxLength={8}
                            autoCapitalize="characters"
                          />
                          {fieldError("plate")}
                        </View>
                        <View style={{ gap: 7 }}>
                          <Text style={[ps.small, { fontWeight: "700", color: "#18382C" }]}>TODA (optional)</Text>
                          <Pressable accessibilityRole="button" accessibilityLabel={association ? `TODA: ${association}` : "Select TODA, optional"} accessibilityState={{ expanded: assocOpen }} onPress={() => setAssocOpen((v) => !v)} style={[ps.input, ps.row, { paddingVertical: 0, minHeight: 54, justifyContent: "space-between" }]}>
                            <Text style={{ flex: 1, color: association ? c.ink : "#A2B0A7", fontSize: 14 }} numberOfLines={1}>{association || "Select TODA / Not part of an association"}</Text>
                            <Icon name={assocOpen ? "chevron-up-outline" : "chevron-down-outline"} size={20} color="#6A7E73" />
                          </Pressable>
                          {assocOpen ? (
                            <View style={[ps.input, { paddingVertical: 4, gap: 2 }]}>
                              {[
                                { value: "", label: "Not part of an association / TODA" },
                                { value: "Magsaysay TODA", label: "Magsaysay TODA" },
                                { value: "Capoocan Tricycle Operators & Drivers Assn.", label: "Capoocan Tricycle Operators & Drivers Assn." },
                                { value: "Rawis Nijaga TODA", label: "Rawis \u201cNijaga TODA" },
                                { value: "Obrero Transport Cooperative", label: "Obrero Transport Cooperative" },
                                { value: "San Policarpo TODA", label: "San Policarpo TODA" },
                                { value: "Gadgaran Drivers Association", label: "Gadgaran Drivers Association" },
                              ].map((item) => (
                                <Pressable key={item.label} accessibilityRole="radio" accessibilityState={{ selected: association === item.value }} onPress={() => { setAssociation(item.value); setAssocOpen(false); }} style={{ paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10, backgroundColor: association === item.value ? c.brandSoft : "transparent" }}>
                                  <Text style={[ps.body, { color: association === item.value ? c.ink : c.ink, fontWeight: association === item.value ? "700" : "500" }]}>{item.label}</Text>
                                </Pressable>
                              ))}
                            </View>
                          ) : null}
                        </View>
                        <View style={{ gap: 4 }}>
                          <AuthField label="Permit No. (Prangkisa)" icon="document-text-outline" value={permitNo} onChange={(v) => { setPermitNo(v); clearErr("permit"); }} />
                          <Text style={[ps.small, { color: "#5B7468", flexWrap: "wrap" }]}>Prangkisa / Franchise Permit number. Required for every tricycle driver.</Text>
                          {fieldError("permit")}
                        </View>
                        <AuthField label="Passenger capacity" icon="people-outline" value={capacity} onChange={setCapacity} number />
                      </>
                    )}
                  </>
                )}
                {role === "Driver" && (
                  <View style={{ gap: 8 }}>
                    <Text style={[ps.small, { fontWeight: "700", color: "#18382C" }]}>Driver’s license photo</Text>
                    <Text style={[ps.small, { color: "#5B7468", flexWrap: "wrap" }]}>The front of your license, readable and uncropped. It is only used to review your application.</Text>
                    {licensePhoto ? (
                      <View style={[ps.row, { borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 10, gap: 12 }]}>
                        <Image
                          source={{ uri: licensePhoto.uri }}
                          style={{ width: 72, height: 48, borderRadius: 8, backgroundColor: "#E5F0E9" }}
                          accessibilityLabel="Photo of your driver's license"
                        />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[ps.small, { fontWeight: "700", color: c.ink }]}>License photo added</Text>
                          <Text style={[ps.small, { color: c.muted }]}>Sent for review after you confirm your email</Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Remove license photo"
                          hitSlop={8}
                          onPress={() => { setLicensePhoto(null); setFieldErr((e) => ({ ...e, doc: "" })); }}
                          style={{ padding: 6 }}
                        >
                          <Icon name="trash-outline" size={20} color={c.muted} />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={[ps.row, { gap: 10 }]}>
                        {([
                          { source: "camera", label: "Take photo", icon: "camera-outline" },
                          { source: "library", label: "Choose photo", icon: "image-outline" },
                        ] as const).map((option) => (
                          <Pressable
                            key={option.source}
                            accessibilityRole="button"
                            accessibilityLabel={`${option.label} of your driver's license`}
                            onPress={() => {
                              void pickLicensePhoto(option.source)
                                .then((photo) => {
                                  if (photo) {
                                    setLicensePhoto(photo);
                                    setFieldErr((e) => ({ ...e, doc: "" }));
                                  }
                                })
                                .catch((error: Error) => setFieldErr((e) => ({ ...e, doc: error.message })));
                            }}
                            style={({ pressed }) => [ps.buttonLight, ps.row, { flex: 1, minHeight: 48, justifyContent: "center", borderRadius: 14, gap: 8 }, pressed && ps.pressed]}
                          >
                            <Icon name={option.icon} size={19} color={c.ink} />
                            <Text style={[ps.buttonText, { color: c.ink, fontSize: 12 }]}>{option.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                    {fieldErr.doc ? (
                      <View accessibilityRole="alert" accessibilityLiveRegion="polite">
                        <Text style={[ps.small, { color: "#C53B1D", flexWrap: "wrap", paddingHorizontal: 4 }]}>{fieldErr.doc}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
{fieldError("form")}
                <SolidButton
                  title={
                    busy
                      ? role === "Driver"
                        ? "Processing application…"
                        : "Creating your account…"
                      : role === "Driver"
                        ? "Process Application"
                        : "Create account securely"
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

              {info ? (
                <View
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={{ backgroundColor: c.brandSoft, borderRadius: 12, padding: 14 }}
                >
                  <Text style={[ps.body, { color: c.ink, flexWrap: "wrap" }]}>{info}</Text>
                </View>
              ) : null}

              <View style={{ gap: 4 }}>
                <AuthField
                  label="Email address"
                  icon="mail-outline"
                  value={email}
                  onChange={(v) => { setEmail(v); clearErr("email"); }}
                />
                {fieldError("email")}
              </View>
              <View style={{ gap: 4 }}>
                <AuthField
                  label="Password"
                  icon="lock-closed-outline"
                  value={password}
                  onChange={(v) => { setPassword(v); clearErr("password"); }}
                  secret
                />
                {fieldError("password")}
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={sendPasswordReset}
                  hitSlop={8}
                  style={{ alignSelf: "flex-end", paddingVertical: 6, paddingHorizontal: 4 }}
                >
                  <Text style={[ps.small, { color: c.ink, fontWeight: "700" }]}>Forgot password?</Text>
                </Pressable>
              </View>

              <SolidButton
                title={busy ? "Signing in..." : "Sign in"}
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
                  <Text style={{ color: c.ink, fontWeight: "700" }}>Create an account</Text>
                </Text>
              </Pressable>

             
            </Animated.View>
          </GestureDetector>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
