/**
 * Feed ranking helpers for "For you" score computation.
 * Weights and formulas are centralized here for tuning and tests.
 */

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
