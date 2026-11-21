import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "../common/ui";
import { haptic } from "../common/haptics";
import { passengerColors as c, ps } from "./passengerStyles";

const WORDS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

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
  const shown = rating || picked;
  const first = driver?.split(" ")[0];

  if (rating) {
    return (
      <View
        accessible
        accessibilityLabel={`You rated this ride ${rating} out of 5`}
        style={{ alignItems: "center", gap: 6 }}
      >
        <View style={{ flexDirection: "row", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Icon
              key={value}
              name={value <= rating ? "star" : "star-outline"}
              size={20}
              color={c.amber}
            />
          ))}
        </View>
        <Text style={ps.small}>
          You rated this ride {WORDS[rating].toLowerCase()}. Thanks for helping
          keep Angkol drivers accountable.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={[ps.label, { textAlign: "center" }]}>
        How was your ride{first ? ` with ${first}` : ""}?
      </Text>
      <View style={[ps.row, { justifyContent: "space-around" }]}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${value} out of 5`}
            accessibilityState={{ disabled: !!disabled, selected: picked === value }}
            disabled={disabled || picked > 0}
            onPress={() => {
              haptic.select();
              setPicked(value);
              void onRate(value).then((saved) => {
                if (!saved) {
                  setPicked(0);
                }
              });
            }}
            style={({ pressed }) => [ps.star, pressed && { transform: [{ scale: 0.94 }] }]}
          >
            <Icon
              name={value <= shown ? "star" : "star-outline"}
              size={27}
              color={c.amber}
            />
          </Pressable>
        ))}
      </View>
      <Text style={[ps.small, { textAlign: "center", minHeight: 17 }]}>
        {picked ? `${WORDS[picked]} — saving your rating` : "One tap. Ratings can't be changed later."}
      </Text>
    </View>
  );
}
