import { decode } from "base64-arraybuffer";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking } from "react-native";
import supabase from "./supabase";

const PROFILE_BUCKET = "profile";

/** Supported image MIME types and their file extensions for upload. */
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

/** Only the account owner should call this. Picks a photo for profile picture (images only; video selection is rejected). */
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

/** Only the account owner should call this. Picks a photo for banner (images only; video selection is rejected). */
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
 * Upload profile image (avatar or banner) to Supabase Storage and return the public URL.
 * Handles JPEG, PNG, GIF, WebP, HEIC, HEIF, BMP, ICO, etc. Bucket "profile" must exist with public read.
 *
 * Throws an Error when upload or URL generation fails so callers can surface a clear message.
 */
export async function uploadProfileImage(
  userId: string,
  kind: "avatar" | "banner",
  base64Data: string,
  mimeType?: string
): Promise<string> {
  if (!supabase) {
    throw new Error("Storage client is not configured.");
  }
  const { contentType, ext } = getContentTypeAndExt(mimeType);
  const path = `${kind === "avatar" ? "avatars" : "banners"}/${userId}.${ext}`;
  try {
    const arrayBuffer = decode(base64Data);
    const { error } = await supabase.storage.from(PROFILE_BUCKET).upload(path, arrayBuffer, {
      contentType,
      upsert: true,
    });
    if (error) {
      console.warn("Profile image upload failed:", error);
      throw new Error(error.message || "Upload to profile storage failed.");
    }
    const { data: urlData, error: urlError } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path);
    if (urlError) {
      console.warn("Profile image public URL error:", urlError);
      throw new Error(urlError.message || "Could not generate public URL for profile image.");
    }
    if (!urlData?.publicUrl) {
      throw new Error("Profile image URL is missing.");
    }
    return urlData.publicUrl;
  } catch (e) {
    console.warn("Profile image upload error:", e);
    if (e instanceof Error) {
      throw e;
    }
    throw new Error("Unexpected error while uploading profile image.");
  }
}
