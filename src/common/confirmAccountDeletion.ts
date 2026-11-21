import { Alert, Platform } from "react-native";

const title = "Delete your account?";
const message =
  "This permanently deletes your Angkol account, profile, and ride history. It can't be undone.";

export function confirmAccountDeletion(onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: "Keep account", style: "cancel" },
    { text: "Delete account", style: "destructive", onPress: onConfirm },
  ]);
}
