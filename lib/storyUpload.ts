import { decode } from "base64-arraybuffer";
import supabase from "./supabase";

const STORIES_BUCKET = "stories";

function getContentTypeAndExt(mimeType: string | undefined): { contentType: string; ext: string } {
  const normalized = mimeType?.toLowerCase().trim();
  if (normalized?.startsWith("image/")) {
    const ext = normalized.includes("jpeg") || normalized.includes("jpg") ? "jpg" : "png";
    return { contentType: normalized, ext };
  }
  return { contentType: "image/jpeg", ext: "jpg" };
}

/**
 * Upload story image to Supabase Storage and return the public URL.
 * Bucket "stories" must exist with public read.
 */
export async function uploadStoryImage(
  userId: string,
  base64Data: string,
  mimeType?: string
): Promise<string | null> {
  if (!supabase) return null;
  const { contentType, ext } = getContentTypeAndExt(mimeType);
  const path = `${userId}/${Date.now()}.${ext}`;
  try {
    const arrayBuffer = decode(base64Data);
    const { error } = await supabase.storage.from(STORIES_BUCKET).upload(path, arrayBuffer, {
      contentType,
      upsert: false,
    });
    if (error) {
      console.warn("Story upload failed:", error);
      return null;
    }
    const { data: urlData } = supabase.storage.from(STORIES_BUCKET).getPublicUrl(path);
    return urlData.publicUrl;
  } catch (e) {
    console.warn("Story upload error:", e);
    return null;
  }
}
