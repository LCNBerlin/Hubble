import { apiGet, apiPatch, apiPost } from "./api";

export type NotificationType =
  | "like" | "comment" | "comment_reply" | "comment_like" | "follow"
  | "repost" | "save_post" | "mention" | "product_sale" | "product_review"
  | "order_shipped" | "tracking_updated" | "delivery_confirmed" | "order_refunded"
  | "order_disputed" | "tip_received" | "cart_reminder" | "abandoned_cart_creator"
  | "booking" | "appointment_reminder";

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

export async function getNotifications(_userId: string, limit = 50): Promise<NotificationWithActor[]> {
  return apiGet<NotificationWithActor[]>(`/notifications?limit=${limit}`);
}

export async function markNotificationRead(notificationId: string, _userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiPatch("/notifications/read", { ids: [notificationId] });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function markAllNotificationsRead(_userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiPatch("/notifications/read-all");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function getUnreadNotificationCount(_userId: string): Promise<number> {
  try {
    const { count } = await apiGet<{ count: number }>("/notifications/unread-count");
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Polling-based replacement for Supabase realtime notification subscription.
 * Calls onChange every POLL_INTERVAL_MS. Returns an unsubscribe function.
 */
export function subscribeToNotifications(_userId: string, onChange: () => void): () => void {
  const POLL_INTERVAL_MS = 3000;
  const interval = setInterval(() => onChange(), POLL_INTERVAL_MS);
  return () => clearInterval(interval);
}
