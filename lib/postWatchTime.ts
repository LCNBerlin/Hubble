import supabase from "./supabase";

/**
 * Report post watch time for feed ranking. Call when the user leaves a post view
 * or closes a video (duration in seconds).
 */
export async function reportPostWatch(
  postId: string,
  userId: string | null,
  durationSeconds: number
): Promise<void> {
  if (!supabase || durationSeconds <= 0) return;
  await supabase.from("post_watch_events").insert({
    post_id: postId,
    user_id: userId ?? null,
    duration_seconds: Math.min(3600, Math.round(durationSeconds * 10) / 10),
  });
}
