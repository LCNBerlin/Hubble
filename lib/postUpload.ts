import supabase from "./supabase";

const POSTS_BUCKET = "posts";

function getExtensionAndContentType(
  type: "picture" | "video" | "audio",
  mimeType?: string | null
): { ext: string; contentType: string } {
  const m = mimeType?.toLowerCase() ?? "";
  if (type === "picture") {
    if (m.includes("png")) return { ext: "png", contentType: "image/png" };
    if (m.includes("gif")) return { ext: "gif", contentType: "image/gif" };
    if (m.includes("webp")) return { ext: "webp", contentType: "image/webp" };
    if (m.includes("heic")) return { ext: "heic", contentType: "image/heic" };
    if (m.includes("bmp")) return { ext: "bmp", contentType: "image/bmp" };
    if (m.includes("tiff")) return { ext: "tiff", contentType: "image/tiff" };
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (type === "video") {
    if (m.includes("mp4") || m.includes("x-mp4")) return { ext: "mp4", contentType: "video/mp4" };
    if (m.includes("quicktime") || m.includes("mov")) return { ext: "mov", contentType: "video/quicktime" };
    if (m.includes("webm")) return { ext: "webm", contentType: "video/webm" };
    if (m.includes("3gpp") || m.includes("3gp")) return { ext: "3gp", contentType: "video/3gpp" };
    if (m.includes("3g2")) return { ext: "3g2", contentType: "video/3gpp2" };
    if (m.includes("matroska") || m.includes("mkv")) return { ext: "mkv", contentType: "video/x-matroska" };
    if (m.includes("mpeg") || m.includes("mpg")) return { ext: "mpg", contentType: "video/mpeg" };
    if (m.includes("avi") || m.includes("msvideo")) return { ext: "avi", contentType: "video/x-msvideo" };
    if (m.includes("ogg") && m.includes("video")) return { ext: "ogv", contentType: "video/ogg" };
    if (m.includes("flv")) return { ext: "flv", contentType: "video/x-flv" };
    if (m.includes("wmv") || m.includes("x-ms-wmv")) return { ext: "wmv", contentType: "video/x-ms-wmv" };
    if (m.includes("hevc") || m.includes("h265")) return { ext: "mp4", contentType: "video/mp4" };
    return { ext: "mp4", contentType: "video/mp4" };
  }
  if (type === "audio") {
    if (m.includes("mpeg") || m.includes("mp3")) return { ext: "mp3", contentType: "audio/mpeg" };
    if (m.includes("wav")) return { ext: "wav", contentType: "audio/wav" };
    if (m.includes("ogg") && m.includes("audio")) return { ext: "ogg", contentType: "audio/ogg" };
    if (m.includes("ogg")) return { ext: "ogg", contentType: "audio/ogg" };
    if (m.includes("aac")) return { ext: "aac", contentType: "audio/aac" };
    if (m.includes("flac")) return { ext: "flac", contentType: "audio/flac" };
    if (m.includes("webm") && m.includes("audio")) return { ext: "weba", contentType: "audio/webm" };
    if (m.includes("x-m4a") || m.includes("m4a")) return { ext: "m4a", contentType: "audio/x-m4a" };
    return { ext: "mp3", contentType: "audio/mpeg" };
  }
  return { ext: "bin", contentType: "application/octet-stream" };
}

/**
 * Upload post media from a local file URI to Supabase Storage and return the public URL.
 * Use this before inserting a post so media_uri is a public URL that loads in the feed.
 * Bucket "posts" must exist with public read access.
 */
export async function uploadPostMedia(
  userId: string,
  localUri: string,
  type: "picture" | "video" | "audio",
  mimeType?: string | null
): Promise<string | null> {
  if (!supabase || !localUri?.trim()) return null;
  const { ext, contentType } = getExtensionAndContentType(type, mimeType);
  const path = `${userId}/${Date.now()}.${ext}`;
  try {
    const response = await fetch(localUri, { method: "GET" });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const { error } = await supabase.storage.from(POSTS_BUCKET).upload(path, arrayBuffer, {
      contentType,
      upsert: false,
    });
    if (error) {
      const msg = error.message || String(error);
      console.warn("Post media upload failed:", error);
      throw new Error(`Upload failed: ${msg}`);
    }
    const { data: urlData } = supabase.storage.from(POSTS_BUCKET).getPublicUrl(path);
    return urlData.publicUrl;
  } catch (e) {
    if (e instanceof Error) throw e;
    console.warn("Post media upload error:", e);
    throw new Error("Post media upload failed. Check Storage: bucket 'posts' exists and is public.");
  }
}
