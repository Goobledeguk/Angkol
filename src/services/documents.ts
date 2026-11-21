import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "./supabase";

export type LicensePhoto = { uri: string; base64: string; width: number; height: number };

const MAX_BASE64 = 1_500_000;
const PENDING_KEY = "angkol:pending-license:";
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

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

function decodeBase64(base64: string): ArrayBuffer {
  const encoded = base64.replace(/=+$/, "");
  if (
    !encoded ||
    /[^A-Za-z0-9+/]/.test(encoded) ||
    encoded.length % 4 === 1 ||
    (encoded.length !== base64.length && base64.length !== Math.ceil(encoded.length / 4) * 4)
  ) {
    throw new Error("Invalid license photo data.");
  }
  const buffer = new ArrayBuffer(Math.floor((encoded.length * 6) / 8));
  const bytes = new Uint8Array(buffer);
  let value = 0;
  let bits = 0;
  let index = 0;
  for (const character of encoded) {
    value = (value << 6) | BASE64.indexOf(character);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index++] = (value >> bits) & 0xff;
    }
  }
  return buffer;
}

export async function uploadLicense(userId: string, base64: string): Promise<void> {
  const photo = decodeBase64(base64);
  const client = db();
  const { error: uploadError } = await client.storage
    .from("driver-documents")
    .upload(`license/${userId}.jpg`, photo, { contentType: "image/jpeg", upsert: true });
  if (uploadError) {
    throw uploadError;
  }

  const { data, error: updateError } = await client
    .from("drivers")
    .update({ license_doc_attached: true })
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (updateError) {
    throw updateError;
  }
  if (!data) {
    throw new Error("Could not attach the license photo to the driver profile.");
  }
}

export async function uploadPendingLicense(userId: string, email: string): Promise<boolean> {
  try {
    const base64 = await readPendingLicense(email);
    if (base64 === null) {
      return false;
    }
    await uploadLicense(userId, base64);
    if ((await readPendingLicense(email)) === base64) {
      await clearPendingLicense(email);
    }
    return true;
  } catch {
    return false;
  }
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
