import { decode } from "base64-arraybuffer";
import { uploadToS3 } from "./s3-upload";

function getContentTypeAndExt(mimeType: string | undefined): { contentType: string; ext: string } {
  const normalized = mimeType?.toLowerCase().trim();
  if (normalized?.startsWith("image/")) {
    const ext = normalized.includes("jpeg") || normalized.includes("jpg") ? "jpg" : "png";
    return { contentType: normalized, ext };
  }
  return { contentType: "image/jpeg", ext: "jpg" };
}

/**
 * Upload story image to S3 via NestJS presigned URL and return the public URL.
 */
export async function uploadStoryImage(
  userId: string,
  base64Data: string,
  mimeType?: string,
): Promise<string | null> {
  const { contentType, ext } = getContentTypeAndExt(mimeType);
  const key = `${userId}/${Date.now()}.${ext}`;
  try {
    const arrayBuffer = decode(base64Data);
    return await uploadToS3("stories", key, arrayBuffer, contentType);
  } catch (e) {
    console.warn("Story upload error:", e);
    return null;
  }
}
