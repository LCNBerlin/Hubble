import type { Product } from "../context/ContentContext";

export const DISCOVERY_WEIGHTS = {
  /** Sponsored / pinned products get this added to score so they rank higher. */
  SPONSORED: 1000,
  /** Future: sales volume (e.g. count from order_items). */
  SALES: 0,
  /** Future: engagement velocity. */
  ENGAGEMENT: 0,
  /** Future: user browsing history boost. */
  BROWSE: 0,
  /** Future: geo relevance. */
  GEO: 0,
} as const;

export type ScoreOpts = {
  salesByProductId?: Record<string, number>;
  browseBoostProductIds?: Set<string>;
  geoRelevanceByProductId?: Record<string, number>;
};

/**
 * Compute a discovery score for a product. Higher = rank first.
 * Currently only sponsored/pinned weight is applied; other signals stubbed.
 */
export function scoreProduct(p: Product, opts: ScoreOpts = {}): number {
  const {
    salesByProductId = {},
    browseBoostProductIds = new Set(),
    geoRelevanceByProductId = {},
  } = opts;
  let score = 0;
  if (p.isSponsored || p.pinned) {
    score += DISCOVERY_WEIGHTS.SPONSORED;
  }
  score += (salesByProductId[p.id] ?? 0) * DISCOVERY_WEIGHTS.SALES;
  if (browseBoostProductIds.has(p.id)) {
    score += DISCOVERY_WEIGHTS.BROWSE;
  }
  score += (geoRelevanceByProductId[p.id] ?? 0) * DISCOVERY_WEIGHTS.GEO;
  return score;
}

/**
 * Sort products by discovery score descending, then by title for stability.
 */
export function rankProducts(
  products: Product[],
  opts?: ScoreOpts
): Product[] {
  const withScore = products.map((p) => ({ p, score: scoreProduct(p, opts) }));
  withScore.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.p.title ?? "").localeCompare(b.p.title ?? "");
  });
  return withScore.map((x) => x.p);
}
