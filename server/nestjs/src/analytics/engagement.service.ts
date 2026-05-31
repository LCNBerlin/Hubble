import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { RedisService } from "../common/redis/redis.service";

const TTL = 60 * 60 * 1000; // 1 hour

@Injectable()
export class EngagementService {
  constructor(private db: DataSource, private redis: RedisService) {}

  private cache<T>(key: string, fn: () => Promise<T>) {
    return this.redis.getOrSet(`analytics:engagement:${key}`, fn, TTL);
  }

  async getAudienceOverview(creatorId: string) {
    return this.cache(`${creatorId}:audience-overview`, async () => {
      const [profile, new7d, new30d, total] = await Promise.all([
        this.db.query(`SELECT followers_count FROM profiles WHERE id = $1`, [creatorId]),
        this.db.query(`SELECT COUNT(*) AS cnt FROM follows WHERE following_id = $1 AND created_at > NOW() - INTERVAL '7 days'`, [creatorId]),
        this.db.query(`SELECT COUNT(*) AS cnt FROM follows WHERE following_id = $1 AND created_at > NOW() - INTERVAL '30 days'`, [creatorId]),
        this.db.query(`SELECT COUNT(*) AS cnt FROM follows WHERE following_id = $1`, [creatorId]),
      ]);
      return {
        followersCount: profile[0]?.followers_count ?? 0,
        newFollowers7d: Number(new7d[0]?.cnt ?? 0),
        newFollowers30d: Number(new30d[0]?.cnt ?? 0),
        totalFollowers: Number(total[0]?.cnt ?? 0),
      };
    });
  }

  async getContentPerformance(creatorId: string) {
    return this.cache(`${creatorId}:content-performance`, async () => {
      const posts = await this.db.query(
        `SELECT p.id, p.title, p.created_at,
          (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likes,
          (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comments,
          (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS reposts,
          (SELECT COUNT(*) FROM saved_posts WHERE post_id = p.id) AS saves
         FROM posts p WHERE p.user_id = $1 ORDER BY p.created_at DESC LIMIT 100`,
        [creatorId]
      );
      return posts;
    });
  }

  async getTimeBasedInsights(creatorId: string) {
    return this.cache(`${creatorId}:time-insights`, async () => {
      const rows = await this.db.query(
        `SELECT EXTRACT(HOUR FROM pl.created_at) AS hour,
          EXTRACT(DOW FROM pl.created_at) AS dow,
          COUNT(*) AS cnt
         FROM post_likes pl
         JOIN posts p ON p.id = pl.post_id
         WHERE p.user_id = $1 AND pl.created_at > NOW() - INTERVAL '30 days'
         GROUP BY hour, dow ORDER BY cnt DESC`,
        [creatorId]
      );
      return rows;
    });
  }

  async getAudienceDepth(creatorId: string) {
    return this.cache(`${creatorId}:audience-depth`, async () => {
      const posts = await this.db.query(`SELECT id FROM posts WHERE user_id = $1`, [creatorId]);
      const engagers = await this.db.query(
        `SELECT user_id, COUNT(*) AS actions FROM post_likes
         WHERE post_id = ANY($1::uuid[]) GROUP BY user_id`,
        [posts.map((p: { id: string }) => p.id)]
      );
      const repeatEngagers = engagers.filter((e: { actions: string }) => Number(e.actions) > 1).length;
      return { totalEngagers: engagers.length, repeatEngagers, lurkerRatio: 1 - repeatEngagers / Math.max(1, engagers.length) };
    });
  }

  async getCommunityHealthIndex(creatorId: string) {
    return this.cache(`${creatorId}:community-health`, async () => {
      const [overview, depth, churn] = await Promise.all([
        this.getAudienceOverview(creatorId),
        this.getAudienceDepth(creatorId),
        this.getChurnRisk(creatorId),
      ]);
      const growthScore = Math.min(1, overview.newFollowers30d / Math.max(1, overview.totalFollowers));
      const engagementScore = 1 - depth.lurkerRatio;
      const retentionScore = 1 - churn.churnRiskRatio;
      const healthIndex = Math.round(((growthScore + engagementScore + retentionScore) / 3) * 100);
      return { healthIndex, growthScore, engagementScore, retentionScore };
    });
  }

  async getChurnRisk(creatorId: string) {
    return this.cache(`${creatorId}:churn-risk`, async () => {
      const [followers, recentEngagers] = await Promise.all([
        this.db.query(`SELECT follower_id FROM follows WHERE following_id = $1`, [creatorId]),
        this.db.query(
          `SELECT DISTINCT pl.user_id FROM post_likes pl
           JOIN posts p ON p.id = pl.post_id
           WHERE p.user_id = $1 AND pl.created_at > NOW() - INTERVAL '30 days'`,
          [creatorId]
        ),
      ]);
      const engagerSet = new Set(recentEngagers.map((r: { user_id: string }) => r.user_id));
      const atRisk = followers.filter((f: { follower_id: string }) => !engagerSet.has(f.follower_id)).length;
      return { totalFollowers: followers.length, atRiskFollowers: atRisk, churnRiskRatio: atRisk / Math.max(1, followers.length) };
    });
  }

  async getCohortAnalysis(creatorId: string) {
    return this.cache(`${creatorId}:cohort-analysis`, async () => {
      return this.db.query(
        `SELECT
          CASE
            WHEN f.created_at > NOW() - INTERVAL '7 days' THEN 'last_7d'
            WHEN f.created_at > NOW() - INTERVAL '30 days' THEN 'last_30d'
            WHEN f.created_at > NOW() - INTERVAL '90 days' THEN 'last_90d'
            ELSE 'older'
          END AS cohort,
          COUNT(*) AS count
         FROM follows f WHERE f.following_id = $1 GROUP BY cohort`,
        [creatorId]
      );
    });
  }

  async getBehavioralTracking(creatorId: string) {
    return this.cache(`${creatorId}:behavioral`, async () => {
      const postIds = await this.db.query(`SELECT id FROM posts WHERE user_id = $1`, [creatorId])
        .then((rows: { id: string }[]) => rows.map((r) => r.id));
      const [likes, comments, reposts] = await Promise.all([
        this.db.query(`SELECT COUNT(*) AS cnt FROM post_likes WHERE post_id = ANY($1::uuid[])`, [postIds]),
        this.db.query(`SELECT COUNT(*) AS cnt FROM post_comments WHERE post_id = ANY($1::uuid[])`, [postIds]),
        this.db.query(`SELECT COUNT(*) AS cnt FROM reposts WHERE post_id = ANY($1::uuid[])`, [postIds]),
      ]);
      const total = Number(likes[0]?.cnt ?? 0) + Number(comments[0]?.cnt ?? 0) + Number(reposts[0]?.cnt ?? 0);
      return {
        likes: Number(likes[0]?.cnt ?? 0),
        comments: Number(comments[0]?.cnt ?? 0),
        reposts: Number(reposts[0]?.cnt ?? 0),
        total,
        likesRatio: total > 0 ? Number(likes[0]?.cnt ?? 0) / total : 0,
      };
    });
  }

  async getSubscriberActivity(creatorId: string) {
    return this.cache(`${creatorId}:subscriber-activity`, async () => {
      const followers = await this.db.query(`SELECT follower_id FROM follows WHERE following_id = $1`, [creatorId]);
      const followerIds = followers.map((f: { follower_id: string }) => f.follower_id);
      if (!followerIds.length) return { totalFollowers: 0, activeFollowers: 0, engagementRate: 0 };
      const postIds = await this.db.query(`SELECT id FROM posts WHERE user_id = $1`, [creatorId])
        .then((rows: { id: string }[]) => rows.map((r) => r.id));
      const active = await this.db.query(
        `SELECT COUNT(DISTINCT user_id) AS cnt FROM post_likes WHERE post_id = ANY($1::uuid[]) AND user_id = ANY($2::uuid[])`,
        [postIds, followerIds]
      );
      const activeCount = Number(active[0]?.cnt ?? 0);
      return { totalFollowers: followerIds.length, activeFollowers: activeCount, engagementRate: followerIds.length > 0 ? activeCount / followerIds.length : 0 };
    });
  }

  async getMessagingEngagement(creatorId: string) {
    return this.cache(`${creatorId}:messaging-engagement`, async () => {
      const rows = await this.db.query(
        `SELECT COUNT(*) AS grants, COALESCE(SUM(amount_cents), 0) AS revenue
         FROM dm_access_grants WHERE creator_id = $1`,
        [creatorId]
      );
      return { dmGrants: Number(rows[0]?.grants ?? 0), dmRevenueCents: Number(rows[0]?.revenue ?? 0) };
    });
  }

  async getConversionAttribution(creatorId: string) {
    return this.cache(`${creatorId}:conversion`, async () => {
      return this.db.query(
        `SELECT p.id, p.title,
          (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likes,
          (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comments,
          (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS reposts
         FROM posts p WHERE p.user_id = $1
         ORDER BY likes DESC LIMIT 5`,
        [creatorId]
      );
    });
  }
}
