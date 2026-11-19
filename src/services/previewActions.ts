import { Alert } from "react-native";
export const Share = {
  async share(_content: { title?: string; message: string }) {
    Alert.alert(
      "Share preview",
      "This action is simulated. Nothing was shared.",
    );
  },
};
export const Linking = {
  async openURL(_url: string) {
    Alert.alert(
      "Contact preview",
      "Calls and directions are simulated in this static prototype.",
    );
  },
};
export async function pickDriverPhoto(): Promise<string | null> {
  Alert.alert(
    "Photo preview",
    "The profile image stays local in this prototype.",
  );
  return null;
}
