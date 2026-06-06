import { apiFetch } from "./api";

/**
 * Requests a presigned S3 PUT URL from the NestJS backend, then uploads
 * the file buffer directly to S3. Returns the public CDN URL.
 *
 * AWS credentials never touch the mobile client — only the server holds them.
 */
export async function uploadToS3(
  bucket: "profiles" | "posts" | "stories",
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const presignRes = await apiFetch("/storage/presign", {
    method: "POST",
    body: JSON.stringify({ bucket, key, contentType }),
  });
  if (!presignRes.ok) {
    const text = await presignRes.text().catch(() => "");
    throw new Error(`Failed to get upload URL: ${presignRes.status} ${text}`);
  }
  const { url, publicUrl } = await presignRes.json();

  const uploadRes = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!uploadRes.ok) {
    throw new Error(`S3 upload failed: ${uploadRes.status}`);
  }
  return publicUrl;
}
