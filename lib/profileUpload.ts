import { decode } from "base64-arraybuffer";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking } from "react-native";
import { uploadToS3 } from "./s3-upload";

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/bmp": "bmp",
  "image/x-icon": "ico",
};

function getContentTypeAndExt(mimeType: string | undefined): { contentType: string; ext: string } {
  const normalized = mimeType?.toLowerCase().trim();
  if (normalized && normalized.startsWith("image/")) {
    const ext = IMAGE_MIME_TO_EXT[normalized] ?? normalized.replace("image/", "").split("+")[0] ?? "jpg";
    return { contentType: normalized, ext: ext === "jpeg" ? "jpg" : ext };
  }
  return { contentType: "image/jpeg", ext: "jpg" };
}

export type PickImageResult = { uri: string; base64: string; mimeType?: string } | null;

/** Only the account owner should call this. Picks a photo for profile picture (images only). */
export async function pickProfileImage(): Promise<PickImageResult> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Photo access",
      "Photo library access is needed to choose a picture. You can enable it in Settings.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]
    );
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    base64: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.type === "video") {
    Alert.alert("Use a photo", "Please choose a photo for your profile picture. Videos are not supported.");
    return null;
  }
  const base64 = asset.base64;
  if (!base64) return null;
  return { uri: asset.uri, base64, mimeType: asset.mimeType ?? "image/jpeg" };
}

/** Only the account owner should call this. Picks a photo for banner (images only). */
export async function pickBannerImage(): Promise<PickImageResult> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Photo access",
      "Photo library access is needed to choose a banner. You can enable it in Settings.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]
    );
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [3, 1],
    quality: 0.8,
    base64: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.type === "video") {
    Alert.alert("Use a photo", "Please choose a photo for your banner. Videos are not supported.");
    return null;
  }
  const base64 = asset.base64;
  if (!base64) return null;
  return { uri: asset.uri, base64, mimeType: asset.mimeType ?? "image/jpeg" };
}

/**
 * Upload profile image (avatar or banner) to S3 via NestJS presigned URL and return the public URL.
 * Throws on failure so callers can surface a clear message.
 */
export async function uploadProfileImage(
  userId: string,
  kind: "avatar" | "banner",
  base64Data: string,
  mimeType?: string,
  authToken?: string
): Promise<string> {
  const { contentType, ext } = getContentTypeAndExt(mimeType);
  const key = `${kind === "avatar" ? "avatars" : "banners"}/${userId}.${ext}`;
  try {
    const arrayBuffer = decode(base64Data);
    return await uploadToS3("profiles", key, arrayBuffer, contentType, authToken);
  } catch (e) {
    console.warn("Profile image upload error:", e);
    if (e instanceof Error) throw e;
    throw new Error("Unexpected error while uploading profile image.");
  }
}
