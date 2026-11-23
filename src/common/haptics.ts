import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const native = Platform.OS === "ios" || Platform.OS === "android";

function run(task: () => Promise<void>) {
  if (native) {
    task().catch(() => undefined);
  }
}

export const haptic = {
  select: () => run(() => Haptics.selectionAsync()),
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () =>
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () =>
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
