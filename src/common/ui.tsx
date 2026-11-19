import React, { useRef, useState } from "react";
import { View, Text, Pressable, TextInput, Animated } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { s } from "./styles";
export const money = (n: number) => `₱${n.toFixed(2)}`;
export function Icon({
  name,
  size = 22,
  color = "#176B48",
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const [pulse] = useState(() => new Animated.Value(1));
  const pulseAnim = useRef<Animated.CompositeAnimation | null>(null);

  React.useEffect(() => () => { pulseAnim.current?.stop(); }, []);

  const handlePress = () => {
    if (disabled) { return; }
    pulseAnim.current?.stop();
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 90, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1.04, friction: 3, tension: 110, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    pulse.setValue(1);
    pulseAnim.current = Animated.sequence([
      Animated.timing(pulse, { toValue: 1.03, duration: 180, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1.015, duration: 180, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]);
    pulseAnim.current.start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: Animated.multiply(scale, pulse) }] }}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={handlePress}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          s.button,
          secondary && s.secondary,
          disabled && { opacity: 0.45 },
          pressed && { opacity: 0.76 },
        ]}
      >
        <Text style={[s.buttonText, secondary && { color: "#176B48" }]} numberOfLines={2} adjustsFontSizeToFit>
          {title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
export function Popover({
  visible,
  content,
  children,
}: {
  visible: boolean;
  content: React.ReactNode;
  children: React.ReactNode;
}) {
  const [scale] = useState(() => new Animated.Value(0.95));
  const [opacity] = useState(() => new Animated.Value(0));
  React.useEffect(() => {
    if (visible) {
      scale.setValue(0.95);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.95);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

  return (
    <View style={{ position: "relative" }}>
      {children}
      {visible ? <Animated.View style={[s.popover, { transform: [{ scale }], opacity }]}>{content}</Animated.View> : null}
    </View>
  );
}
export function Field({
  label,
  value,
  onChange,
  numeric = false,
  secret = false,
  multiline = false,
  light = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  secret?: boolean;
  multiline?: boolean;
  light?: boolean;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={[s.label, light && { color: "white" }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholder={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secret}
        multiline={multiline}
        keyboardType={
          numeric
            ? "numeric"
            : label.toLowerCase().includes("email")
              ? "email-address"
              : "default"
        }
        autoCapitalize={
          secret || label.toLowerCase().includes("email") ? "none" : "sentences"
        }
        autoCorrect={!secret}
        style={[
          s.input,
          light && {
            backgroundColor: "rgba(255,255,255,.94)",
            borderColor: "rgba(255,255,255,.55)",
          },
        ]}
      />
    </View>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.badge}>
      <Text style={s.badgeText}>{children}</Text>
    </View>
  );
}
export function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.heading}>{title}</Text>
      {Boolean(sub) && <Text style={s.body}>{sub}</Text>}
    </View>
  );
}
export function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        s.chip,
        selected && { backgroundColor: "#DDEEE4", borderColor: "#176B48" },
      ]}
    >
      <Text style={[s.label, { lineHeight: 20, flexShrink: 0 }]}>{label}</Text>
    </Pressable>
  );
}
