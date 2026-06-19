import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { RedisService } from "../common/redis/redis.service";

const FEED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Exponential recency decay: higher = more recent */
function recencyDecay(createdAtMs: number, nowMs: number, lambda = 0.12): number {
  return Math.exp(-lambda * (nowMs - createdAtMs) / 3_600_000);
}

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function reputationScore(score: number | null, tier: string | null): number {
  const r = Math.min(1, Math.max(0, (score ?? 0) / 5));
  const boost = tier === "verified" || tier === "enterprise" ? 0.2 : 0;
  return Math.min(1, r + boost);
}

const W = {
  recency: 0.2, follow: 0.18, velocity: 0.12, depth: 0.08,
  watchTime: 0.15, purchase: 0.1, reputation: 0.05, geo: 0.05,
  sponsored: 0.05, seeMore: 0.1, seeLess: -0.15, likes: 0.1, comments: 0.1,
};

@Injectable()
export class FeedService {
  constructor(
    private db: DataSource,
    private redis: RedisService
  ) {}

  async getRankedFeed(userId: string, limit = 50, offset = 0): Promise<unknown[]> {
    const cacheKey = `feed:ranked:${userId}:${offset}`;
    return this.redis.getOrSet(cacheKey, () => this.computeFeed(userId, limit, offset), FEED_CACHE_TTL);
  }

  async invalidateFeedCache(userId: string): Promise<void> {
    await Promise.all(
      [0, 50, 100, 150, 200].map((offset) => this.redis.del(`feed:ranked:${userId}:${offset}`))
    );
  }

  private async computeFeed(userId: string, limit: number, offset: number): Promise<unknown[]> {
    const nowMs = Date.now();

    const [posts, followedIds, purchasedIds, nearbyIds, velocities, depths, watches, likeCounts, commentCounts, profile] =
      await Promise.all([
        this.db.query(
          `SELECT p.*, pr.reputation_score, pr.verified_tier, pr.username, pr.display_name, pr.avatar_url
           FROM posts p
           LEFT JOIN profiles pr ON pr.id = p.user_id
           WHERE p.scheduled_at IS NULL OR p.scheduled_at <= NOW()
           ORDER BY p.created_at DESC
           LIMIT $1 OFFSET $2`,
          [limit * 3, offset]
        ),
        this.db.query(`SELECT following_id FROM follows WHERE follower_id = $1`, [userId])
          .then((rows: { following_id: string }[]) => new Set(rows.map((r) => r.following_id))),
        this.db.query(
          `SELECT DISTINCT oi.creator_id FROM order_items oi
           JOIN orders o ON o.id = oi.order_id WHERE o.buyer_id = $1`,
          [userId]
        ).then((rows: { creator_id: string }[]) => new Set(rows.map((r) => r.creator_id))),
        this.db.query(
          `SELECT get_nearby_post_ids(
            (SELECT lat FROM profiles WHERE id = $1),
            (SELECT lng FROM profiles WHERE id = $1),
            50
          ) AS id`,
          [userId]
        ).then((rows: { id: string }[]) => new Set(rows.map((r) => r.id))),
        this.db.query(
          `SELECT post_id, COUNT(*) AS velocity FROM post_likes
           WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY post_id`,
          []
        ).then((rows: { post_id: string; velocity: string }[]) =>
          Object.fromEntries(rows.map((r) => [r.post_id, Number(r.velocity)]))),
        this.db.query(
          `SELECT post_id, COUNT(*) AS total,
            SUM(CASE WHEN parent_id IS NOT NULL THEN 1 ELSE 0 END) AS replies
           FROM post_comments GROUP BY post_id`,
          []
        ).then((rows: { post_id: string; total: string; replies: string }[]) =>
          Object.fromEntries(rows.map((r) => [r.post_id, { total: Number(r.total), replies: Number(r.replies) }]))),
        this.db.query(
          `SELECT post_id, SUM(watch_seconds) AS total FROM post_watch_events GROUP BY post_id`,
          []
        ).then((rows: { post_id: string; total: string }[]) =>
          Object.fromEntries(rows.map((r) => [r.post_id, Number(r.total)]))),
        this.db.query(`SELECT post_id, COUNT(*) AS cnt FROM post_likes GROUP BY post_id`, [])
          .then((rows: { post_id: string; cnt: string }[]) =>
            Object.fromEntries(rows.map((r) => [r.post_id, Number(r.cnt)]))),
        this.db.query(`SELECT post_id, COUNT(*) AS cnt FROM post_comments GROUP BY post_id`, [])
          .then((rows: { post_id: string; cnt: string }[]) =>
            Object.fromEntries(rows.map((r) => [r.post_id, Number(r.cnt)]))),
        this.db.query(`SELECT see_more_topics, see_less_topics FROM profiles WHERE id = $1`, [userId])
          .then((rows: { see_more_topics: string[]; see_less_topics: string[] }[]) => rows[0] || {}),
      ]);

    const seeMore: string[] = profile?.see_more_topics ?? [];
    const seeLess: string[] = profile?.see_less_topics ?? [];

    const recencyRaw = posts.map((p: { created_at: string }) => recencyDecay(new Date(p.created_at).getTime(), nowMs));
    const minRec = Math.min(...recencyRaw);
    const maxRec = Math.max(...recencyRaw);
    const maxLikes = Math.max(1, ...Object.values(likeCounts) as number[]);
    const maxComments = Math.max(1, ...Object.values(commentCounts) as number[]);
    const maxVelocity = Math.max(1, ...Object.values(velocities) as number[]);
    const maxDepth = Math.max(1, ...Object.values(depths).map((d: { total: number }) => d.total));
    const maxWatch = Math.max(1, ...Object.values(watches) as number[]);

    const scored = posts.map((post: Record<string, unknown>, i: number) => {
      const rec = normalize(recencyRaw[i], minRec, maxRec);
      const title = String(post.title ?? "").toLowerCase();
      const body = String(post.body ?? "").toLowerCase();
      const text = `${title} ${body}`;
      const matchMore = seeMore.some((t) => t && text.includes(t.toLowerCase()));
      const matchLess = seeLess.some((t) => t && text.includes(t.toLowerCase()));
      const score =
        W.recency * rec +
        W.follow * (followedIds.has(post.user_id as string) ? 1 : 0) +
        W.velocity * ((velocities[post.id as string] ?? 0) / maxVelocity) +
        W.depth * (((depths[post.id as string]?.total ?? 0) + (depths[post.id as string]?.replies ?? 0) * 0.5) / maxDepth) +
        W.watchTime * ((watches[post.id as string] ?? 0) / maxWatch) +
        W.likes * ((likeCounts[post.id as string] ?? 0) / maxLikes) +
        W.comments * ((commentCounts[post.id as string] ?? 0) / maxComments) +
        W.reputation * reputationScore(post.reputation_score as number | null, post.verified_tier as string | null) +
        W.geo * (nearbyIds.has(post.id as string) ? 1 : 0) +
        W.purchase * (purchasedIds.has(post.user_id as string) ? 1 : 0) +
        W.sponsored * (post.is_sponsored ? 1 : 0) +
        W.seeMore * (matchMore ? 1 : 0) +
        W.seeLess * (matchLess ? 1 : 0);
      return { post, score };
    });

    return scored.sort((a: { post: unknown; score: number }, b: { post: unknown; score: number }) => b.score - a.score).slice(0, limit).map((x: { post: unknown; score: number }) => x.post);
  }

  async getTrendingPosts(hoursWindow = 24, maxCount = 50): Promise<unknown[]> {
    const safeHours = Math.max(1, Math.min(168, Math.floor(Number(hoursWindow) || 24)));
    return this.db.query(
      `SELECT p.id, p.user_id, p.type, p.title, p.body, p.media_uri, p.created_at,
              p.is_sponsored, p.place_name, p.poll_options,
              pr.username, pr.display_name, pr.avatar_url
       FROM post_likes pl
       JOIN posts p ON p.id = pl.post_id
       LEFT JOIN profiles pr ON pr.id = p.user_id
       WHERE pl.created_at > NOW() - ($1 * INTERVAL '1 hour')
       GROUP BY p.id, pr.username, pr.display_name, pr.avatar_url
       ORDER BY COUNT(pl.*) DESC LIMIT $2`,
      [safeHours, maxCount]
    );
  }

  async getTrendingHashtags(daysWindow = 7, maxCount = 20): Promise<{ name: string; count: number }[]> {
    const safeDays = Math.max(1, Math.min(90, Math.floor(Number(daysWindow) || 7)));
    return this.db.query(
      `SELECT h.name, COUNT(*) AS count
       FROM post_hashtags ph
       JOIN hashtags h ON h.id = ph.hashtag_id
       JOIN posts p ON p.id = ph.post_id
       WHERE p.created_at > NOW() - ($1 * INTERVAL '1 day')
       GROUP BY h.name ORDER BY count DESC LIMIT $2`,
      [safeDays, maxCount]
    );
  }
}
