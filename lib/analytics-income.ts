import { apiGet } from "./api";

export type RevenueOverview = {
  totalCentsToday: number;
  totalCentsMonth: number;
  totalCentsLifetime: number;
  salesCountToday: number;
  salesCountMonth: number;
  salesCountLifetime: number;
};

export type TransactionMetrics = {
  salesCount: number;
  averageOrderValueCents: number;
  refundRate: number | null;
  chargebackRate: number | null;
  pendingPayoutsCents: number;
};

export type SubscriptionMetrics = {
  subscriptionRevenueCentsToday: number;
  subscriptionRevenueCentsMonth: number;
  subscriptionRevenueCentsLifetime: number;
  subscriptionSalesCountToday: number;
  subscriptionSalesCountMonth: number;
  subscriptionSalesCountLifetime: number;
  activeSubscriptionProductCount: number;
  uniqueSubscribersLifetime: number;
};

export type TrafficToRevenueMetrics = {
  totalFollowers: number;
  totalRevenueCentsLifetime: number;
  totalRevenueCentsMonth: number;
  salesCountLifetime: number;
  salesCountMonth: number;
  revenuePerFollowerCentsLifetime: number | null;
  revenuePerFollowerCentsMonth: number | null;
  salesPerThousandFollowersLifetime: number | null;
  salesPerThousandFollowersMonth: number | null;
};

export type UnitEconomicsMetrics = {
  totalNetRevenueCentsLifetime: number;
  totalNetRevenueCentsMonth: number;
  totalFeeCentsLifetime: number;
  totalFeeCentsMonth: number;
  grossCentsLifetime: number;
  grossCentsMonth: number;
  salesCountLifetime: number;
  salesCountMonth: number;
  averageRevenuePerSaleCents: number;
  averageFeePerSaleCents: number;
  netMarginPercentLifetime: number | null;
  netMarginPercentMonth: number | null;
};

export type RevenueQualityMetrics = {
  payoutSuccessRatePercent: number | null;
  failedPayoutsLifetime: number;
  failedPayoutsMonth: number;
  pendingSharePercent: number | null;
  recurringRevenueSharePercent: number | null;
  topProductRevenueSharePercent: number | null;
  top3ProductsRevenueSharePercent: number | null;
};

export type FunnelMonetizationMetrics = {
  catalogSize: number;
  productsWithSalesCount: number;
  salesCountLifetime: number;
  salesCountMonth: number;
  totalRevenueCentsLifetime: number;
  totalRevenueCentsMonth: number;
  productConversionPercent: number | null;
  averageSalesPerProduct: number | null;
  averageRevenuePerProductCents: number | null;
};

export type SubscriptionIntelligenceMetrics = {
  subscriptionRevenueCentsLifetime: number;
  subscriptionRevenueCentsMonth: number;
  totalRevenueCentsLifetime: number;
  subscriptionOrderCountLifetime: number;
  subscriptionSalesCountLifetime: number;
  activeSubscriptionProductCount: number;
  subscriptionProductsWithSalesCount: number;
  subscriptionShareOfTotalRevenuePercent: number | null;
  averageRevenuePerSubscriptionOrderCents: number | null;
  subscriptionProductConversionPercent: number | null;
  topSubscriptionProductSharePercent: number | null;
  averageSubscriptionSalesPerProduct: number | null;
};

export type CashFlowDynamicsMetrics = {
  paidAmountCentsLifetime: number;
  paidAmountCentsMonth: number;
  pendingAmountCentsLifetime: number;
  paidCountLifetime: number;
  paidCountMonth: number;
  pendingCountLifetime: number;
  failedAmountCentsLifetime: number;
  failedCountLifetime: number;
  liquidityPercent: number | null;
  pendingAsPercentOfEarned: number | null;
  averagePaidPayoutCents: number | null;
  averagePendingPayoutCents: number | null;
};

export type RevenueForecastMetrics = {
  revenueLast7DaysCents: number;
  revenueLast30DaysCents: number;
  revenueThisMonthCents: number;
  daysElapsedInMonth: number;
  averageDailyRateLast7DaysCents: number | null;
  averageDailyRateLast30DaysCents: number | null;
  projectedNext7DaysCents: number | null;
  projectedNext30DaysCents: number | null;
  projectedThisMonthFullCents: number | null;
};

export type AffiliateReferralMetrics = {
  affiliateCode: string | null;
  clicksLifetime: number;
  clicksMonth: number;
  signupsLifetime: number;
  signupsMonth: number;
  purchasesLifetime: number;
  purchasesMonth: number;
  uniqueSignupsLifetime: number;
  signupConversionPercent: number | null;
  purchaseConversionPercent: number | null;
};

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function getRevenueOverview(creatorId: string): Promise<RevenueOverview> {
  return apiGet(`/analytics/income/${creatorId}/revenue-overview`);
}

export async function getTransactionMetrics(creatorId: string): Promise<TransactionMetrics> {
  return apiGet(`/analytics/income/${creatorId}/transaction-metrics`);
}

export async function getSubscriptionMetrics(creatorId: string): Promise<SubscriptionMetrics> {
  return apiGet(`/analytics/income/${creatorId}/subscription-metrics`);
}

export async function getTrafficToRevenueMetrics(creatorId: string): Promise<TrafficToRevenueMetrics> {
  return apiGet(`/analytics/income/${creatorId}/traffic-to-revenue`);
}

export async function getUnitEconomicsMetrics(creatorId: string): Promise<UnitEconomicsMetrics> {
  return apiGet(`/analytics/income/${creatorId}/unit-economics`);
}

export async function getRevenueQualityMetrics(creatorId: string): Promise<RevenueQualityMetrics> {
  return apiGet(`/analytics/income/${creatorId}/revenue-quality`);
}

export async function getFunnelMonetizationMetrics(creatorId: string): Promise<FunnelMonetizationMetrics> {
  return apiGet(`/analytics/income/${creatorId}/funnel-monetization`);
}

export async function getSubscriptionIntelligenceMetrics(creatorId: string): Promise<SubscriptionIntelligenceMetrics> {
  return apiGet(`/analytics/income/${creatorId}/subscription-metrics`);
}

export async function getCashFlowDynamicsMetrics(creatorId: string): Promise<CashFlowDynamicsMetrics> {
  return apiGet(`/analytics/income/${creatorId}/cash-flow`);
}

export async function getRevenueForecastMetrics(creatorId: string): Promise<RevenueForecastMetrics> {
  return apiGet(`/analytics/income/${creatorId}/revenue-forecast`);
}

export async function getAffiliateReferralMetrics(creatorId: string): Promise<AffiliateReferralMetrics> {
  return apiGet(`/analytics/income/${creatorId}/affiliate-referral`);
}
