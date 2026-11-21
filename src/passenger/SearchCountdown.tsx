import { Text, View } from "react-native";
import Reanimated from "react-native-reanimated";
import { useNow } from "../common/useNow";
import { passengerColors as c, ps } from "./passengerStyles";

const WINDOW_MS = 10 * 60 * 1000;

function clock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function SearchCountdown({ expires }: { expires: number }) {
  const now = useNow(1000);
  const left = Math.max(0, expires - now);
  const share = Math.min(1, left / WINDOW_MS);
  const late = left < 60_000;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Time left to find a driver"
      accessibilityValue={{ min: 0, max: 600, now: Math.round(left / 1000), text: clock(left) }}
      style={{ gap: 10 }}
    >
      <View style={[ps.between, { alignItems: "baseline" }]}>
        <Text style={[ps.label, { color: c.green }]}>
          {left === 0 ? "Closing the search…" : late ? "Last call for nearby drivers" : "Asking nearby drivers"}
        </Text>
        <Text
          style={[
            ps.label,
            { fontVariant: ["tabular-nums"], color: late ? "#9A5B13" : c.ink },
          ]}
        >
          {clock(left)}
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: "#E6EEE8", overflow: "hidden" }}>
        <Reanimated.View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${share * 100}%`,
            borderRadius: 3,
            backgroundColor: late ? c.amber : c.green,
            transitionProperty: ["width", "backgroundColor"],
            transitionDuration: 1000,
            transitionTimingFunction: "linear",
          }}
        />
      </View>
      <Text style={ps.small}>
        Requests stay open for 10 minutes. If nobody accepts, you can send it again in one tap.
      </Text>
    </View>
  );
}
