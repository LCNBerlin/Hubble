import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class MessagingService {
  constructor(private db: DataSource) {}

  async getConversations(userId: string): Promise<unknown[]> {
    return this.db.query(
      `SELECT c.*,
        (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
        (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != $1 AND m.read_at IS NULL) AS unread_count,
        (SELECT cp2.user_id FROM conversation_participants cp2 WHERE cp2.conversation_id = c.id AND cp2.user_id != $1 LIMIT 1) AS peer_id
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE cp.user_id = $1 AND c.archived_at IS NULL
       ORDER BY last_message_at DESC NULLS LAST`,
      [userId]
    );
  }

  async getMessages(conversationId: string, userId: string, since?: string, limit = 50): Promise<unknown[]> {
    const membership = await this.db.query(
      `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
    if (!membership[0]) throw new ForbiddenException("Not a participant");
    let query = `SELECT m.*, pr.username, pr.display_name, pr.avatar_url
                 FROM messages m JOIN profiles pr ON pr.id = m.sender_id
                 WHERE m.conversation_id = $1`;
    const params: unknown[] = [conversationId];
    if (since) { query += ` AND m.created_at > $${params.length + 1}`; params.push(since); }
    query += ` ORDER BY m.created_at ASC LIMIT $${params.length + 1}`;
    params.push(limit);
    return this.db.query(query, params);
  }

  async sendMessage(conversationId: string, senderId: string, body: string, mediaUrl?: string): Promise<unknown> {
    const membership = await this.db.query(
      `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, senderId]
    );
    if (!membership[0]) throw new ForbiddenException("Not a participant");
    const rows = await this.db.query(
      `INSERT INTO messages (conversation_id, sender_id, body, media_url) VALUES ($1, $2, $3, $4) RETURNING *`,
      [conversationId, senderId, body, mediaUrl || null]
    );
    return rows[0];
  }

  async createConversation(userId: string, peerId: string): Promise<unknown> {
    const existing = await this.db.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
       JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
       WHERE c.is_group = false LIMIT 1`,
      [userId, peerId]
    );
    if (existing[0]) return existing[0];
    const conv = await this.db.query(`INSERT INTO conversations (is_group) VALUES (false) RETURNING id`, []);
    const convId = conv[0].id;
    await this.db.query(
      `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [convId, userId, peerId]
    );
    return { id: convId };
  }

  async archiveConversation(conversationId: string, userId: string): Promise<void> {
    await this.db.query(
      `UPDATE conversation_participants SET archived_at = NOW() WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    await this.db.query(
      `UPDATE messages SET read_at = NOW() WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [conversationId, userId]
    );
  }

  async getPeer(conversationId: string, userId: string): Promise<unknown> {
    const rows = await this.db.query(
      `SELECT cp.user_id, pr.display_name, pr.username, pr.avatar_url, pr.verified_tier, pr.reputation_score
       FROM conversation_participants cp JOIN profiles pr ON pr.id = cp.user_id
       WHERE cp.conversation_id = $1 AND cp.user_id != $2 LIMIT 1`,
      [conversationId, userId]
    );
    return rows[0] ?? null;
  }

  async updateParticipant(conversationId: string, userId: string, updates: { pinned?: boolean; muted?: boolean; archived?: boolean }): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 3;
    if (updates.pinned !== undefined) { fields.push(`pinned = $${i++}`); values.push(updates.pinned); }
    if (updates.muted !== undefined) { fields.push(`muted = $${i++}`); values.push(updates.muted); }
    if (updates.archived !== undefined) { fields.push(`archived_at = $${i++}`); values.push(updates.archived ? new Date() : null); }
    if (!fields.length) return;
    await this.db.query(
      `UPDATE conversation_participants SET ${fields.join(", ")} WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId, ...values]
    );
  }

  async getReactions(messageIds: string[]): Promise<unknown[]> {
    if (!messageIds.length) return [];
    return this.db.query(
      `SELECT message_id, user_id, emoji, created_at FROM message_reactions WHERE message_id = ANY($1::uuid[])`,
      [messageIds]
    );
  }

  async toggleReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    const existing = await this.db.query(
      `SELECT 1 FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [messageId, userId, emoji]
    );
    if (existing[0]) {
      await this.db.query(`DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`, [messageId, userId, emoji]);
    } else {
      await this.db.query(`INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)`, [messageId, userId, emoji]);
    }
  }

  async getCRMData(conversationId: string, currentUserId: string): Promise<unknown> {
    const peer = await this.getPeer(conversationId, currentUserId);
    if (!peer) return null;
    const peerUserId = (peer as { user_id: string }).user_id;
    const [myOrders, theirOrders] = await Promise.all([
      this.db.query(
        `SELECT o.id, o.buyer_id, o.status, o.total_cents, o.escrow_release_at, o.created_at,
          json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'title', oi.title, 'line_total_cents', oi.line_total_cents, 'creator_id', oi.creator_id)) AS order_items
         FROM orders o JOIN order_items oi ON oi.order_id = o.id
         WHERE o.buyer_id = $1 GROUP BY o.id ORDER BY o.created_at DESC`,
        [currentUserId]
      ),
      this.db.query(
        `SELECT o.id, o.buyer_id, o.status, o.total_cents, o.escrow_release_at, o.created_at,
          json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'title', oi.title, 'line_total_cents', oi.line_total_cents, 'creator_id', oi.creator_id)) AS order_items
         FROM orders o JOIN order_items oi ON oi.order_id = o.id
         WHERE o.buyer_id = $1 GROUP BY o.id ORDER BY o.created_at DESC`,
        [peerUserId]
      ),
    ]);
    const ordersAsBuyer = myOrders.filter((o: { order_items: { creator_id: string }[] }) =>
      o.order_items?.some((i) => i.creator_id === peerUserId)
    );
    const ordersAsCreator = theirOrders.filter((o: { order_items: { creator_id: string }[] }) =>
      o.order_items?.some((i) => i.creator_id === currentUserId)
    );
    return { profile: peer, ordersAsBuyer, ordersAsCreator };
  }
}
