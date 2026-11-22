import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { haptic } from "../common/haptics";
import { passengerColors as c, ps } from "./passengerStyles";

/** Three choices instead of five stars. Stored on the same 1–5 scale. */
const CHOICES = [
  { value: 1, word: "Diri maupay", english: "Not good" },
  { value: 3, word: "Okay", english: "Fine" },
  { value: 5, word: "Maupay", english: "Good" },
];
const nearest = (rating: number) =>
  CHOICES.reduce((best, item) => (Math.abs(item.value - rating) < Math.abs(best.value - rating) ? item : best));

export function RateTrip({
  rating,
  driver,
  disabled,
  onRate,
}: {
  rating: number | null | undefined;
  driver?: string | null;
  disabled?: boolean;
  onRate: (value: number) => Promise<boolean>;
}) {
  const [picked, setPicked] = useState(0);
  const first = driver?.split(" ")[0];
  const chosen = rating ? nearest(rating).value : picked;

  return (
    <View style={{ gap: 10 }}>
      <Text style={ps.section}>
        {rating ? "Your rating" : `How was the ride${first ? ` with ${first}` : ""}?`}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {CHOICES.map((item) => {
          const on = chosen === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityLabel={`${item.english} (${item.word})`}
              accessibilityState={{ disabled: !!disabled || !!rating, selected: on }}
              disabled={disabled || !!rating || picked > 0}
              onPress={() => {
                haptic.select();
                setPicked(item.value);
                void onRate(item.value).then((saved) => {
                  if (!saved) {
                    setPicked(0);
                  }
                });
              }}
              style={({ pressed }) => [
                {
                  flex: 1,
                  minHeight: 64,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: on ? c.ink : "#C9CBC5",
                  backgroundColor: on ? c.ink : "#FFFFFF",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 4,
                  opacity: chosen && !on ? 0.5 : 1,
                },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text style={[ps.label, { textAlign: "center" }, on && { color: "#FFFFFF" }]} numberOfLines={1} adjustsFontSizeToFit>
                {item.word}
              </Text>
              <Text style={[ps.tiny, { color: on ? "#FFFFFF" : c.ink }]}>{item.english}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={ps.tiny}>
        {rating || picked ? "Thanks. It helps the city keep drivers accountable." : "One tap. You can’t change it later."}
      </Text>
    </View>
  );
}
