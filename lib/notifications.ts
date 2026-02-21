import supabase from "./supabase";

export type NotificationType =
  | "like"
  | "comment"
  | "comment_reply"
  | "comment_like"
  | "follow"
  | "repost"
  | "save_post"
  | "mention"
  | "product_sale"
  | "product_review"
  | "order_shipped"
  | "tracking_updated"
  | "delivery_confirmed"
  | "order_refunded"
  | "order_disputed"
  | "tip_received"
  | "cart_reminder"
  | "abandoned_cart_creator"
  | "booking"
  | "appointment_reminder";

export type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  target_type: string | null;
  target_id: string | null;
  target_user_id: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationWithActor = NotificationRow & {
  actor?: { id: string; display_name: string | null; username: string; avatar_url: string | null } | null;
};

/** Fetch notifications for the current user with actor profile (actor may be null for system notifications). */
export async function getNotifications(
  userId: string,
  limit = 50
): Promise<NotificationWithActor[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("*, actor:profiles!actor_id(id, display_name, username, avatar_url)")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (__DEV__) {
      console.warn("[notifications] getNotifications error (try running schema migration):", error.message);
    }
    const fallback = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (fallback.error) {
      if (__DEV__) console.warn("[notifications] fallback error:", fallback.error.message);
      return [];
    }
    return ((fallback.data ?? []) as NotificationWithActor[]).map((row) => ({ ...row, actor: null }));
  }
  const list = (data as NotificationWithActor[]) ?? [];
  if (__DEV__ && userId) {
    console.log("[notifications] loaded", list.length, "for user", userId.slice(0, 8) + "...");
  }
  return list;
}

/** Mark a single notification as read. */
export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Mark all notifications as read for the current user. */
export async function markAllNotificationsRead(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Get unread notification count for the current user. */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Subscribe to realtime INSERT/UPDATE on notifications for the given user.
 * Call onChange() whenever a row is inserted or updated so the caller can refresh count or list.
 * Returns an unsubscribe function (call on cleanup).
 */
export function subscribeToNotifications(userId: string, onChange: () => void): () => void {
  if (!supabase || !userId) return () => {};
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${userId}`,
      },
      () => onChange()
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
