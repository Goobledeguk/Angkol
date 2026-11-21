import { Share as RNShare } from "react-native";
import * as ExpoLinking from "expo-linking";
import * as ImagePicker from "expo-image-picker";

export const Share = {
  async share(content: { title?: string; message: string }) {
    await RNShare.share(content);
  },
};

export const Linking = {
  async openURL(url: string) {
    if (!url) {return;}
    await ExpoLinking.openURL(url);
  },
};

export async function pickDriverPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Photo library permission is required to change your photo.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.4,
    base64: true,
  });
  const asset = result.canceled ? null : result.assets?.[0];
  return asset?.base64 ? `data:image/jpeg;base64,${asset.base64}` : null;
}
