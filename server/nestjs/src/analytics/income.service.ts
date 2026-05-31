import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { RedisService } from "../common/redis/redis.service";

const TTL = 60 * 60 * 1000; // 1 hour

@Injectable()
export class IncomeService {
  constructor(private db: DataSource, private redis: RedisService) {}

  private cache<T>(key: string, fn: () => Promise<T>) {
    return this.redis.getOrSet(`analytics:income:${key}`, fn, TTL);
  }

  async getRevenueOverview(creatorId: string) {
    return this.cache(`${creatorId}:revenue-overview`, async () => {
      const [today, month, lifetime] = await Promise.all([
        this.db.query(
          `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM creator_payouts
           WHERE creator_id = $1 AND status = 'paid' AND created_at >= CURRENT_DATE`,
          [creatorId]
        ),
        this.db.query(
          `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM creator_payouts
           WHERE creator_id = $1 AND status = 'paid' AND created_at >= DATE_TRUNC('month', NOW())`,
          [creatorId]
        ),
        this.db.query(
          `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM creator_payouts
           WHERE creator_id = $1 AND status = 'paid'`,
          [creatorId]
        ),
      ]);
      return {
        todayCents: Number(today[0]?.total ?? 0),
        monthCents: Number(month[0]?.total ?? 0),
        lifetimeCents: Number(lifetime[0]?.total ?? 0),
      };
    });
  }

  async getTransactionMetrics(creatorId: string) {
    return this.cache(`${creatorId}:transactions`, async () => {
      const rows = await this.db.query(
        `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount_cents), 0) AS total
         FROM creator_payouts WHERE creator_id = $1 GROUP BY status`,
        [creatorId]
      );
      const paid = rows.find((r: { status: string }) => r.status === "paid");
      const pending = rows.find((r: { status: string }) => r.status === "pending");
      const totalPaid = Number(paid?.count ?? 0);
      const avgOrder = totalPaid > 0 ? Number(paid?.total ?? 0) / totalPaid : 0;
      return { paid: Number(paid?.count ?? 0), pending: Number(pending?.count ?? 0), avgOrderCents: Math.round(avgOrder) };
    });
  }

  async getUnitEconomics(creatorId: string) {
    return this.cache(`${creatorId}:unit-economics`, async () => {
      const rows = await this.db.query(
        `SELECT COALESCE(SUM(amount_cents), 0) AS gross, COALESCE(SUM(fee_cents), 0) AS fees
         FROM creator_payouts WHERE creator_id = $1 AND status = 'paid'`,
        [creatorId]
      );
      const gross = Number(rows[0]?.gross ?? 0);
      const fees = Number(rows[0]?.fees ?? 0);
      return { grossCents: gross, feesCents: fees, netCents: gross - fees, marginPct: gross > 0 ? (gross - fees) / gross : 0 };
    });
  }

  async getCashFlowDynamics(creatorId: string) {
    return this.cache(`${creatorId}:cash-flow`, async () => {
      const rows = await this.db.query(
        `SELECT status, COALESCE(SUM(amount_cents), 0) AS total
         FROM creator_payouts WHERE creator_id = $1 GROUP BY status`,
        [creatorId]
      );
      return rows;
    });
  }

  async getRevenueForecast(creatorId: string) {
    return this.cache(`${creatorId}:forecast`, async () => {
      const rows = await this.db.query(
        `SELECT DATE_TRUNC('day', created_at) AS day, SUM(amount_cents) AS total
         FROM creator_payouts WHERE creator_id = $1 AND status = 'paid'
         AND created_at > NOW() - INTERVAL '30 days'
         GROUP BY day ORDER BY day`,
        [creatorId]
      );
      if (rows.length < 2) return { forecast7d: 0, forecast30d: 0 };
      const avg = rows.reduce((s: number, r: { total: string }) => s + Number(r.total), 0) / rows.length;
      return { dailyAvgCents: Math.round(avg), forecast7dCents: Math.round(avg * 7), forecast30dCents: Math.round(avg * 30) };
    });
  }

  async getAffiliateReferral(creatorId: string) {
    return this.cache(`${creatorId}:affiliate`, async () => {
      return this.db.query(
        `SELECT type, COUNT(*) AS count FROM referral_events WHERE creator_id = $1 GROUP BY type`,
        [creatorId]
      );
    });
  }

  async getRevenueQuality(creatorId: string) {
    return this.cache(`${creatorId}:revenue-quality`, async () => {
      const rows = await this.db.query(
        `SELECT status, COUNT(*) AS count FROM creator_payouts WHERE creator_id = $1 GROUP BY status`,
        [creatorId]
      );
      return rows;
    });
  }

  async getFunnelMonetization(creatorId: string) {
    return this.cache(`${creatorId}:funnel-monetization`, async () => {
      const [catalog, revenue] = await Promise.all([
        this.db.query(`SELECT COUNT(*) AS cnt FROM products WHERE creator_id = $1`, [creatorId]),
        this.db.query(`SELECT COALESCE(SUM(amount_cents), 0) AS total FROM creator_payouts WHERE creator_id = $1 AND status = 'paid'`, [creatorId]),
      ]);
      return { catalogSize: Number(catalog[0]?.cnt ?? 0), totalRevenueCents: Number(revenue[0]?.total ?? 0) };
    });
  }

  async getTrafficToRevenue(creatorId: string) {
    return this.cache(`${creatorId}:traffic-to-revenue`, async () => {
      const [profile, revenue] = await Promise.all([
        this.db.query(`SELECT followers_count FROM profiles WHERE id = $1`, [creatorId]),
        this.db.query(`SELECT COALESCE(SUM(amount_cents), 0) AS total FROM creator_payouts WHERE creator_id = $1 AND status = 'paid'`, [creatorId]),
      ]);
      const followers = profile[0]?.followers_count ?? 0;
      const totalRevenue = Number(revenue[0]?.total ?? 0);
      return { followersCount: followers, totalRevenueCents: totalRevenue, revenuePerFollower: followers > 0 ? totalRevenue / followers : 0 };
    });
  }

  async getSubscriptionMetrics(creatorId: string) {
    return this.cache(`${creatorId}:subscriptions`, async () => {
      const [products, revenue] = await Promise.all([
        this.db.query(
          `SELECT COUNT(*) AS cnt FROM products WHERE creator_id = $1 AND product_type = 'membership'`,
          [creatorId]
        ),
        this.db.query(
          `SELECT COALESCE(SUM(cp.amount_cents), 0) AS total FROM creator_payouts cp
           JOIN order_items oi ON oi.id = cp.order_item_id
           JOIN products p ON p.id = oi.product_id
           WHERE cp.creator_id = $1 AND p.product_type = 'membership' AND cp.status = 'paid'`,
          [creatorId]
        ),
      ]);
      return { subscriptionProducts: Number(products[0]?.cnt ?? 0), subscriptionRevenueCents: Number(revenue[0]?.total ?? 0) };
    });
  }
}
