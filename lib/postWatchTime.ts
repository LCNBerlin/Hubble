import { apiFetch } from "./api";

export async function reportPostWatch(postId: string, userId: string | null, durationSeconds: number): Promise<void> {
  if (durationSeconds <= 0) return;
  apiFetch("/posts/watch", {
    method: "POST",
    body: JSON.stringify({ postId, userId, durationSeconds: Math.min(3600, Math.round(durationSeconds * 10) / 10) }),
  }).catch(() => {});
}
