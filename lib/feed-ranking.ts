import type { PostRow, ProfileRow } from "./supabase-profiles";

export type RankingPost = {
  post: PostRow & { place_name?: string | null; hashtags?: string[] };
  profile: ProfileRow | null;
};

export interface RankingContext {
  followedIds: Set<string>;
  purchasedCreatorIds: Set<string>;
  nearbyPostIds: Set<string>;
  seeMoreTopics: string[];
  seeLessTopics: string[];
  engagementVelocityByPostId: Record<string, number>;
  commentDepthByPostId: Record<string, { total: number; replyCount: number }>;
  watchTimeByPostId: Record<string, number>;
  getLikeCount: (postId: string) => number;
  getCommentCount: (postId: string) => number;
  viewerUserId?: string | null;
}

/** Exponential recency decay: score = exp(-lambda * hours_old). Higher = more recent. */
export function recencyDecayScore(createdAtMs: number, nowMs: number, lambda = 0.12): number {
  const hoursOld = (nowMs - createdAtMs) / (1000 * 60 * 60);
  return Math.exp(-lambda * hoursOld);
}

/** Normalize value to [0, 1] using min/max; if max === min return 0.5. */
export function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  const n = (value - min) / (max - min);
  return Math.max(0, Math.min(1, n));
}

/** Reputation score normalized to [0, 1]. Assumes 0-5 scale; verified_tier adds a bump. */
export function reputationScore(
  reputationScoreNum: number | null | undefined,
  verifiedTier: string | null | undefined
): number {
  const r = reputationScoreNum ?? 0;
  const norm = Math.min(1, Math.max(0, r / 5));
  const verifiedBoost = verifiedTier === "verified" || verifiedTier === "enterprise" ? 0.2 : 0;
  return Math.min(1, norm + verifiedBoost);
}

/** Token ownership boost. Stub: 0 until wallet/ownership provider is wired. */
export function getTokenBoost(_userId: string, _postId: string): number {
  return 0;
}

export const FEED_RANKING_WEIGHTS = {
  recencyDecay: 0.2,
  follow: 0.18,
  engagementVelocity: 0.12,
  commentDepth: 0.08,
  watchTime: 0.15,
  purchaseBehavior: 0.1,
  reputation: 0.05,
  geo: 0.05,
  sponsored: 0.05,
  seeMore: 0.1,
  seeLess: -0.15,
  token: 0,
} as const;

export function postMatchesTopics(post: PostRow, topics: string[]): boolean {
  if (topics.length === 0) return false;
  const text = [post.title, post.body].filter(Boolean).join(" ").toLowerCase();
  return topics.some((t) => t.trim().toLowerCase() && text.includes(t.trim().toLowerCase()));
}

export function rankPosts<T extends RankingPost>(items: T[], ctx: RankingContext): T[] {
  if (items.length === 0) return items;
  const nowMs = Date.now();
  const recencyScores = items.map((i) => recencyDecayScore(new Date(i.post.created_at).getTime(), nowMs));
  const minRec = Math.min(...recencyScores);
  const maxRec = Math.max(...recencyScores);
  const maxLikes = Math.max(1, ...items.map((i) => ctx.getLikeCount(i.post.id)));
  const maxComments = Math.max(1, ...items.map((i) => ctx.getCommentCount(i.post.id)));
  const velocityValues = items.map((i) => ctx.engagementVelocityByPostId[i.post.id] ?? 0);
  const maxVelocity = Math.max(1, ...velocityValues);
  const depthValues = items.map(
    (i) =>
      (ctx.commentDepthByPostId[i.post.id]?.total ?? 0) +
      (ctx.commentDepthByPostId[i.post.id]?.replyCount ?? 0) * 0.5
  );
  const maxDepth = Math.max(1, ...depthValues);
  const watchValues = items.map((i) => ctx.watchTimeByPostId[i.post.id] ?? 0);
  const maxWatch = Math.max(1, ...watchValues);
  const W = FEED_RANKING_WEIGHTS;
  const wLikes = 0.1;
  const wComments = 0.1;

  return items
    .map((item) => {
      const t = new Date(item.post.created_at).getTime();
      const recencyNorm = maxRec > minRec ? normalize(recencyDecayScore(t, nowMs), minRec, maxRec) : 1;
      const likeNorm = ctx.getLikeCount(item.post.id) / maxLikes;
      const commentNorm = ctx.getCommentCount(item.post.id) / maxComments;
      const velocityNorm = (ctx.engagementVelocityByPostId[item.post.id] ?? 0) / maxVelocity;
      const depthNorm =
        maxDepth > 0
          ? ((ctx.commentDepthByPostId[item.post.id]?.total ?? 0) +
              (ctx.commentDepthByPostId[item.post.id]?.replyCount ?? 0) * 0.5) /
            maxDepth
          : 0;
      const watchNorm = (ctx.watchTimeByPostId[item.post.id] ?? 0) / maxWatch;
      const followBoost = ctx.followedIds.has(item.post.user_id) ? 1 : 0;
      const repNorm = item.profile
        ? reputationScore(item.profile.reputation_score, item.profile.verified_tier)
        : 0;
      const geoBoost = ctx.nearbyPostIds.has(item.post.id) ? 1 : 0;
      const purchaseBoost = ctx.purchasedCreatorIds.has(item.post.user_id) ? 1 : 0;
      const sponsoredBoost = item.post.is_sponsored ? 1 : 0;
      const matchesMore = postMatchesTopics(item.post, ctx.seeMoreTopics);
      const matchesLess = postMatchesTopics(item.post, ctx.seeLessTopics);
      const tokenBoost = ctx.viewerUserId ? getTokenBoost(ctx.viewerUserId, item.post.id) : 0;
      const score =
        W.recencyDecay * recencyNorm +
        W.follow * followBoost +
        W.engagementVelocity * velocityNorm +
        W.commentDepth * depthNorm +
        W.watchTime * watchNorm +
        wLikes * likeNorm +
        wComments * commentNorm +
        W.reputation * repNorm +
        W.geo * geoBoost +
        W.purchaseBehavior * purchaseBoost +
        W.sponsored * sponsoredBoost +
        W.seeMore * (matchesMore ? 1 : 0) +
        W.seeLess * (matchesLess ? 1 : 0) +
        W.token * tokenBoost;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}
