import supabase from "./supabase";

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
  /** Distinct orders that included a subscription product (proxy for subscriber count when creator cannot read orders). */
  uniqueSubscribersLifetime: number;
};

export async function getRevenueOverview(creatorId: string): Promise<RevenueOverview> {
  if (!supabase) {
    return {
      totalCentsToday: 0,
      totalCentsMonth: 0,
      totalCentsLifetime: 0,
      salesCountToday: 0,
      salesCountMonth: 0,
      salesCountLifetime: 0,
    };
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: payouts } = await supabase
    .from("creator_payouts")
    .select("amount_cents, created_at, status")
    .eq("creator_id", creatorId);

  let totalCentsToday = 0;
  let totalCentsMonth = 0;
  let totalCentsLifetime = 0;
  let salesCountToday = 0;
  let salesCountMonth = 0;
  let salesCountLifetime = 0;

  for (const p of payouts ?? []) {
    if (p.status !== "paid" && p.status !== "pending") continue;
    totalCentsLifetime += p.amount_cents;
    salesCountLifetime += 1;
    if (p.created_at >= startOfMonth) {
      totalCentsMonth += p.amount_cents;
      salesCountMonth += 1;
    }
    if (p.created_at >= startOfToday) {
      totalCentsToday += p.amount_cents;
      salesCountToday += 1;
    }
  }

  return {
    totalCentsToday,
    totalCentsMonth,
    totalCentsLifetime,
    salesCountToday,
    salesCountMonth,
    salesCountLifetime,
  };
}

export async function getTransactionMetrics(creatorId: string): Promise<TransactionMetrics> {
  if (!supabase) {
    return {
      salesCount: 0,
      averageOrderValueCents: 0,
      refundRate: null,
      chargebackRate: null,
      pendingPayoutsCents: 0,
    };
  }

  const { data: payouts } = await supabase
    .from("creator_payouts")
    .select("amount_cents, status")
    .eq("creator_id", creatorId);

  const paid = payouts?.filter((p) => p.status === "paid") ?? [];
  const pending = payouts?.filter((p) => p.status === "pending") ?? [];

  const salesCount = paid.length + pending.length;
  const totalCents = paid.reduce((s, p) => s + p.amount_cents, 0) + pending.reduce((s, p) => s + p.amount_cents, 0);
  const pendingPayoutsCents = pending.reduce((s, p) => s + p.amount_cents, 0);

  return {
    salesCount,
    averageOrderValueCents: salesCount > 0 ? Math.round(totalCents / salesCount) : 0,
    refundRate: null,
    chargebackRate: null,
    pendingPayoutsCents,
  };
}

export async function getSubscriptionMetrics(creatorId: string): Promise<SubscriptionMetrics> {
  const empty: SubscriptionMetrics = {
    subscriptionRevenueCentsToday: 0,
    subscriptionRevenueCentsMonth: 0,
    subscriptionRevenueCentsLifetime: 0,
    subscriptionSalesCountToday: 0,
    subscriptionSalesCountMonth: 0,
    subscriptionSalesCountLifetime: 0,
    activeSubscriptionProductCount: 0,
    uniqueSubscribersLifetime: 0,
  };

  if (!supabase) return empty;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Products that are subscription/membership (type = membership or has interval)
  const { data: subscriptionProducts } = await supabase
    .from("products")
    .select("id")
    .eq("creator_id", creatorId)
    .or("type.eq.membership,interval.not.is.null");

  const subscriptionProductIds = new Set((subscriptionProducts ?? []).map((p) => p.id));

  const activeSubscriptionProductCount = subscriptionProductIds.size;

  // Payouts for this creator with linked order_item (product_id, order_id)
  const { data: payouts } = await supabase
    .from("creator_payouts")
    .select("amount_cents, status, created_at, order_items!order_item_id(product_id, order_id)")
    .eq("creator_id", creatorId);

  type OrderItemRef = { product_id: string; order_id: string } | null;
  type PayoutRow = {
    amount_cents: number;
    status: string;
    created_at: string;
    order_items: OrderItemRef | OrderItemRef[] | null;
  };

  const getOrderItem = (row: PayoutRow): OrderItemRef => {
    const oi = row.order_items;
    if (!oi) return null;
    return Array.isArray(oi) ? oi[0] ?? null : oi;
  };

  let subscriptionRevenueCentsToday = 0;
  let subscriptionRevenueCentsMonth = 0;
  let subscriptionRevenueCentsLifetime = 0;
  let subscriptionSalesCountToday = 0;
  let subscriptionSalesCountMonth = 0;
  let subscriptionSalesCountLifetime = 0;
  const subscriptionOrderIds = new Set<string>();

  for (const p of payouts ?? []) {
    const row = p as PayoutRow;
    if (row.status !== "paid" && row.status !== "pending") continue;
    const orderItem = getOrderItem(row);
    const productId = orderItem?.product_id;
    if (!productId || !subscriptionProductIds.has(productId)) continue;

    subscriptionRevenueCentsLifetime += row.amount_cents;
    subscriptionSalesCountLifetime += 1;
    if (orderItem?.order_id) subscriptionOrderIds.add(orderItem.order_id);
    if (row.created_at >= startOfMonth) {
      subscriptionRevenueCentsMonth += row.amount_cents;
      subscriptionSalesCountMonth += 1;
    }
    if (row.created_at >= startOfToday) {
      subscriptionRevenueCentsToday += row.amount_cents;
      subscriptionSalesCountToday += 1;
    }
  }

  // Subscriber count: distinct orders that contained a subscription product (creator may not have SELECT on orders.buyer_id per RLS, so we use order count as proxy)
  const uniqueSubscribersLifetime = subscriptionOrderIds.size;

  return {
    subscriptionRevenueCentsToday,
    subscriptionRevenueCentsMonth,
    subscriptionRevenueCentsLifetime,
    subscriptionSalesCountToday,
    subscriptionSalesCountMonth,
    subscriptionSalesCountLifetime,
    activeSubscriptionProductCount,
    uniqueSubscribersLifetime,
  };
}

/** Traffic = audience (followers). Revenue = creator payouts. Derived conversion-style metrics. */
export type TrafficToRevenueMetrics = {
  totalFollowers: number;
  totalRevenueCentsLifetime: number;
  totalRevenueCentsMonth: number;
  salesCountLifetime: number;
  salesCountMonth: number;
  /** Revenue per follower (lifetime), or null if no followers. */
  revenuePerFollowerCentsLifetime: number | null;
  /** Revenue per follower (this month), or null if no followers. */
  revenuePerFollowerCentsMonth: number | null;
  /** Sales per 1,000 followers (lifetime), or null if no followers. */
  salesPerThousandFollowersLifetime: number | null;
  /** Sales per 1,000 followers (this month), or null if no followers. */
  salesPerThousandFollowersMonth: number | null;
};

/** Per-sale and margin metrics: net revenue, fees, margin %. */
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
  /** Net margin % (net / gross × 100), or null if no gross. */
  netMarginPercentLifetime: number | null;
  netMarginPercentMonth: number | null;
};

export async function getUnitEconomicsMetrics(creatorId: string): Promise<UnitEconomicsMetrics> {
  const empty: UnitEconomicsMetrics = {
    totalNetRevenueCentsLifetime: 0,
    totalNetRevenueCentsMonth: 0,
    totalFeeCentsLifetime: 0,
    totalFeeCentsMonth: 0,
    grossCentsLifetime: 0,
    grossCentsMonth: 0,
    salesCountLifetime: 0,
    salesCountMonth: 0,
    averageRevenuePerSaleCents: 0,
    averageFeePerSaleCents: 0,
    netMarginPercentLifetime: null,
    netMarginPercentMonth: null,
  };

  if (!supabase) return empty;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: payouts } = await supabase
    .from("creator_payouts")
    .select("amount_cents, fee_cents, created_at, status")
    .eq("creator_id", creatorId);

  let totalNetRevenueCentsLifetime = 0;
  let totalNetRevenueCentsMonth = 0;
  let totalFeeCentsLifetime = 0;
  let totalFeeCentsMonth = 0;
  let salesCountLifetime = 0;
  let salesCountMonth = 0;

  for (const p of payouts ?? []) {
    if (p.status !== "paid" && p.status !== "pending") continue;
    const net = p.amount_cents;
    const fee = p.fee_cents ?? 0;
    totalNetRevenueCentsLifetime += net;
    totalFeeCentsLifetime += fee;
    salesCountLifetime += 1;
    if (p.created_at >= startOfMonth) {
      totalNetRevenueCentsMonth += net;
      totalFeeCentsMonth += fee;
      salesCountMonth += 1;
    }
  }

  const grossCentsLifetime = totalNetRevenueCentsLifetime + totalFeeCentsLifetime;
  const grossCentsMonth = totalNetRevenueCentsMonth + totalFeeCentsMonth;

  const averageRevenuePerSaleCents =
    salesCountLifetime > 0 ? Math.round(totalNetRevenueCentsLifetime / salesCountLifetime) : 0;
  const averageFeePerSaleCents =
    salesCountLifetime > 0 ? Math.round(totalFeeCentsLifetime / salesCountLifetime) : 0;

  const netMarginPercentLifetime =
    grossCentsLifetime > 0
      ? Math.round((totalNetRevenueCentsLifetime / grossCentsLifetime) * 10000) / 100
      : null;
  const netMarginPercentMonth =
    grossCentsMonth > 0 ? Math.round((totalNetRevenueCentsMonth / grossCentsMonth) * 10000) / 100 : null;

  return {
    totalNetRevenueCentsLifetime,
    totalNetRevenueCentsMonth,
    totalFeeCentsLifetime,
    totalFeeCentsMonth,
    grossCentsLifetime,
    grossCentsMonth,
    salesCountLifetime,
    salesCountMonth,
    averageRevenuePerSaleCents,
    averageFeePerSaleCents,
    netMarginPercentLifetime,
    netMarginPercentMonth,
  };
}

/** Revenue quality: success rate, failure count, recurring share, concentration. */
export type RevenueQualityMetrics = {
  payoutSuccessRatePercent: number | null;
  failedPayoutsLifetime: number;
  failedPayoutsMonth: number;
  pendingSharePercent: number | null;
  recurringRevenueSharePercent: number | null;
  topProductRevenueSharePercent: number | null;
  top3ProductsRevenueSharePercent: number | null;
};

export async function getRevenueQualityMetrics(creatorId: string): Promise<RevenueQualityMetrics> {
  const empty: RevenueQualityMetrics = {
    payoutSuccessRatePercent: null,
    failedPayoutsLifetime: 0,
    failedPayoutsMonth: 0,
    pendingSharePercent: null,
    recurringRevenueSharePercent: null,
    topProductRevenueSharePercent: null,
    top3ProductsRevenueSharePercent: null,
  };

  if (!supabase) return empty;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: subscriptionProducts } = await supabase
    .from("products")
    .select("id")
    .eq("creator_id", creatorId)
    .or("type.eq.membership,interval.not.is.null");
  const subscriptionProductIds = new Set((subscriptionProducts ?? []).map((p) => p.id));

  const { data: payouts } = await supabase
    .from("creator_payouts")
    .select("amount_cents, status, created_at, order_items!order_item_id(product_id)")
    .eq("creator_id", creatorId);

  type OrderItemRef = { product_id: string } | null;
  type PayoutRow = {
    amount_cents: number;
    status: string;
    created_at: string;
    order_items: OrderItemRef | OrderItemRef[] | null;
  };
  const getOrderItem = (row: PayoutRow): OrderItemRef => {
    const oi = row.order_items;
    if (!oi) return null;
    return Array.isArray(oi) ? oi[0] ?? null : oi;
  };

  let paidCount = 0;
  let failedCount = 0;
  let failedCountMonth = 0;
  let paidAmountCents = 0;
  let pendingAmountCents = 0;
  let subscriptionRevenueCents = 0;
  const productIdToCents: Record<string, number> = {};

  for (const p of payouts ?? []) {
    const row = p as PayoutRow;
    const amount = row.amount_cents;
    const productId = getOrderItem(row)?.product_id;

    if (row.status === "paid" || row.status === "pending") {
      if (row.status === "paid") {
        paidCount += 1;
        paidAmountCents += amount;
      } else {
        pendingAmountCents += amount;
      }
      if (productId) {
        productIdToCents[productId] = (productIdToCents[productId] ?? 0) + amount;
        if (subscriptionProductIds.has(productId)) subscriptionRevenueCents += amount;
      }
    } else if (row.status === "failed") {
      failedCount += 1;
      if (row.created_at >= startOfMonth) failedCountMonth += 1;
    }
  }

  const totalRevenueCents = paidAmountCents + pendingAmountCents;
  const completedCount = paidCount + failedCount;

  const payoutSuccessRatePercent =
    completedCount > 0 ? Math.round((paidCount / completedCount) * 10000) / 100 : null;

  const pendingSharePercent =
    totalRevenueCents > 0 ? Math.round((pendingAmountCents / totalRevenueCents) * 10000) / 100 : null;

  const recurringRevenueSharePercent =
    totalRevenueCents > 0 ? Math.round((subscriptionRevenueCents / totalRevenueCents) * 10000) / 100 : null;

  const productTotals = Object.values(productIdToCents);
  const sorted = [...productTotals].sort((a, b) => b - a);
  const topProductRevenueSharePercent =
    totalRevenueCents > 0 && sorted.length > 0
      ? Math.round((sorted[0] / totalRevenueCents) * 10000) / 100
      : null;
  const top3Sum = sorted.slice(0, 3).reduce((s, v) => s + v, 0);
  const top3ProductsRevenueSharePercent =
    totalRevenueCents > 0 && sorted.length > 0
      ? Math.round((top3Sum / totalRevenueCents) * 10000) / 100
      : null;

  return {
    payoutSuccessRatePercent,
    failedPayoutsLifetime: failedCount,
    failedPayoutsMonth: failedCountMonth,
    pendingSharePercent,
    recurringRevenueSharePercent,
    topProductRevenueSharePercent,
    top3ProductsRevenueSharePercent,
  };
}

/** Funnel: catalog → products sold → sales → revenue. */
export type FunnelMonetizationMetrics = {
  catalogSize: number;
  productsWithSalesCount: number;
  salesCountLifetime: number;
  salesCountMonth: number;
  totalRevenueCentsLifetime: number;
  totalRevenueCentsMonth: number;
  /** % of catalog products that have at least one sale. */
  productConversionPercent: number | null;
  /** Avg sales per product that has sold. */
  averageSalesPerProduct: number | null;
  /** Avg revenue per product that has sold (cents). */
  averageRevenuePerProductCents: number | null;
};

export async function getFunnelMonetizationMetrics(creatorId: string): Promise<FunnelMonetizationMetrics> {
  const empty: FunnelMonetizationMetrics = {
    catalogSize: 0,
    productsWithSalesCount: 0,
    salesCountLifetime: 0,
    salesCountMonth: 0,
    totalRevenueCentsLifetime: 0,
    totalRevenueCentsMonth: 0,
    productConversionPercent: null,
    averageSalesPerProduct: null,
    averageRevenuePerProductCents: null,
  };

  if (!supabase) return empty;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count: catalogCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("creator_id", creatorId);
  const catalogSize = catalogCount ?? 0;

  const { data: payouts } = await supabase
    .from("creator_payouts")
    .select("amount_cents, status, created_at, order_items!order_item_id(product_id)")
    .eq("creator_id", creatorId);

  type OrderItemRef = { product_id: string } | null;
  type PayoutRow = {
    amount_cents: number;
    status: string;
    created_at: string;
    order_items: OrderItemRef | OrderItemRef[] | null;
  };
  const getOrderItem = (row: PayoutRow): OrderItemRef => {
    const oi = row.order_items;
    if (!oi) return null;
    return Array.isArray(oi) ? oi[0] ?? null : oi;
  };

  const productsWithSales = new Set<string>();
  let salesCountLifetime = 0;
  let salesCountMonth = 0;
  let totalRevenueCentsLifetime = 0;
  let totalRevenueCentsMonth = 0;

  for (const p of payouts ?? []) {
    const row = p as PayoutRow;
    if (row.status !== "paid" && row.status !== "pending") continue;
    const productId = getOrderItem(row)?.product_id;
    if (productId) productsWithSales.add(productId);
    salesCountLifetime += 1;
    totalRevenueCentsLifetime += row.amount_cents;
    if (row.created_at >= startOfMonth) {
      salesCountMonth += 1;
      totalRevenueCentsMonth += row.amount_cents;
    }
  }

  const productsWithSalesCount = productsWithSales.size;
  const productConversionPercent =
    catalogSize > 0 ? Math.round((productsWithSalesCount / catalogSize) * 10000) / 100 : null;
  const averageSalesPerProduct =
    productsWithSalesCount > 0 ? Math.round((salesCountLifetime / productsWithSalesCount) * 100) / 100 : null;
  const averageRevenuePerProductCents =
    productsWithSalesCount > 0 ? Math.round(totalRevenueCentsLifetime / productsWithSalesCount) : null;

  return {
    catalogSize,
    productsWithSalesCount,
    salesCountLifetime,
    salesCountMonth,
    totalRevenueCentsLifetime,
    totalRevenueCentsMonth,
    productConversionPercent,
    averageSalesPerProduct,
    averageRevenuePerProductCents,
  };
}

/** Subscription intelligence: share of revenue, per-order value, product conversion, concentration. */
export type SubscriptionIntelligenceMetrics = {
  subscriptionRevenueCentsLifetime: number;
  subscriptionRevenueCentsMonth: number;
  totalRevenueCentsLifetime: number;
  subscriptionOrderCountLifetime: number;
  subscriptionSalesCountLifetime: number;
  activeSubscriptionProductCount: number;
  subscriptionProductsWithSalesCount: number;
  /** Subscription revenue as % of total revenue. */
  subscriptionShareOfTotalRevenuePercent: number | null;
  /** Avg revenue per subscription order (lifetime). */
  averageRevenuePerSubscriptionOrderCents: number | null;
  /** % of subscription products that have at least one sale. */
  subscriptionProductConversionPercent: number | null;
  /** Revenue concentration: top subscription product share of subscription revenue. */
  topSubscriptionProductSharePercent: number | null;
  /** Avg subscription sales per product that has sold. */
  averageSubscriptionSalesPerProduct: number | null;
};

export async function getSubscriptionIntelligenceMetrics(creatorId: string): Promise<SubscriptionIntelligenceMetrics> {
  const empty: SubscriptionIntelligenceMetrics = {
    subscriptionRevenueCentsLifetime: 0,
    subscriptionRevenueCentsMonth: 0,
    totalRevenueCentsLifetime: 0,
    subscriptionOrderCountLifetime: 0,
    subscriptionSalesCountLifetime: 0,
    activeSubscriptionProductCount: 0,
    subscriptionProductsWithSalesCount: 0,
    subscriptionShareOfTotalRevenuePercent: null,
    averageRevenuePerSubscriptionOrderCents: null,
    subscriptionProductConversionPercent: null,
    topSubscriptionProductSharePercent: null,
    averageSubscriptionSalesPerProduct: null,
  };

  if (!supabase) return empty;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: subscriptionProducts } = await supabase
    .from("products")
    .select("id")
    .eq("creator_id", creatorId)
    .or("type.eq.membership,interval.not.is.null");
  const subscriptionProductIds = new Set((subscriptionProducts ?? []).map((p) => p.id));
  const activeSubscriptionProductCount = subscriptionProductIds.size;

  const { data: payouts } = await supabase
    .from("creator_payouts")
    .select("amount_cents, status, created_at, order_items!order_item_id(product_id, order_id)")
    .eq("creator_id", creatorId);

  type OrderItemRef = { product_id: string; order_id: string } | null;
  type PayoutRow = {
    amount_cents: number;
    status: string;
    created_at: string;
    order_items: OrderItemRef | OrderItemRef[] | null;
  };
  const getOrderItem = (row: PayoutRow): OrderItemRef => {
    const oi = row.order_items;
    if (!oi) return null;
    return Array.isArray(oi) ? oi[0] ?? null : oi;
  };

  let totalRevenueCentsLifetime = 0;
  let subscriptionRevenueCentsLifetime = 0;
  let subscriptionRevenueCentsMonth = 0;
  let subscriptionSalesCountLifetime = 0;
  const subscriptionOrderIds = new Set<string>();
  const subscriptionProductIdToCents: Record<string, number> = {};

  for (const p of payouts ?? []) {
    const row = p as PayoutRow;
    if (row.status !== "paid" && row.status !== "pending") continue;
    const amount = row.amount_cents;
    const orderItem = getOrderItem(row);
    const productId = orderItem?.product_id;

    totalRevenueCentsLifetime += amount;
    if (productId && subscriptionProductIds.has(productId)) {
      subscriptionRevenueCentsLifetime += amount;
      subscriptionSalesCountLifetime += 1;
      if (orderItem?.order_id) subscriptionOrderIds.add(orderItem.order_id);
      subscriptionProductIdToCents[productId] = (subscriptionProductIdToCents[productId] ?? 0) + amount;
      if (row.created_at >= startOfMonth) subscriptionRevenueCentsMonth += amount;
    }
  }

  const subscriptionOrderCountLifetime = subscriptionOrderIds.size;
  const subscriptionProductsWithSalesCount = Object.keys(subscriptionProductIdToCents).length;

  const subscriptionShareOfTotalRevenuePercent =
    totalRevenueCentsLifetime > 0
      ? Math.round((subscriptionRevenueCentsLifetime / totalRevenueCentsLifetime) * 10000) / 100
      : null;

  const averageRevenuePerSubscriptionOrderCents =
    subscriptionOrderCountLifetime > 0
      ? Math.round(subscriptionRevenueCentsLifetime / subscriptionOrderCountLifetime)
      : null;

  const subscriptionProductConversionPercent =
    activeSubscriptionProductCount > 0
      ? Math.round((subscriptionProductsWithSalesCount / activeSubscriptionProductCount) * 10000) / 100
      : null;

  const subscriptionProductTotals = Object.values(subscriptionProductIdToCents);
  const maxProductRevenue = subscriptionProductTotals.length > 0 ? Math.max(...subscriptionProductTotals) : 0;
  const topSubscriptionProductSharePercent =
    subscriptionRevenueCentsLifetime > 0 && maxProductRevenue > 0
      ? Math.round((maxProductRevenue / subscriptionRevenueCentsLifetime) * 10000) / 100
      : null;

  const averageSubscriptionSalesPerProduct =
    subscriptionProductsWithSalesCount > 0
      ? Math.round((subscriptionSalesCountLifetime / subscriptionProductsWithSalesCount) * 100) / 100
      : null;

  return {
    subscriptionRevenueCentsLifetime,
    subscriptionRevenueCentsMonth,
    totalRevenueCentsLifetime,
    subscriptionOrderCountLifetime,
    subscriptionSalesCountLifetime,
    activeSubscriptionProductCount,
    subscriptionProductsWithSalesCount,
    subscriptionShareOfTotalRevenuePercent,
    averageRevenuePerSubscriptionOrderCents,
    subscriptionProductConversionPercent,
    topSubscriptionProductSharePercent,
    averageSubscriptionSalesPerProduct,
  };
}

export async function getTrafficToRevenueMetrics(creatorId: string): Promise<TrafficToRevenueMetrics> {
  const empty: TrafficToRevenueMetrics = {
    totalFollowers: 0,
    totalRevenueCentsLifetime: 0,
    totalRevenueCentsMonth: 0,
    salesCountLifetime: 0,
    salesCountMonth: 0,
    revenuePerFollowerCentsLifetime: null,
    revenuePerFollowerCentsMonth: null,
    salesPerThousandFollowersLifetime: null,
    salesPerThousandFollowersMonth: null,
  };

  if (!supabase) return empty;

  const [profileRes, revenue] = await Promise.all([
    supabase.from("profiles").select("followers_count").eq("id", creatorId).single(),
    getRevenueOverview(creatorId),
  ]);

  const totalFollowers = profileRes?.data?.followers_count ?? 0;

  const totalRevenueCentsLifetime = revenue.totalCentsLifetime;
  const totalRevenueCentsMonth = revenue.totalCentsMonth;
  const salesCountLifetime = revenue.salesCountLifetime;
  const salesCountMonth = revenue.salesCountMonth;

  const revenuePerFollowerCentsLifetime =
    totalFollowers > 0 ? Math.round(totalRevenueCentsLifetime / totalFollowers) : null;
  const revenuePerFollowerCentsMonth =
    totalFollowers > 0 ? Math.round(totalRevenueCentsMonth / totalFollowers) : null;
  const salesPerThousandFollowersLifetime =
    totalFollowers > 0 ? Math.round((salesCountLifetime / totalFollowers) * 1000 * 100) / 100 : null;
  const salesPerThousandFollowersMonth =
    totalFollowers > 0 ? Math.round((salesCountMonth / totalFollowers) * 1000 * 100) / 100 : null;

  return {
    totalFollowers,
    totalRevenueCentsLifetime,
    totalRevenueCentsMonth,
    salesCountLifetime,
    salesCountMonth,
    revenuePerFollowerCentsLifetime,
    revenuePerFollowerCentsMonth,
    salesPerThousandFollowersLifetime,
    salesPerThousandFollowersMonth,
  };
}

/** Cash flow: paid vs pending, liquidity, failed. */
export type CashFlowDynamicsMetrics = {
  paidAmountCentsLifetime: number;
  paidAmountCentsMonth: number;
  pendingAmountCentsLifetime: number;
  paidCountLifetime: number;
  paidCountMonth: number;
  pendingCountLifetime: number;
  failedAmountCentsLifetime: number;
  failedCountLifetime: number;
  /** % of earned (paid + pending) that has been received (paid). */
  liquidityPercent: number | null;
  /** Pending as % of total earned (paid + pending). */
  pendingAsPercentOfEarned: number | null;
  /** Avg payout size for paid payouts. */
  averagePaidPayoutCents: number | null;
  /** Avg payout size for pending payouts. */
  averagePendingPayoutCents: number | null;
};

export async function getCashFlowDynamicsMetrics(creatorId: string): Promise<CashFlowDynamicsMetrics> {
  const empty: CashFlowDynamicsMetrics = {
    paidAmountCentsLifetime: 0,
    paidAmountCentsMonth: 0,
    pendingAmountCentsLifetime: 0,
    paidCountLifetime: 0,
    paidCountMonth: 0,
    pendingCountLifetime: 0,
    failedAmountCentsLifetime: 0,
    failedCountLifetime: 0,
    liquidityPercent: null,
    pendingAsPercentOfEarned: null,
    averagePaidPayoutCents: null,
    averagePendingPayoutCents: null,
  };

  if (!supabase) return empty;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: payouts } = await supabase
    .from("creator_payouts")
    .select("amount_cents, status, created_at")
    .eq("creator_id", creatorId);

  let paidAmountCentsLifetime = 0;
  let paidAmountCentsMonth = 0;
  let pendingAmountCentsLifetime = 0;
  let paidCountLifetime = 0;
  let paidCountMonth = 0;
  let pendingCountLifetime = 0;
  let failedAmountCentsLifetime = 0;
  let failedCountLifetime = 0;

  for (const p of payouts ?? []) {
    const amount = p.amount_cents;
    const inMonth = p.created_at >= startOfMonth;
    if (p.status === "paid") {
      paidAmountCentsLifetime += amount;
      paidCountLifetime += 1;
      if (inMonth) {
        paidAmountCentsMonth += amount;
        paidCountMonth += 1;
      }
    } else if (p.status === "pending") {
      pendingAmountCentsLifetime += amount;
      pendingCountLifetime += 1;
    } else if (p.status === "failed") {
      failedAmountCentsLifetime += amount;
      failedCountLifetime += 1;
    }
  }

  const totalEarnedCents = paidAmountCentsLifetime + pendingAmountCentsLifetime;
  const liquidityPercent =
    totalEarnedCents > 0 ? Math.round((paidAmountCentsLifetime / totalEarnedCents) * 10000) / 100 : null;
  const pendingAsPercentOfEarned =
    totalEarnedCents > 0 ? Math.round((pendingAmountCentsLifetime / totalEarnedCents) * 10000) / 100 : null;
  const averagePaidPayoutCents =
    paidCountLifetime > 0 ? Math.round(paidAmountCentsLifetime / paidCountLifetime) : null;
  const averagePendingPayoutCents =
    pendingCountLifetime > 0 ? Math.round(pendingAmountCentsLifetime / pendingCountLifetime) : null;

  return {
    paidAmountCentsLifetime,
    paidAmountCentsMonth,
    pendingAmountCentsLifetime,
    paidCountLifetime,
    paidCountMonth,
    pendingCountLifetime,
    failedAmountCentsLifetime,
    failedCountLifetime,
    liquidityPercent,
    pendingAsPercentOfEarned,
    averagePaidPayoutCents,
    averagePendingPayoutCents,
  };
}

/** Trend-based revenue forecast from recent payout history (no external AI). */
export type RevenueForecastMetrics = {
  /** Revenue in last 7 days (paid + pending). */
  revenueLast7DaysCents: number;
  /** Revenue in last 30 days. */
  revenueLast30DaysCents: number;
  /** Revenue this month to date. */
  revenueThisMonthCents: number;
  /** Days elapsed in current month. */
  daysElapsedInMonth: number;
  /** Avg daily revenue over last 7 days (cents per day). */
  averageDailyRateLast7DaysCents: number | null;
  /** Avg daily revenue over last 30 days. */
  averageDailyRateLast30DaysCents: number | null;
  /** Projected revenue next 7 days (avg daily 7d × 7). */
  projectedNext7DaysCents: number | null;
  /** Projected revenue next 30 days (avg daily 30d × 30). */
  projectedNext30DaysCents: number | null;
  /** Projected full month (this month's daily rate × days in month). */
  projectedThisMonthFullCents: number | null;
};

export async function getRevenueForecastMetrics(creatorId: string): Promise<RevenueForecastMetrics> {
  const empty: RevenueForecastMetrics = {
    revenueLast7DaysCents: 0,
    revenueLast30DaysCents: 0,
    revenueThisMonthCents: 0,
    daysElapsedInMonth: 0,
    averageDailyRateLast7DaysCents: null,
    averageDailyRateLast30DaysCents: null,
    projectedNext7DaysCents: null,
    projectedNext30DaysCents: null,
    projectedThisMonthFullCents: null,
  };

  if (!supabase) return empty;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsedInMonth = now.getDate();

  const { data: payouts } = await supabase
    .from("creator_payouts")
    .select("amount_cents, status, created_at")
    .eq("creator_id", creatorId);

  let revenueLast7DaysCents = 0;
  let revenueLast30DaysCents = 0;
  let revenueThisMonthCents = 0;

  for (const p of payouts ?? []) {
    if (p.status !== "paid" && p.status !== "pending") continue;
    const amount = p.amount_cents;
    const createdAt = p.created_at;
    if (createdAt >= sevenDaysAgo) revenueLast7DaysCents += amount;
    if (createdAt >= thirtyDaysAgo) revenueLast30DaysCents += amount;
    if (createdAt >= startOfMonth) revenueThisMonthCents += amount;
  }

  const averageDailyRateLast7DaysCents =
    7 > 0 && revenueLast7DaysCents >= 0 ? Math.round(revenueLast7DaysCents / 7) : null;
  const averageDailyRateLast30DaysCents =
    30 > 0 && revenueLast30DaysCents >= 0 ? Math.round(revenueLast30DaysCents / 30) : null;

  const projectedNext7DaysCents =
    averageDailyRateLast7DaysCents != null ? averageDailyRateLast7DaysCents * 7 : null;
  const projectedNext30DaysCents =
    averageDailyRateLast30DaysCents != null ? averageDailyRateLast30DaysCents * 30 : null;

  const dailyRateThisMonthCents =
    daysElapsedInMonth > 0 ? Math.round(revenueThisMonthCents / daysElapsedInMonth) : null;
  const projectedThisMonthFullCents =
    dailyRateThisMonthCents != null && daysInCurrentMonth > 0
      ? dailyRateThisMonthCents * daysInCurrentMonth
      : null;

  return {
    revenueLast7DaysCents,
    revenueLast30DaysCents,
    revenueThisMonthCents,
    daysElapsedInMonth,
    averageDailyRateLast7DaysCents,
    averageDailyRateLast30DaysCents,
    projectedNext7DaysCents,
    projectedNext30DaysCents,
    projectedThisMonthFullCents,
  };
}

/** Affiliate & referral: referral_events (click, signup, purchase) for this creator as referrer. */
export type AffiliateReferralMetrics = {
  affiliateCode: string | null;
  clicksLifetime: number;
  clicksMonth: number;
  signupsLifetime: number;
  signupsMonth: number;
  purchasesLifetime: number;
  purchasesMonth: number;
  uniqueSignupsLifetime: number;
  /** Signups / clicks × 100 when clicks > 0. */
  signupConversionPercent: number | null;
  /** Purchases / clicks × 100 when clicks > 0. */
  purchaseConversionPercent: number | null;
};

export async function getAffiliateReferralMetrics(creatorId: string): Promise<AffiliateReferralMetrics> {
  const empty: AffiliateReferralMetrics = {
    affiliateCode: null,
    clicksLifetime: 0,
    clicksMonth: 0,
    signupsLifetime: 0,
    signupsMonth: 0,
    purchasesLifetime: 0,
    purchasesMonth: 0,
    uniqueSignupsLifetime: 0,
    signupConversionPercent: null,
    purchaseConversionPercent: null,
  };

  if (!supabase) return empty;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [profileRes, { data: events }] = await Promise.all([
    supabase.from("profiles").select("affiliate_code").eq("id", creatorId).single(),
    supabase
      .from("referral_events")
      .select("event_type, referree_id, created_at")
      .eq("referrer_id", creatorId),
  ]);

  const affiliateCode = (profileRes?.data as { affiliate_code?: string | null } | null)?.affiliate_code ?? null;

  let clicksLifetime = 0;
  let clicksMonth = 0;
  let signupsLifetime = 0;
  let signupsMonth = 0;
  let purchasesLifetime = 0;
  let purchasesMonth = 0;
  const signupReferreeIds = new Set<string>();

  for (const e of events ?? []) {
    const inMonth = e.created_at >= startOfMonth;
    if (e.event_type === "click") {
      clicksLifetime += 1;
      if (inMonth) clicksMonth += 1;
    } else if (e.event_type === "signup") {
      signupsLifetime += 1;
      if (inMonth) signupsMonth += 1;
      if (e.referree_id) signupReferreeIds.add(e.referree_id);
    } else if (e.event_type === "purchase") {
      purchasesLifetime += 1;
      if (inMonth) purchasesMonth += 1;
    }
  }

  const uniqueSignupsLifetime = signupReferreeIds.size;
  const signupConversionPercent =
    clicksLifetime > 0 ? Math.round((signupsLifetime / clicksLifetime) * 10000) / 100 : null;
  const purchaseConversionPercent =
    clicksLifetime > 0 ? Math.round((purchasesLifetime / clicksLifetime) * 10000) / 100 : null;

  return {
    affiliateCode,
    clicksLifetime,
    clicksMonth,
    signupsLifetime,
    signupsMonth,
    purchasesLifetime,
    purchasesMonth,
    uniqueSignupsLifetime,
    signupConversionPercent,
    purchaseConversionPercent,
  };
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
