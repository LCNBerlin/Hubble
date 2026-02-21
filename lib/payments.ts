import { API_URL } from "./config";

export type CreatePaymentIntentParams = {
  amountCents: number;
  currency: string;
  metadata?: {
    type: "tip" | "purchase";
    postTitle?: string;
    productId?: string;
    productTitle?: string;
    action?: string;
  };
  couponCode?: string | null;
  subtotalCents?: number;
};

export type CreatePaymentIntentResult =
  | { ok: true; clientSecret: string; paymentIntentId?: string; discountCents?: number }
  | { ok: false; error: string; code?: number };

export type ValidateCouponResult =
  | { ok: true; valid: true; discountCents: number }
  | { ok: true; valid: false; discountCents: 0; message: string }
  | { ok: false; error: string };

/**
 * Validate a promo code. Returns discountCents when valid.
 */
export async function validateCoupon(
  code: string,
  subtotalCents: number
): Promise<ValidateCouponResult> {
  try {
    const res = await fetch(`${API_URL}/validate-coupon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim(), subtotalCents }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.message || data.error || "Request failed" };
    }
    return {
      ok: true,
      valid: !!data.valid,
      discountCents: data.valid ? data.discountCents ?? 0 : 0,
      message: data.message ?? "",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: message };
  }
}

/**
 * Ask the backend to create a Stripe PaymentIntent. Returns clientSecret for use with Payment Sheet.
 */
export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<CreatePaymentIntentResult> {
  try {
    const res = await fetch(`${API_URL}/create-payment-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: params.amountCents,
        currency: params.currency.toLowerCase(),
        metadata: params.metadata ?? {},
        ...(params.couponCode != null && params.subtotalCents != null && {
          couponCode: params.couponCode,
          subtotalCents: params.subtotalCents,
        }),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data.message || data.error || `Request failed (${res.status})`,
        code: res.status,
      };
    }
    if (!data.clientSecret) {
      return { ok: false, error: "No client secret returned" };
    }
    return {
      ok: true,
      clientSecret: data.clientSecret,
      paymentIntentId: data.paymentIntentId,
      discountCents: data.discountCents,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: message };
  }
}

/** Parse product.price (e.g. "$10", "10.00") to cents. Returns 0 if invalid. */
export function parsePriceToCents(price: string | undefined): number {
  if (price == null || price === "") return 0;
  const cleaned = String(price).replace(/[$,]/g, "").trim();
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/** Cents for a product: uses product.price, or the given price tier (default 0) if no single price. */
export function getProductPriceCents(
  product: { price?: string; priceTiers?: Array<{ price?: string }> },
  selectedTierIndex?: number
): number {
  const fromPrice = parsePriceToCents(product.price);
  if (fromPrice > 0) return fromPrice;
  const tierIndex = selectedTierIndex ?? 0;
  const tier = product.priceTiers?.[tierIndex];
  return parsePriceToCents(tier?.price);
}

/** Format cents as display price (e.g. 1999 -> "$19.99"). */
export function formatCentsToPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export type ConfirmOrderParams = {
  paymentIntentId: string;
  buyerId: string;
  cartItems: Array<{
    productId: string;
    creatorId?: string | null;
    title?: string;
    priceCents: number;
    quantity: number;
  }>;
  subtotalCents: number;
  discountCents?: number;
  totalCents?: number;
  couponCode?: string | null;
};

export type ConfirmOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string; code?: number };

/**
 * Confirm order after successful payment. Server creates order + order_items.
 */
export async function confirmOrder(params: ConfirmOrderParams): Promise<ConfirmOrderResult> {
  try {
    const res = await fetch(`${API_URL}/confirm-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId: params.paymentIntentId,
        buyerId: params.buyerId,
        cartItems: params.cartItems,
        subtotalCents: params.subtotalCents,
        discountCents: params.discountCents ?? 0,
        totalCents: params.totalCents ?? params.subtotalCents - (params.discountCents ?? 0),
        couponCode: params.couponCode ?? null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data.message || data.error || `Request failed (${res.status})`,
        code: res.status,
      };
    }
    if (!data.orderId) {
      return { ok: false, error: "No orderId returned" };
    }
    return { ok: true, orderId: data.orderId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: message };
  }
}

export type ConfirmDeliveryResult =
  | { ok: true }
  | { ok: false; error: string; code?: number };

export type TrackAbandonedCartParams = {
  userId: string;
  cartSnapshot: Array<{ productId: string; quantity: number; title?: string; price?: string }>;
  subtotalCents: number;
};

/**
 * Track abandoned cart (throttle on client, e.g. once per 30 min).
 */
export async function trackAbandonedCart(
  params: TrackAbandonedCartParams
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/abandoned-cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: params.userId,
        cartSnapshot: params.cartSnapshot,
        subtotalCents: params.subtotalCents,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.message || data.error || "Failed" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/**
 * Get Stripe Connect onboarding URL for creator payouts. Open in browser.
 */
export async function getConnectOnboardUrl(userId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_URL}/connect/onboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.message || data.error || "Failed" };
    }
    if (!data.url) return { ok: false, error: "No URL returned" };
    return { ok: true, url: data.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/**
 * Buyer confirms delivery to release escrow. Server sets order status to released.
 */
export async function confirmDelivery(
  orderId: string,
  buyerId: string
): Promise<ConfirmDeliveryResult> {
  try {
    const res = await fetch(`${API_URL}/orders/${encodeURIComponent(orderId)}/confirm-delivery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data.message || data.error || `Request failed (${res.status})`,
        code: res.status,
      };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: message };
  }
}

/**
 * After a tip payment succeeds, create a tip_received notification for the creator.
 * Call from the client when the tipper has completed payment (e.g. after presentPaymentSheet succeeds).
 */
export async function createTipNotification(params: {
  recipientId: string;
  actorId?: string | null;
  targetType?: "post" | null;
  targetId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/notifications/tip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId: params.recipientId,
        actorId: params.actorId ?? null,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || "Failed" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/** Currencies that have no minor unit (e.g. JPY). Stripe expects amount in whole units. */
const CURRENCY_NO_MINOR = ["jpy"];

/** Convert a decimal amount to Stripe's smallest currency unit (cents or whole units). */
export function amountToSmallestUnit(amount: number, currency: string): number {
  const cur = currency.toLowerCase();
  if (CURRENCY_NO_MINOR.includes(cur)) return Math.round(amount);
  return Math.round(amount * 100);
}
