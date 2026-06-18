import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

const PUSH_MESSAGES: Record<string, { title: string; body: string }> = {
  like: { title: "New like", body: "Someone liked your post" },
  comment: { title: "New comment", body: "Someone commented on your post" },
  comment_reply: { title: "Reply to your comment", body: "Someone replied to your comment" },
  comment_like: { title: "Comment liked", body: "Someone liked your comment" },
  follow: { title: "New follower", body: "Someone followed you" },
  repost: { title: "Repost", body: "Someone reposted your post" },
  save_post: { title: "Post saved", body: "Someone saved your post" },
  mention: { title: "You were mentioned", body: "Someone mentioned you" },
  product_sale: { title: "New sale", body: "You have a new sale" },
  product_review: { title: "New review", body: "Someone left a review on your product" },
  order_shipped: { title: "Order shipped", body: "Your order has shipped" },
  tracking_updated: { title: "Tracking updated", body: "Your order tracking was updated" },
  delivery_confirmed: { title: "Delivery confirmed", body: "A buyer confirmed delivery" },
  order_refunded: { title: "Order refunded", body: "Your order was refunded" },
  tip_received: { title: "Tip received", body: "You received a tip" },
  cart_reminder: { title: "Cart reminder", body: "You left items in your cart" },
  booking: { title: "New booking", body: "Someone booked an appointment" },
  appointment_reminder: { title: "Appointment reminder", body: "You have an upcoming appointment" },
};

@Injectable()
export class NotificationsService {
  constructor(private db: DataSource) {}

  async getForUser(userId: string, since?: string, unreadOnly = false): Promise<unknown[]> {
    let query = `SELECT * FROM notifications WHERE recipient_id = $1`;
    const params: unknown[] = [userId];
    if (since) { query += ` AND created_at > $${params.length + 1}`; params.push(since); }
    if (unreadOnly) { query += ` AND read_at IS NULL`; }
    query += ` ORDER BY created_at DESC LIMIT 50`;
    return this.db.query(query, params);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const rows = await this.db.query(
      `SELECT COUNT(*) AS cnt FROM notifications WHERE recipient_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  async markRead(userId: string, notificationIds: string[]): Promise<void> {
    await this.db.query(
      `UPDATE notifications SET read_at = NOW() WHERE recipient_id = $1 AND id = ANY($2::uuid[])`,
      [userId, notificationIds]
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE notifications SET read_at = NOW() WHERE recipient_id = $1 AND read_at IS NULL`,
      [userId]
    );
  }

  async insert(recipientId: string, type: string, actorId?: string, targetType?: string, targetId?: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.db.query(
      `INSERT INTO notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [recipientId, actorId || null, type, targetType || null, targetId || null, recipientId, JSON.stringify(metadata || {})]
    );
  }

  async sendPush(recipientId: string, notificationType: string, notificationId: string): Promise<void> {
    const tokens = await this.db.query(
      `SELECT token FROM push_tokens WHERE user_id = $1`,
      [recipientId]
    );
    if (!tokens?.length) return;
    const { title, body } = PUSH_MESSAGES[notificationType] || { title: "Hubble", body: "You have a new notification" };
    const messages = tokens.map(({ token }: { token: string }) => ({
      to: token,
      title,
      body,
      data: { notificationId, type: notificationType },
      sound: "default",
    }));
    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });
    } catch (e) {
      console.error("[push] send error", e);
    }
  }

  async upsertPushToken(userId: string, token: string): Promise<void> {
    await this.db.query(
      `INSERT INTO push_tokens (user_id, token, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (token) DO UPDATE SET user_id = $1, updated_at = NOW()`,
      [userId, token]
    );
  }
}
