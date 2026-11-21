import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type LicensePhoto = { uri: string; base64: string; width: number; height: number };

const MAX_BASE64 = 1_500_000;
const PENDING_KEY = "angkol:pending-license:";

const pendingKey = (email: string) => PENDING_KEY + email.trim().toLowerCase();

export async function savePendingLicense(email: string, photo: LicensePhoto) {
  await AsyncStorage.setItem(pendingKey(email), photo.base64);
}

export async function readPendingLicense(email: string): Promise<string | null> {
  if (!email.trim()) {
    return null;
  }
  return AsyncStorage.getItem(pendingKey(email));
}

export async function clearPendingLicense(email: string) {
  await AsyncStorage.removeItem(pendingKey(email));
}

export async function pickLicensePhoto(source: "camera" | "library"): Promise<LicensePhoto | null> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      source === "camera"
        ? "Camera access is off. Allow it in Settings, or choose a photo instead."
        : "Photo access is off. Allow it in Settings, or take a photo instead.",
    );
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.5,
    base64: true,
  };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset?.base64) {
    return null;
  }
  if (asset.base64.length > MAX_BASE64) {
    throw new Error("That photo is too large. Take it a little further away and try again.");
  }
  return { uri: asset.uri, base64: asset.base64, width: asset.width, height: asset.height };
}
