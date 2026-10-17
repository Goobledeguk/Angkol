import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from "react-native";
import { registerSampleAccount, signInSampleAccount } from "./sampleAccounts";
import type { Role } from "./types";
import { Icon } from "./ui";
import { ps, passengerColors as c } from "./passengerStyles";

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
      style={[ps.button, { minHeight: 54 }, disabled && { opacity: 0.45 }]}
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
  const scroll = useRef<ScrollView>(null);

  const [signup, setSignup] = useState(false),
    [step, setStep] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [role, setRole] = useState<"Commuter" | "Driver">("Commuter"),
    [driverType, setDriverType] = useState<Role>("Tricycle driver");
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [license, setLicense] = useState(""),
    [association, setAssociation] = useState(""),
    [plate, setPlate] = useState(""),
    [capacity, setCapacity] = useState("3"),
    [consent, setConsent] = useState(false);
  function changeMode(create: boolean) {
    setSignup(create);
    setStep(1);
    setError("");
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
    setBusy(true);
    setError("");
    try {
      if (signup) {
        await registerSampleAccount({
          email,
          password,
          name: name.trim(),
          role: role === "Driver" ? driverType : "Passenger",
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
  const privacy = () =>
    Alert.alert(
      "Your account & location",
      "This standalone prototype uses sample accounts and trips. Sign-in and registration are simulated locally. No account information is saved or sent. Location access is simulated.",
    );
  const requirements = [
    { label: "10+ characters", valid: password.length >= 10 },
    { label: "1 number", valid: /\d/.test(password) },
    { label: "1 uppercase", valid: /[A-Z]/.test(password) },
  ];
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!signup) {
          return false;
        }
        if (step === 2) {
          setStep(1);
        } else {
          setSignup(false);
        }
        setError("");
        return true;
      },
    );
    return () => subscription.remove();
  }, [signup, step]);
  useEffect(() => {
    if (error) {
      scroll.current?.scrollTo({ y: 0, animated: true });
    }
  }, [error]);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: signup ? c.background : c.green }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {!signup && (
          <View
            style={{
              height: 294,
              padding: 25,
              paddingTop: 26,
              backgroundColor: c.green,
            }}
          >
            <View style={ps.between}>
              <View style={ps.row}>
                <View
                  style={[
                    ps.iconButton,
                    { width: 43, minHeight: 45, borderRadius: 13 },
                  ]}
                >
                  <Icon name="bus-outline" size={28} />
                </View>
                <Text
                  style={{ color: "white", fontSize: 29, fontWeight: "800" }}
                >
                  Angkol
                </Text>
              </View>
              <View
                style={[
                  ps.pill,
                  { backgroundColor: "#FFF0D4", paddingHorizontal: 11 },
                ]}
              >
                <Icon name="location-outline" size={14} color="#976526" />
                <Text style={{ color: "#976526", fontSize: 12 }}>
                  Calbayog City
                </Text>
              </View>
            </View>
            <Text
              style={{
                color: "white",
                fontSize: 32,
                lineHeight: 38,
                fontWeight: "400",
                marginTop: 23,
              }}
            >
              Your local ride,{"\n"}made clearer.
            </Text>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                position: "absolute",
                right: 23,
                bottom: 18,
                flexDirection: "row",
                alignItems: "flex-end",
                gap: 3,
              }}
            >
              <View style={{ transform: [{ rotate: "-4deg" }] }}>
                <Icon name="bicycle" size={78} color="#DCA641" />
              </View>
              <Icon name="bus" size={89} color="#EAC477" />
              <Icon name="bus-outline" size={66} color="#E9AD4A" />
            </View>
          </View>
        )}
        <View
          style={
            signup
              ? {
                  flex: 1,
                  paddingHorizontal: 25,
                  paddingTop: 24,
                  paddingBottom: 35,
                  gap: 19,
                }
              : {
                  flex: 1,
                  backgroundColor: "white",
                  borderTopLeftRadius: 30,
                  borderTopRightRadius: 30,
                  padding: 25,
                  gap: 18,
                }
          }
        >
          {signup ? (
            <>
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
                  <Text style={[ps.heading, { fontSize: 25 }]}>
                    Create your account
                  </Text>
                  <Text style={ps.body}>
                    {role} registration · Step {step} of 2
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
                <Text style={[ps.section, { fontSize: 23 }]}>
                  {step === 1
                    ? "Basic information"
                    : role === "Driver"
                      ? "Driver & vehicle details"
                      : "Review your account"}
                </Text>
                <Text style={[ps.body, { fontSize: 13, marginTop: 7 }]}>
                  {step === 1
                    ? "Use the name shown on your valid ID. We only share what is needed for a safe trip."
                    : role === "Driver"
                      ? "The administrator reviews your details before you can accept rides."
                      : "Make sure your details are correct. You will sign in with your email and password."}
                </Text>
              </View>
            </>
          ) : (
            <View>
              <Text style={[ps.heading, { fontSize: 25 }]}>
                Sign in to Angkol
              </Text>
              <Text style={[ps.body, { fontSize: 13, marginTop: 5 }]}>
                Sign in with your email and password to continue.
              </Text>
            </View>
          )}
          {signup && step === 1 && (
            <View style={{ gap: 10 }}>
              {(
                [
                  {
                    name: "Commuter",
                    sub: "Book rides and find routes",
                    icon: "person-outline",
                  },
                  {
                    name: "Driver",
                    sub: "Tricycle or PUJ/PUV partner",
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
                    <View style={{ flex: 1 }}>
                      <Text style={[ps.section, { fontSize: 16 }]}>
                        {item.name}
                      </Text>
                      <Text style={ps.body}>{item.sub}</Text>
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
              <Text style={ps.hintText}>{error}</Text>
            </View>
          )}
          {signup && step === 1 && (
            <>
              <AuthField
                label="Full name"
                icon="person-outline"
                value={name}
                onChange={setName}
              />
              <AuthField
                label="Mobile number"
                icon="phone-portrait-outline"
                value={phone}
                onChange={setPhone}
                phone
              />
            </>
          )}
          {(!signup || step === 1) && (
            <>
              <AuthField
                label="Email address"
                icon="mail-outline"
                value={email}
                onChange={setEmail}
              />
              <AuthField
                label={signup ? "Create password" : "Password"}
                icon="lock-closed-outline"
                value={password}
                onChange={setPassword}
                secret
              />
            </>
          )}
          {signup && step === 1 && (
            <>
              <View style={ps.tabRow}>
                {requirements.map((rule) => (
                  <View
                    key={rule.label}
                    style={[
                      ps.pill,
                      { backgroundColor: rule.valid ? "#DBEEE3" : "#E9EEEA" },
                    ]}
                  >
                    <Icon
                      name={rule.valid ? "checkmark" : "ellipse-outline"}
                      size={14}
                      color={rule.valid ? c.green : c.muted}
                    />
                    <Text
                      style={[ps.pillText, !rule.valid && { color: c.muted }]}
                    >
                      {rule.label}
                    </Text>
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
                onPress={() => setConsent(!consent)}
                style={[ps.row, { alignItems: "flex-start" }]}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: c.green,
                    backgroundColor: consent ? c.green : "white",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {consent && <Icon name="checkmark" size={19} color="white" />}
                </View>
                <Text style={[ps.body, { flex: 1 }]}>
                  I understand how Angkol uses my account and optional location
                  information for trips.
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={privacy}>
                <Text style={[ps.textLink, { textAlign: "left" }]}>
                  View account & location information
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
          {signup && step === 2 && (
            <>
              <View style={ps.card}>
                <Text style={ps.section}>{name}</Text>
                <Text style={ps.body}>{phone}</Text>
                <Text style={ps.body}>{email}</Text>
                <Text style={[ps.small, { color: c.green }]}>
                  {role === "Driver" ? "Driver partner" : "Commuter account"} ·
                  Email/password sign-in
                </Text>
              </View>
              {role === "Driver" && (
                <>
                  <View style={ps.tabRow}>
                    {(["Tricycle driver", "PUJ / PUV driver"] as Role[]).map(
                      (kind) => (
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ checked: driverType === kind }}
                          key={kind}
                          onPress={() => setDriverType(kind)}
                          style={[
                            ps.pill,
                            driverType !== kind && {
                              backgroundColor: "#E5EDE7",
                            },
                          ]}
                        >
                          <Text style={ps.pillText}>{kind}</Text>
                        </Pressable>
                      ),
                    )}
                  </View>
                  <AuthField
                    label="Professional license number"
                    icon="card-outline"
                    value={license}
                    onChange={setLicense}
                  />
                  <AuthField
                    label="Association or cooperative"
                    icon="people-outline"
                    value={association}
                    onChange={setAssociation}
                  />
                  <AuthField
                    label="Plate or body number"
                    icon="bicycle-outline"
                    value={plate}
                    onChange={setPlate}
                  />
                  <AuthField
                    label="Passenger capacity"
                    icon="people-outline"
                    value={capacity}
                    onChange={setCapacity}
                    number
                  />
                </>
              )}
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
          {!signup && (
            <>
              <SolidButton
                title={busy ? "Signing in…" : "Continue securely"}
                onPress={submit}
                disabled={busy}
              />
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => changeMode(true)}
                style={{ paddingVertical: 4 }}
              >
                <Text style={[ps.body, { textAlign: "center", fontSize: 13 }]}>
                  New to Angkol?{" "}
                  <Text style={{ color: c.green }}>Create an account</Text>
                </Text>
              </Pressable>
            </>
          )}
          <View style={[ps.row, { alignItems: "flex-start", paddingTop: 2 }]}>
            <Icon name="shield-checkmark-outline" size={18} />
            <Text style={[ps.small, { flex: 1 }]}>
              {signup
                ? "Email/password protected · You control location access. Driver accounts need administrator approval."
                : "Email/password protected · Role-based access · Your saved account role determines your access."}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
