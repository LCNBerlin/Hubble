import { useCallback, useEffect, useState } from "react";
import { ScrollView } from "react-native";
import {
  getRevenueOverview,
  getTransactionMetrics,
  getSubscriptionMetrics,
  getTrafficToRevenueMetrics,
  getUnitEconomicsMetrics,
  getRevenueQualityMetrics,
  getFunnelMonetizationMetrics,
  getSubscriptionIntelligenceMetrics,
  getCashFlowDynamicsMetrics,
  getRevenueForecastMetrics,
  getAffiliateReferralMetrics,
  formatCents,
} from "../../lib/analytics-income";
import { useAuth } from "../../context/AuthContext";
import {
  RecommendedActions,
  SectionHeader,
  StatRow,
  WidgetCard,
} from "../../components/analytics";

export default function IncomeScreen() {
  const { user } = useAuth();
  const [revenue, setRevenue] = useState<Awaited<ReturnType<typeof getRevenueOverview>> | null>(null);
  const [transactions, setTransactions] = useState<Awaited<ReturnType<typeof getTransactionMetrics>> | null>(null);
  const [subscriptionMetrics, setSubscriptionMetrics] = useState<Awaited<ReturnType<typeof getSubscriptionMetrics>> | null>(null);
  const [trafficToRevenue, setTrafficToRevenue] = useState<Awaited<ReturnType<typeof getTrafficToRevenueMetrics>> | null>(null);
  const [unitEconomics, setUnitEconomics] = useState<Awaited<ReturnType<typeof getUnitEconomicsMetrics>> | null>(null);
  const [revenueQuality, setRevenueQuality] = useState<Awaited<ReturnType<typeof getRevenueQualityMetrics>> | null>(null);
  const [funnelMonetization, setFunnelMonetization] = useState<Awaited<ReturnType<typeof getFunnelMonetizationMetrics>> | null>(null);
  const [subscriptionIntelligence, setSubscriptionIntelligence] = useState<Awaited<ReturnType<typeof getSubscriptionIntelligenceMetrics>> | null>(null);
  const [cashFlowDynamics, setCashFlowDynamics] = useState<Awaited<ReturnType<typeof getCashFlowDynamicsMetrics>> | null>(null);
  const [revenueForecast, setRevenueForecast] = useState<Awaited<ReturnType<typeof getRevenueForecastMetrics>> | null>(null);
  const [affiliateReferral, setAffiliateReferral] = useState<Awaited<ReturnType<typeof getAffiliateReferralMetrics>> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [r, t, s, tr, ue, rq, fm, si, cf, rf, ar] = await Promise.all([
        getRevenueOverview(user.id),
        getTransactionMetrics(user.id),
        getSubscriptionMetrics(user.id),
        getTrafficToRevenueMetrics(user.id),
        getUnitEconomicsMetrics(user.id),
        getRevenueQualityMetrics(user.id),
        getFunnelMonetizationMetrics(user.id),
        getSubscriptionIntelligenceMetrics(user.id),
        getCashFlowDynamicsMetrics(user.id),
        getRevenueForecastMetrics(user.id),
        getAffiliateReferralMetrics(user.id),
      ]);
      setRevenue(r);
      setTransactions(t);
      setSubscriptionMetrics(s);
      setTrafficToRevenue(tr);
      setUnitEconomics(ue);
      setRevenueQuality(rq);
      setFunnelMonetization(fm);
      setSubscriptionIntelligence(si);
      setCashFlowDynamics(cf);
      setRevenueForecast(rf);
      setAffiliateReferral(ar);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const tips: string[] = [];
  if (revenue && revenue.totalCentsMonth > 0) {
    tips.push(`This month you've earned ${formatCents(revenue.totalCentsMonth)} from ${revenue.salesCountMonth} sale(s).`);
  }
  if (transactions && transactions.pendingPayoutsCents > 0) {
    tips.push(`${formatCents(transactions.pendingPayoutsCents)} is pending payout.`);
  }
  if (subscriptionMetrics && subscriptionMetrics.uniqueSubscribersLifetime > 0) {
    tips.push(`${subscriptionMetrics.uniqueSubscribersLifetime} subscription order(s) from membership products.`);
  }
  if (trafficToRevenue && trafficToRevenue.totalFollowers > 0 && trafficToRevenue.revenuePerFollowerCentsLifetime != null) {
    tips.push(`Revenue per follower (lifetime): ${formatCents(trafficToRevenue.revenuePerFollowerCentsLifetime)}.`);
  }
  if (tips.length === 0 && !loading) {
    tips.push("Sell products or memberships to see income analytics here.");
  }

  return (
    <ScrollView
      className="flex-1 bg-zinc-950"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <RecommendedActions tips={tips} />

      <SectionHeader title="Basic" subtitle="Core financial performance" />

      <WidgetCard title="Revenue Overview" loading={loading}>
        {revenue && (
          <>
            <StatRow label="Today" value={formatCents(revenue.totalCentsToday)} />
            <StatRow label="This month" value={formatCents(revenue.totalCentsMonth)} />
            <StatRow label="Lifetime" value={formatCents(revenue.totalCentsLifetime)} />
            <StatRow label="Sales (today)" value={revenue.salesCountToday} />
            <StatRow label="Sales (month)" value={revenue.salesCountMonth} />
            <StatRow label="Sales (lifetime)" value={revenue.salesCountLifetime} />
          </>
        )}
      </WidgetCard>

      <WidgetCard title="Transaction Metrics" loading={loading}>
        {transactions && (
          <>
            <StatRow label="Number of sales" value={transactions.salesCount} />
            <StatRow label="Average order value" value={formatCents(transactions.averageOrderValueCents)} />
            <StatRow label="Refund rate" value={transactions.refundRate != null ? `${transactions.refundRate}%` : "—"} />
            <StatRow label="Chargeback rate" value={transactions.chargebackRate != null ? `${transactions.chargebackRate}%` : "—"} />
            <StatRow label="Pending payouts" value={formatCents(transactions.pendingPayoutsCents)} />
          </>
        )}
      </WidgetCard>

      <WidgetCard title="Subscription Metrics" loading={loading}>
        {subscriptionMetrics && (
          <>
            <StatRow label="Subscription revenue (today)" value={formatCents(subscriptionMetrics.subscriptionRevenueCentsToday)} />
            <StatRow label="Subscription revenue (month)" value={formatCents(subscriptionMetrics.subscriptionRevenueCentsMonth)} />
            <StatRow label="Subscription revenue (lifetime)" value={formatCents(subscriptionMetrics.subscriptionRevenueCentsLifetime)} />
            <StatRow label="Subscription sales (today)" value={subscriptionMetrics.subscriptionSalesCountToday} />
            <StatRow label="Subscription sales (month)" value={subscriptionMetrics.subscriptionSalesCountMonth} />
            <StatRow label="Subscription sales (lifetime)" value={subscriptionMetrics.subscriptionSalesCountLifetime} />
            <StatRow label="Active subscription products" value={subscriptionMetrics.activeSubscriptionProductCount} />
            <StatRow label="Subscription orders (lifetime)" value={subscriptionMetrics.uniqueSubscribersLifetime} />
          </>
        )}
      </WidgetCard>
      <WidgetCard title="Traffic to Revenue" loading={loading}>
        {trafficToRevenue && (
          <>
            <StatRow label="Audience (followers)" value={trafficToRevenue.totalFollowers} />
            <StatRow label="Lifetime revenue" value={formatCents(trafficToRevenue.totalRevenueCentsLifetime)} />
            <StatRow label="Revenue this month" value={formatCents(trafficToRevenue.totalRevenueCentsMonth)} />
            <StatRow label="Sales (lifetime)" value={trafficToRevenue.salesCountLifetime} />
            <StatRow label="Sales (this month)" value={trafficToRevenue.salesCountMonth} />
            <StatRow
              label="Revenue per follower (lifetime)"
              value={trafficToRevenue.revenuePerFollowerCentsLifetime != null ? formatCents(trafficToRevenue.revenuePerFollowerCentsLifetime) : "—"}
            />
            <StatRow
              label="Revenue per follower (month)"
              value={trafficToRevenue.revenuePerFollowerCentsMonth != null ? formatCents(trafficToRevenue.revenuePerFollowerCentsMonth) : "—"}
            />
            <StatRow
              label="Sales per 1k followers (lifetime)"
              value={trafficToRevenue.salesPerThousandFollowersLifetime != null ? String(trafficToRevenue.salesPerThousandFollowersLifetime) : "—"}
            />
            <StatRow
              label="Sales per 1k followers (month)"
              value={trafficToRevenue.salesPerThousandFollowersMonth != null ? String(trafficToRevenue.salesPerThousandFollowersMonth) : "—"}
            />
          </>
        )}
      </WidgetCard>

      <SectionHeader title="Advanced" subtitle="Operator-level financial intelligence" />
      <WidgetCard title="Unit Economics" loading={loading}>
        {unitEconomics && (
          <>
            <StatRow label="Net revenue (lifetime)" value={formatCents(unitEconomics.totalNetRevenueCentsLifetime)} />
            <StatRow label="Net revenue (month)" value={formatCents(unitEconomics.totalNetRevenueCentsMonth)} />
            <StatRow label="Platform fees (lifetime)" value={formatCents(unitEconomics.totalFeeCentsLifetime)} />
            <StatRow label="Platform fees (month)" value={formatCents(unitEconomics.totalFeeCentsMonth)} />
            <StatRow label="Gross (lifetime)" value={formatCents(unitEconomics.grossCentsLifetime)} />
            <StatRow label="Gross (month)" value={formatCents(unitEconomics.grossCentsMonth)} />
            <StatRow label="Sales (lifetime)" value={unitEconomics.salesCountLifetime} />
            <StatRow label="Sales (month)" value={unitEconomics.salesCountMonth} />
            <StatRow label="Avg revenue per sale" value={formatCents(unitEconomics.averageRevenuePerSaleCents)} />
            <StatRow label="Avg fee per sale" value={formatCents(unitEconomics.averageFeePerSaleCents)} />
            <StatRow
              label="Net margin (lifetime)"
              value={unitEconomics.netMarginPercentLifetime != null ? `${unitEconomics.netMarginPercentLifetime}%` : "—"}
            />
            <StatRow
              label="Net margin (month)"
              value={unitEconomics.netMarginPercentMonth != null ? `${unitEconomics.netMarginPercentMonth}%` : "—"}
            />
          </>
        )}
      </WidgetCard>
      <WidgetCard title="Revenue Quality Metrics" loading={loading}>
        {revenueQuality && (
          <>
            <StatRow
              label="Payout success rate"
              value={revenueQuality.payoutSuccessRatePercent != null ? `${revenueQuality.payoutSuccessRatePercent}%` : "—"}
            />
            <StatRow label="Failed payouts (lifetime)" value={revenueQuality.failedPayoutsLifetime} />
            <StatRow label="Failed payouts (month)" value={revenueQuality.failedPayoutsMonth} />
            <StatRow
              label="Pending share of revenue"
              value={revenueQuality.pendingSharePercent != null ? `${revenueQuality.pendingSharePercent}%` : "—"}
            />
            <StatRow
              label="Recurring revenue share"
              value={revenueQuality.recurringRevenueSharePercent != null ? `${revenueQuality.recurringRevenueSharePercent}%` : "—"}
            />
            <StatRow
              label="Top product revenue share"
              value={revenueQuality.topProductRevenueSharePercent != null ? `${revenueQuality.topProductRevenueSharePercent}%` : "—"}
            />
            <StatRow
              label="Top 3 products revenue share"
              value={revenueQuality.top3ProductsRevenueSharePercent != null ? `${revenueQuality.top3ProductsRevenueSharePercent}%` : "—"}
            />
          </>
        )}
      </WidgetCard>
      <WidgetCard title="Funnel Monetization" loading={loading}>
        {funnelMonetization && (
          <>
            <StatRow label="Catalog size (products)" value={funnelMonetization.catalogSize} />
            <StatRow label="Products with at least one sale" value={funnelMonetization.productsWithSalesCount} />
            <StatRow label="Sales (lifetime)" value={funnelMonetization.salesCountLifetime} />
            <StatRow label="Sales (month)" value={funnelMonetization.salesCountMonth} />
            <StatRow label="Revenue (lifetime)" value={formatCents(funnelMonetization.totalRevenueCentsLifetime)} />
            <StatRow label="Revenue (month)" value={formatCents(funnelMonetization.totalRevenueCentsMonth)} />
            <StatRow
              label="Product conversion (% catalog sold)"
              value={funnelMonetization.productConversionPercent != null ? `${funnelMonetization.productConversionPercent}%` : "—"}
            />
            <StatRow
              label="Avg sales per product sold"
              value={funnelMonetization.averageSalesPerProduct != null ? String(funnelMonetization.averageSalesPerProduct) : "—"}
            />
            <StatRow
              label="Avg revenue per product sold"
              value={funnelMonetization.averageRevenuePerProductCents != null ? formatCents(funnelMonetization.averageRevenuePerProductCents) : "—"}
            />
          </>
        )}
      </WidgetCard>
      <WidgetCard title="Subscription Intelligence" loading={loading}>
        {subscriptionIntelligence && (
          <>
            <StatRow label="Subscription revenue (lifetime)" value={formatCents(subscriptionIntelligence.subscriptionRevenueCentsLifetime)} />
            <StatRow label="Subscription revenue (month)" value={formatCents(subscriptionIntelligence.subscriptionRevenueCentsMonth)} />
            <StatRow label="Total revenue (lifetime)" value={formatCents(subscriptionIntelligence.totalRevenueCentsLifetime)} />
            <StatRow label="Subscription orders (lifetime)" value={subscriptionIntelligence.subscriptionOrderCountLifetime} />
            <StatRow label="Subscription sales (lifetime)" value={subscriptionIntelligence.subscriptionSalesCountLifetime} />
            <StatRow label="Active subscription products" value={subscriptionIntelligence.activeSubscriptionProductCount} />
            <StatRow label="Subscription products with sales" value={subscriptionIntelligence.subscriptionProductsWithSalesCount} />
            <StatRow
              label="Subscription share of total revenue"
              value={subscriptionIntelligence.subscriptionShareOfTotalRevenuePercent != null ? `${subscriptionIntelligence.subscriptionShareOfTotalRevenuePercent}%` : "—"}
            />
            <StatRow
              label="Avg revenue per subscription order"
              value={subscriptionIntelligence.averageRevenuePerSubscriptionOrderCents != null ? formatCents(subscriptionIntelligence.averageRevenuePerSubscriptionOrderCents) : "—"}
            />
            <StatRow
              label="Subscription product conversion"
              value={subscriptionIntelligence.subscriptionProductConversionPercent != null ? `${subscriptionIntelligence.subscriptionProductConversionPercent}%` : "—"}
            />
            <StatRow
              label="Top subscription product share"
              value={subscriptionIntelligence.topSubscriptionProductSharePercent != null ? `${subscriptionIntelligence.topSubscriptionProductSharePercent}%` : "—"}
            />
            <StatRow
              label="Avg subscription sales per product sold"
              value={subscriptionIntelligence.averageSubscriptionSalesPerProduct != null ? String(subscriptionIntelligence.averageSubscriptionSalesPerProduct) : "—"}
            />
          </>
        )}
      </WidgetCard>
      <WidgetCard title="Cash Flow Dynamics" loading={loading}>
        {cashFlowDynamics && (
          <>
            <StatRow label="Received / paid (lifetime)" value={formatCents(cashFlowDynamics.paidAmountCentsLifetime)} />
            <StatRow label="Received / paid (month)" value={formatCents(cashFlowDynamics.paidAmountCentsMonth)} />
            <StatRow label="Pending (not yet received)" value={formatCents(cashFlowDynamics.pendingAmountCentsLifetime)} />
            <StatRow label="Paid payouts count (lifetime)" value={cashFlowDynamics.paidCountLifetime} />
            <StatRow label="Paid payouts count (month)" value={cashFlowDynamics.paidCountMonth} />
            <StatRow label="Pending payouts count" value={cashFlowDynamics.pendingCountLifetime} />
            <StatRow label="Failed amount (lifetime)" value={formatCents(cashFlowDynamics.failedAmountCentsLifetime)} />
            <StatRow label="Failed payouts count" value={cashFlowDynamics.failedCountLifetime} />
            <StatRow
              label="Liquidity (% earned received)"
              value={cashFlowDynamics.liquidityPercent != null ? `${cashFlowDynamics.liquidityPercent}%` : "—"}
            />
            <StatRow
              label="Pending as % of earned"
              value={cashFlowDynamics.pendingAsPercentOfEarned != null ? `${cashFlowDynamics.pendingAsPercentOfEarned}%` : "—"}
            />
            <StatRow
              label="Avg paid payout size"
              value={cashFlowDynamics.averagePaidPayoutCents != null ? formatCents(cashFlowDynamics.averagePaidPayoutCents) : "—"}
            />
            <StatRow
              label="Avg pending payout size"
              value={cashFlowDynamics.averagePendingPayoutCents != null ? formatCents(cashFlowDynamics.averagePendingPayoutCents) : "—"}
            />
          </>
        )}
      </WidgetCard>
      <WidgetCard title="AI Revenue Forecasting" loading={loading}>
        {revenueForecast && (
          <>
            <StatRow label="Revenue (last 7 days)" value={formatCents(revenueForecast.revenueLast7DaysCents)} />
            <StatRow label="Revenue (last 30 days)" value={formatCents(revenueForecast.revenueLast30DaysCents)} />
            <StatRow label="Revenue this month (to date)" value={formatCents(revenueForecast.revenueThisMonthCents)} />
            <StatRow label="Days elapsed this month" value={revenueForecast.daysElapsedInMonth} />
            <StatRow
              label="Avg daily rate (7d)"
              value={revenueForecast.averageDailyRateLast7DaysCents != null ? formatCents(revenueForecast.averageDailyRateLast7DaysCents) : "—"}
            />
            <StatRow
              label="Avg daily rate (30d)"
              value={revenueForecast.averageDailyRateLast30DaysCents != null ? formatCents(revenueForecast.averageDailyRateLast30DaysCents) : "—"}
            />
            <StatRow
              label="Projected next 7 days"
              value={revenueForecast.projectedNext7DaysCents != null ? formatCents(revenueForecast.projectedNext7DaysCents) : "—"}
            />
            <StatRow
              label="Projected next 30 days"
              value={revenueForecast.projectedNext30DaysCents != null ? formatCents(revenueForecast.projectedNext30DaysCents) : "—"}
            />
            <StatRow
              label="Projected full month (this month)"
              value={revenueForecast.projectedThisMonthFullCents != null ? formatCents(revenueForecast.projectedThisMonthFullCents) : "—"}
            />
          </>
        )}
      </WidgetCard>
      <WidgetCard title="Affiliate & Referral Analytics" loading={loading}>
        {affiliateReferral && (
          <>
            <StatRow
              label="Your affiliate code"
              value={affiliateReferral.affiliateCode ?? "—"}
            />
            <StatRow label="Referral clicks (lifetime)" value={affiliateReferral.clicksLifetime} />
            <StatRow label="Referral clicks (month)" value={affiliateReferral.clicksMonth} />
            <StatRow label="Referral signups (lifetime)" value={affiliateReferral.signupsLifetime} />
            <StatRow label="Referral signups (month)" value={affiliateReferral.signupsMonth} />
            <StatRow label="Unique signups (lifetime)" value={affiliateReferral.uniqueSignupsLifetime} />
            <StatRow label="Referral purchases (lifetime)" value={affiliateReferral.purchasesLifetime} />
            <StatRow label="Referral purchases (month)" value={affiliateReferral.purchasesMonth} />
            <StatRow
              label="Signup conversion (clicks → signups)"
              value={affiliateReferral.signupConversionPercent != null ? `${affiliateReferral.signupConversionPercent}%` : "—"}
            />
            <StatRow
              label="Purchase conversion (clicks → purchases)"
              value={affiliateReferral.purchaseConversionPercent != null ? `${affiliateReferral.purchaseConversionPercent}%` : "—"}
            />
          </>
        )}
      </WidgetCard>
    </ScrollView>
  );
}
