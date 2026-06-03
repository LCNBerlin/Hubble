import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class PostsService {
  constructor(private db: DataSource) {}

  async getByUser(userId: string, viewerId?: string): Promise<unknown[]> {
    return this.db.query(
      `SELECT p.*, pr.username, pr.display_name, pr.avatar_url, pr.verified_tier,
        COALESCE(ARRAY_AGG(h.name ORDER BY h.name) FILTER (WHERE h.name IS NOT NULL), ARRAY[]::varchar[]) AS hashtags
       FROM posts p
       JOIN profiles pr ON pr.id = p.user_id
       LEFT JOIN post_hashtags ph ON ph.post_id = p.id
       LEFT JOIN hashtags h ON h.id = ph.hashtag_id
       WHERE p.user_id = $1 AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
       GROUP BY p.id, pr.username, pr.display_name, pr.avatar_url, pr.verified_tier
       ORDER BY p.created_at DESC`,
      [userId]
    );
  }

  async getById(postId: string): Promise<unknown> {
    const rows = await this.db.query(
      `SELECT p.*, pr.username, pr.display_name, pr.avatar_url, pr.verified_tier
       FROM posts p JOIN profiles pr ON pr.id = p.user_id WHERE p.id = $1`,
      [postId]
    );
    if (!rows[0]) throw new NotFoundException("Post not found");
    return rows[0];
  }

  async getByHashtag(hashtag: string, limit = 50, offset = 0): Promise<unknown[]> {
    return this.db.query(
      `SELECT p.*, pr.username, pr.display_name, pr.avatar_url
       FROM posts p
       JOIN post_hashtags ph ON ph.post_id = p.id
       JOIN hashtags h ON h.id = ph.hashtag_id
       JOIN profiles pr ON pr.id = p.user_id
       WHERE h.name = $1
       ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
      [hashtag.toLowerCase(), limit, offset]
    );
  }

  async create(userId: string, data: Record<string, unknown>): Promise<unknown> {
    const rows = await this.db.query(
      `INSERT INTO posts (user_id, title, body, post_type, media_uri, media_type, is_sponsored, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [userId, data.title, data.body, data.postType || "text", data.mediaUri || null, data.mediaType || null, data.isSponsored || false, data.scheduledAt || null]
    );
    return rows[0];
  }

  async update(postId: string, userId: string, data: Record<string, unknown>): Promise<unknown> {
    const post = await this.db.query(`SELECT user_id FROM posts WHERE id = $1`, [postId]);
    if (!post[0]) throw new NotFoundException("Post not found");
    if (post[0].user_id !== userId) throw new ForbiddenException("Not your post");
    const rows = await this.db.query(
      `UPDATE posts SET
        title = COALESCE($1, title),
        body = COALESCE($2, body),
        media_uri = $3,
        lat = $4,
        lng = $5,
        place_name = $6,
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [data.title ?? null, data.body ?? null, data.mediaUri ?? null, data.lat ?? null, data.lng ?? null, data.placeName ?? null, postId]
    );
    return rows[0];
  }

  async getHashtags(postId: string): Promise<string[]> {
    const rows = await this.db.query(
      `SELECT h.name FROM hashtags h JOIN post_hashtags ph ON ph.hashtag_id = h.id WHERE ph.post_id = $1`,
      [postId]
    );
    return rows.map((r: { name: string }) => r.name);
  }

  async syncHashtags(postId: string, userId: string, tagNames: string[]): Promise<void> {
    const post = await this.db.query(`SELECT user_id FROM posts WHERE id = $1`, [postId]);
    if (!post[0]) throw new NotFoundException("Post not found");
    if (post[0].user_id !== userId) throw new ForbiddenException("Not your post");
    await this.db.query(`DELETE FROM post_hashtags WHERE post_id = $1`, [postId]);
    for (const name of tagNames) {
      const lname = name.toLowerCase();
      await this.db.query(
        `INSERT INTO hashtags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [lname]
      );
      const htag = await this.db.query(`SELECT id FROM hashtags WHERE name = $1`, [lname]);
      if (htag[0]) {
        await this.db.query(
          `INSERT INTO post_hashtags (post_id, hashtag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [postId, htag[0].id]
        );
      }
    }
  }

  async delete(postId: string, userId: string): Promise<void> {
    const post = await this.db.query(`SELECT user_id FROM posts WHERE id = $1`, [postId]);
    if (!post[0]) throw new NotFoundException("Post not found");
    if (post[0].user_id !== userId) throw new ForbiddenException("Not your post");
    await this.db.query(`DELETE FROM posts WHERE id = $1`, [postId]);
  }

  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; count: number }> {
    const existing = await this.db.query(`SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
    if (existing[0]) {
      await this.db.query(`DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
    } else {
      await this.db.query(`INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [postId, userId]);
    }
    const count = await this.db.query(`SELECT COUNT(*) AS cnt FROM post_likes WHERE post_id = $1`, [postId]);
    return { liked: !existing[0], count: Number(count[0]?.cnt ?? 0) };
  }

  async toggleRepost(postId: string, userId: string): Promise<{ reposted: boolean; count: number }> {
    const existing = await this.db.query(`SELECT id FROM reposts WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
    if (existing[0]) {
      await this.db.query(`DELETE FROM reposts WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
    } else {
      await this.db.query(`INSERT INTO reposts (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [postId, userId]);
    }
    const count = await this.db.query(`SELECT COUNT(*) AS cnt FROM reposts WHERE post_id = $1`, [postId]);
    return { reposted: !existing[0], count: Number(count[0]?.cnt ?? 0) };
  }

  async getComments(postId: string, viewerId?: string): Promise<unknown[]> {
    const rows = await this.db.query(
      `SELECT c.id, c.body, c.created_at, c.user_id, c.parent_id,
        pr.username, pr.display_name, pr.avatar_url,
        COUNT(DISTINCT cl.user_id)::int AS like_count,
        COUNT(DISTINCT cd.user_id)::int AS dislike_count,
        (CASE WHEN $2::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = $2::uuid) THEN true ELSE false END) AS is_liked,
        (CASE WHEN $2::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM comment_dislikes WHERE comment_id = c.id AND user_id = $2::uuid) THEN true ELSE false END) AS is_disliked
       FROM post_comments c
       JOIN profiles pr ON pr.id = c.user_id
       LEFT JOIN comment_likes cl ON cl.comment_id = c.id
       LEFT JOIN comment_dislikes cd ON cd.comment_id = c.id
       WHERE c.post_id = $1
       GROUP BY c.id, pr.username, pr.display_name, pr.avatar_url
       ORDER BY c.created_at ASC`,
      [postId, viewerId || null]
    );
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      body: r.body,
      created_at: r.created_at,
      user_id: r.user_id,
      parent_id: r.parent_id ?? null,
      like_count: Number(r.like_count ?? 0),
      dislike_count: Number(r.dislike_count ?? 0),
      is_liked: Boolean(r.is_liked),
      is_disliked: Boolean(r.is_disliked),
      author: { display_name: r.display_name ?? null, username: r.username ?? "", avatar_url: r.avatar_url ?? null },
    }));
  }

  async toggleCommentLike(commentId: string, userId: string): Promise<{ liked: boolean; likeCount: number; dislikeCount: number }> {
    const existing = await this.db.query(`SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2`, [commentId, userId]);
    if (existing[0]) {
      await this.db.query(`DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2`, [commentId, userId]);
    } else {
      await this.db.query(`INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [commentId, userId]);
      await this.db.query(`DELETE FROM comment_dislikes WHERE comment_id = $1 AND user_id = $2`, [commentId, userId]);
    }
    const counts = await this.db.query(
      `SELECT COUNT(DISTINCT cl.user_id)::int AS lc, COUNT(DISTINCT cd.user_id)::int AS dc
       FROM post_comments c
       LEFT JOIN comment_likes cl ON cl.comment_id = c.id
       LEFT JOIN comment_dislikes cd ON cd.comment_id = c.id
       WHERE c.id = $1 GROUP BY c.id`,
      [commentId]
    );
    return { liked: !existing[0], likeCount: Number(counts[0]?.lc ?? 0), dislikeCount: Number(counts[0]?.dc ?? 0) };
  }

  async toggleCommentDislike(commentId: string, userId: string): Promise<{ disliked: boolean; likeCount: number; dislikeCount: number }> {
    const existing = await this.db.query(`SELECT 1 FROM comment_dislikes WHERE comment_id = $1 AND user_id = $2`, [commentId, userId]);
    if (existing[0]) {
      await this.db.query(`DELETE FROM comment_dislikes WHERE comment_id = $1 AND user_id = $2`, [commentId, userId]);
    } else {
      await this.db.query(`INSERT INTO comment_dislikes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [commentId, userId]);
      await this.db.query(`DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2`, [commentId, userId]);
    }
    const counts = await this.db.query(
      `SELECT COUNT(DISTINCT cl.user_id)::int AS lc, COUNT(DISTINCT cd.user_id)::int AS dc
       FROM post_comments c
       LEFT JOIN comment_likes cl ON cl.comment_id = c.id
       LEFT JOIN comment_dislikes cd ON cd.comment_id = c.id
       WHERE c.id = $1 GROUP BY c.id`,
      [commentId]
    );
    return { disliked: !existing[0], likeCount: Number(counts[0]?.lc ?? 0), dislikeCount: Number(counts[0]?.dc ?? 0) };
  }

  async addComment(postId: string, userId: string, body: string, parentId?: string): Promise<unknown> {
    const rows = await this.db.query(
      `INSERT INTO post_comments (post_id, user_id, body, parent_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [postId, userId, body, parentId || null]
    );
    return rows[0];
  }

  async getEngagement(postIds: string[]): Promise<Record<string, { likes: number; comments: number; reposts: number }>> {
    const [likes, comments, reposts] = await Promise.all([
      this.db.query(`SELECT post_id, COUNT(*) AS cnt FROM post_likes WHERE post_id = ANY($1::uuid[]) GROUP BY post_id`, [postIds]),
      this.db.query(`SELECT post_id, COUNT(*) AS cnt FROM post_comments WHERE post_id = ANY($1::uuid[]) GROUP BY post_id`, [postIds]),
      this.db.query(`SELECT post_id, COUNT(*) AS cnt FROM reposts WHERE post_id = ANY($1::uuid[]) GROUP BY post_id`, [postIds]),
    ]);
    const result: Record<string, { likes: number; comments: number; reposts: number }> = {};
    for (const id of postIds) {
      result[id] = {
        likes: Number(likes.find((r: { post_id: string }) => r.post_id === id)?.cnt ?? 0),
        comments: Number(comments.find((r: { post_id: string }) => r.post_id === id)?.cnt ?? 0),
        reposts: Number(reposts.find((r: { post_id: string }) => r.post_id === id)?.cnt ?? 0),
      };
    }
    return result;
  }

  async getUserEngagement(postIds: string[], userId: string): Promise<Record<string, { liked: boolean; reposted: boolean; saved: boolean }>> {
    const [liked, reposted, saved] = await Promise.all([
      this.db.query(`SELECT post_id FROM post_likes WHERE post_id = ANY($1::uuid[]) AND user_id = $2`, [postIds, userId]),
      this.db.query(`SELECT post_id FROM reposts WHERE post_id = ANY($1::uuid[]) AND user_id = $2`, [postIds, userId]),
      this.db.query(`SELECT post_id FROM saved_posts WHERE post_id = ANY($1::uuid[]) AND user_id = $2`, [postIds, userId]),
    ]);
    const likedSet = new Set(liked.map((r: { post_id: string }) => r.post_id));
    const repostedSet = new Set(reposted.map((r: { post_id: string }) => r.post_id));
    const savedSet = new Set(saved.map((r: { post_id: string }) => r.post_id));
    const result: Record<string, { liked: boolean; reposted: boolean; saved: boolean }> = {};
    for (const id of postIds) {
      result[id] = { liked: likedSet.has(id), reposted: repostedSet.has(id), saved: savedSet.has(id) };
    }
    return result;
  }

  async search(query: string, limit = 20): Promise<unknown[]> {
    return this.db.query(
      `SELECT p.*, pr.username, pr.display_name, pr.avatar_url,
        ts_rank(to_tsvector('english', COALESCE(p.title,'') || ' ' || COALESCE(p.body,'')),
                plainto_tsquery('english', $1)) AS rank
       FROM posts p JOIN profiles pr ON pr.id = p.user_id
       WHERE to_tsvector('english', COALESCE(p.title,'') || ' ' || COALESCE(p.body,''))
             @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC LIMIT $2`,
      [query, limit]
    );
  }
}
