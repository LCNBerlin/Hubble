import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

import cors from "cors";
import express from "express";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const app = express();
const port = process.env.PORT || 4242;

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

if (!supabase) {
  console.warn(
    "[Hubble server] Supabase not configured: add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to server/.env (copy from server/.env.example). Webhooks and push notifications will return 503 until then."
  );
}

const ESCROW_DAYS = 7;
const CONNECT_RETURN_URL = process.env.CONNECT_RETURN_URL || "https://example.com/connect-return";
const CONNECT_REFRESH_URL = process.env.CONNECT_REFRESH_URL || "https://example.com/connect-refresh";

async function processPayoutsForOrder(orderId) {
  if (!stripe || !supabase) return;
  const { data: items } = await supabase
    .from("order_items")
    .select("id, creator_id, product_id, line_total_cents")
    .eq("order_id", orderId);
  if (!items || items.length === 0) return;
  for (const item of items) {
    if (!item.creator_id || item.line_total_cents < 1) continue;
    const ownerId = item.creator_id;
    const lineTotal = item.line_total_cents;

    const { data: splits } = await supabase
      .from("revenue_splits")
      .select("partner_id, split_percent")
      .eq("owner_id", ownerId)
      .eq("target_type", "product")
      .eq("target_id", item.product_id);

    const recipients = [];
    if (splits && splits.length > 0) {
      let ownerCents = lineTotal;
      for (const s of splits) {
        const partnerCents = Math.floor((lineTotal * (s.split_percent || 0)) / 100);
        if (partnerCents > 0 && s.partner_id) {
          recipients.push({ creator_id: s.partner_id, amount_cents: partnerCents });
          ownerCents -= partnerCents;
        }
      }
      if (ownerCents > 0) {
        recipients.push({ creator_id: ownerId, amount_cents: ownerCents });
      }
    } else {
      recipients.push({ creator_id: ownerId, amount_cents: lineTotal });
    }

    for (const r of recipients) {
      if (r.amount_cents < 1) continue;
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_connect_account_id")
        .eq("id", r.creator_id)
        .single();
      if (!profile?.stripe_connect_account_id) {
        await supabase.from("creator_payouts").insert({
          order_id: orderId,
          order_item_id: item.id,
          creator_id: r.creator_id,
          amount_cents: r.amount_cents,
          fee_cents: 0,
          status: "pending",
          instant: false,
        });
        continue;
      }
      try {
        const transfer = await stripe.transfers.create({
          amount: r.amount_cents,
          currency: "usd",
          destination: profile.stripe_connect_account_id,
        });
        await supabase.from("creator_payouts").insert({
          order_id: orderId,
          order_item_id: item.id,
          creator_id: r.creator_id,
          amount_cents: r.amount_cents,
          fee_cents: 0,
          stripe_transfer_id: transfer.id,
          status: "paid",
          instant: false,
        });
      } catch (e) {
        console.error("transfer error for order_item", item.id, "creator", r.creator_id, e);
        await supabase.from("creator_payouts").insert({
          order_id: orderId,
          order_item_id: item.id,
          creator_id: r.creator_id,
          amount_cents: r.amount_cents,
          fee_cents: 0,
          status: "failed",
          instant: false,
        });
      }
    }
  }
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

async function validateCoupon(code, subtotalCents) {
  if (!supabase) return { valid: false, discountCents: 0, message: "Server not configured" };
  const normalized = normalizeCode(code);
  if (!normalized) return { valid: false, discountCents: 0, message: "Invalid code" };
  const sub = Math.round(Number(subtotalCents)) || 0;
  const { data: row, error } = await supabase
    .from("promo_codes")
    .select("id, code, type, value, min_order_cents, max_uses, used_count, valid_from, valid_until")
    .eq("code", normalized)
    .maybeSingle();
  if (error || !row) return { valid: false, discountCents: 0, message: "Code not found" };
  const now = new Date();
  if (row.valid_from && new Date(row.valid_from) > now) {
    return { valid: false, discountCents: 0, message: "Code not yet valid" };
  }
  if (row.valid_until && new Date(row.valid_until) < now) {
    return { valid: false, discountCents: 0, message: "Code expired" };
  }
  if (row.max_uses != null && row.used_count >= row.max_uses) {
    return { valid: false, discountCents: 0, message: "Code no longer available" };
  }
  if (row.min_order_cents != null && sub < row.min_order_cents) {
    return { valid: false, discountCents: 0, message: `Minimum order $${(row.min_order_cents / 100).toFixed(2)}` };
  }
  let discountCents = 0;
  if (row.type === "percent") {
    const pct = Math.min(100, Math.max(0, Number(row.value) || 0));
    discountCents = Math.floor((sub * pct) / 100);
  } else {
    discountCents = Math.min(Number(row.value) || 0, sub);
  }
  return { valid: true, discountCents, message: "OK", promoCodeId: row.id };
}

app.use(cors({ origin: true }));
app.use(express.json());

// Health check
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "hubble-payments" });
});

/**
 * Validate a promo code. Body: { code, subtotalCents }. Returns { valid, discountCents, message }.
 */
app.post("/validate-coupon", async (req, res) => {
  try {
    const { code, subtotalCents } = req.body;
    const result = await validateCoupon(code, subtotalCents);
    res.status(200).json({
      valid: result.valid,
      discountCents: result.discountCents ?? 0,
      message: result.message ?? (result.valid ? "OK" : "Invalid code"),
    });
  } catch (e) {
    console.error("validate-coupon error", e);
    res.status(500).json({ valid: false, discountCents: 0, message: e.message || "Validation failed" });
  }
});

/**
 * Create a PaymentIntent for tips or one-off purchases.
 * Body: { amount: number (cents), currency: string, metadata?: {}, couponCode?, subtotalCents? }
 * If couponCode and subtotalCents provided, validates coupon and charges amount = max(1, subtotalCents - discountCents).
 */
app.post("/create-payment-intent", async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: "Payments not configured",
      message: "Set STRIPE_SECRET_KEY in server/.env",
    });
  }
  try {
    const { amount, currency, metadata = {}, couponCode, subtotalCents } = req.body;
    let amountCents = Math.round(Number(amount));
    let discountCents = 0;
    if (couponCode != null && couponCode !== "" && Number.isFinite(Number(subtotalCents))) {
      const sub = Math.round(Number(subtotalCents));
      const result = await validateCoupon(couponCode, sub);
      if (result.valid && result.discountCents > 0) {
        discountCents = result.discountCents;
        amountCents = Math.max(1, sub - discountCents);
      }
    }
    if (!Number.isFinite(amountCents) || amountCents < 1) {
      return res.status(400).json({ error: "Invalid amount (min 1 cent after discount)" });
    }
    if (amountCents < 50 && discountCents === 0) {
      return res.status(400).json({ error: "Invalid amount (min 50 cents)" });
    }
    const cur = String(currency || "usd").toLowerCase();
    const validCurrencies = ["usd", "eur", "gbp", "jpy", "cad", "aud", "chf", "inr", "mxn", "brl"];
    if (!validCurrencies.includes(cur)) {
      return res.status(400).json({ error: "Unsupported currency for Stripe" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: cur,
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: metadata.type || "tip",
        ...(metadata.postTitle && { postTitle: String(metadata.postTitle).slice(0, 500) }),
        ...(metadata.productId && { productId: String(metadata.productId) }),
        ...(metadata.productTitle && { productTitle: String(metadata.productTitle).slice(0, 500) }),
        ...(metadata.action && { action: String(metadata.action) }),
      },
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      discountCents,
    });
  } catch (e) {
    console.error("create-payment-intent error", e);
    res.status(500).json({
      error: e.message || "Failed to create payment intent",
    });
  }
});

/**
 * Confirm order after successful payment. Creates order + order_items in Supabase.
 * Body: { paymentIntentId, buyerId, cartItems: [{ productId, creatorId?, title, priceCents, quantity }], subtotalCents, discountCents?, totalCents?, couponCode? }
 */
app.post("/confirm-order", async (req, res) => {
  if (!stripe || !supabase) {
    return res.status(503).json({
      error: "Server not configured",
      message: "Stripe and Supabase must be configured",
    });
  }
  try {
    const { paymentIntentId, buyerId, cartItems = [], subtotalCents, discountCents = 0, totalCents, couponCode } = req.body;
    if (!paymentIntentId || !buyerId || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: "Missing paymentIntentId, buyerId, or cartItems" });
    }
    const sub = Math.round(Number(subtotalCents));
    const disc = Math.round(Number(discountCents));
    const total = Math.round(Number(totalCents));
    if (!Number.isFinite(sub) || sub < 0) {
      return res.status(400).json({ error: "Invalid subtotalCents" });
    }
    const finalTotal = Number.isFinite(total) && total >= 0 ? total : Math.max(0, sub - disc);

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "succeeded") {
      return res.status(400).json({ error: "Payment not succeeded", status: pi.status });
    }

    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();
    if (existing) {
      return res.status(200).json({ orderId: existing.id });
    }

    const now = new Date();
    const escrowReleaseAt = new Date(now.getTime() + ESCROW_DAYS * 24 * 60 * 60 * 1000);

    let couponId = null;
    if (couponCode && normalizeCode(couponCode)) {
      const couponResult = await validateCoupon(couponCode, sub);
      if (couponResult.valid && couponResult.promoCodeId) {
        couponId = couponResult.promoCodeId;
      }
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        buyer_id: buyerId,
        status: "escrow_held",
        subtotal_cents: sub,
        discount_cents: disc,
        total_cents: finalTotal,
        currency: "usd",
        stripe_payment_intent_id: paymentIntentId,
        coupon_id: couponId,
        escrow_release_at: escrowReleaseAt.toISOString(),
      })
      .select("id")
      .single();
    if (orderErr) {
      console.error("confirm-order insert order", orderErr);
      return res.status(500).json({ error: orderErr.message || "Failed to create order" });
    }

    if (couponId) {
      const { data: promoRow } = await supabase.from("promo_codes").select("used_count").eq("id", couponId).single();
      await supabase.from("promo_codes").update({ used_count: (promoRow?.used_count ?? 0) + 1 }).eq("id", couponId);
    }

    await supabase.from("abandoned_carts").delete().eq("user_id", buyerId);

    const rows = cartItems.map((item) => {
      const priceCents = Math.round(Number(item.priceCents) || 0);
      const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
      return {
        order_id: order.id,
        product_id: String(item.productId || ""),
        creator_id: item.creatorId || null,
        title: item.title || "Untitled",
        price_cents: priceCents,
        quantity: qty,
        line_total_cents: priceCents * qty,
      };
    });
    const { error: itemsErr } = await supabase.from("order_items").insert(rows);
    if (itemsErr) {
      console.error("confirm-order insert order_items", itemsErr);
      await supabase.from("orders").delete().eq("id", order.id);
      return res.status(500).json({ error: itemsErr.message || "Failed to create order items" });
    }

    res.status(200).json({ orderId: order.id });
  } catch (e) {
    console.error("confirm-order error", e);
    res.status(500).json({
      error: e.message || "Confirm order failed",
    });
  }
});

/**
 * Abandoned cart tracking. Body: { userId, cartSnapshot: [{ productId, quantity, title?, price? }], subtotalCents }.
 * Upserts one row per user. Throttle on client (e.g. once per 30 min).
 */
app.post("/abandoned-cart", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Server not configured" });
  }
  try {
    const { userId, cartSnapshot = [], subtotalCents } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }
    const snapshot = Array.isArray(cartSnapshot) ? cartSnapshot : [];
    const sub = Math.round(Number(subtotalCents)) || 0;
    const now = new Date().toISOString();
    const { error } = await supabase.from("abandoned_carts").upsert(
      {
        user_id: userId,
        cart_snapshot: snapshot,
        subtotal_cents: sub,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );
    if (error) {
      return res.status(500).json({ error: error.message || "Failed to save" });
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("abandoned-cart error", e);
    res.status(500).json({ error: e.message || "Failed" });
  }
});

/**
 * Insert tip_received notification (call after tip payment succeeds).
 * Body: { recipientId, actorId?, targetType?, targetId? } (targetType/targetId e.g. 'post', postId)
 */
app.post("/notifications/tip", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Server not configured" });
  }
  try {
    const { recipientId, actorId, targetType, targetId } = req.body;
    if (!recipientId) {
      return res.status(400).json({ error: "recipientId required" });
    }
    const { error } = await supabase.from("notifications").insert({
      recipient_id: recipientId,
      actor_id: actorId || null,
      type: "tip_received",
      target_type: targetType || null,
      target_id: targetId || null,
      target_user_id: recipientId,
    });
    if (error) {
      return res.status(500).json({ error: error.message || "Failed to create notification" });
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("notifications/tip error", e);
    res.status(500).json({ error: e.message || "Failed" });
  }
});

/**
 * Mark order as shipped (creates shipment; trigger notifies buyer).
 * Body: { carrier?, trackingNumber?, trackingUrl?, status? } (status: created|in_transit|out_for_delivery|delivered)
 */
app.post("/orders/:id/ship", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Server not configured" });
  }
  try {
    const orderId = req.params.id;
    const { carrier, trackingNumber, trackingUrl, status = "in_transit" } = req.body;
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .single();
    if (fetchErr || !order) {
      return res.status(404).json({ error: "Order not found" });
    }
    const validStatus = ["created", "in_transit", "out_for_delivery", "delivered"];
    const shipStatus = validStatus.includes(status) ? status : "in_transit";
    const { error: insertErr } = await supabase.from("shipments").insert({
      order_id: orderId,
      carrier: carrier || null,
      tracking_number: trackingNumber || null,
      tracking_url: trackingUrl || null,
      status: shipStatus,
      updated_at: new Date().toISOString(),
    });
    if (insertErr) {
      return res.status(500).json({ error: insertErr.message || "Failed to create shipment" });
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("orders/ship error", e);
    res.status(500).json({ error: e.message || "Failed" });
  }
});

/**
 * Cron: cart abandonment reminders. Call periodically (e.g. every 15 min).
 * Selects abandoned_carts updated 1h–24h ago without reminder_sent_at; inserts cart_reminder notification; sets reminder_sent_at.
 * Optionally inserts abandoned_cart_creator for each distinct creator in cart_snapshot (throttled one per creator per day).
 */
app.post("/cron/cart-reminders", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Server not configured" });
  }
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: carts, error: fetchErr } = await supabase
      .from("abandoned_carts")
      .select("id, user_id, cart_snapshot, updated_at")
      .gte("updated_at", twentyFourHoursAgo)
      .lte("updated_at", oneHourAgo)
      .is("reminder_sent_at", null);
    if (fetchErr) {
      return res.status(500).json({ error: fetchErr.message || "Failed to fetch carts" });
    }
    if (!carts || carts.length === 0) {
      return res.status(200).json({ ok: true, processed: 0 });
    }
    for (const cart of carts) {
      if (!cart.user_id) continue;
      await supabase.from("notifications").insert({
        recipient_id: cart.user_id,
        actor_id: null,
        type: "cart_reminder",
        target_type: "cart",
        target_id: null,
        target_user_id: null,
        metadata: { abandoned_cart_id: cart.id },
      });
      await supabase.from("abandoned_carts").update({ reminder_sent_at: now.toISOString() }).eq("id", cart.id);
      const snapshot = Array.isArray(cart.cart_snapshot) ? cart.cart_snapshot : [];
      const productIds = [...new Set(snapshot.map((i) => i.productId || i.product_id).filter(Boolean))];
      if (productIds.length > 0) {
        const { data: products } = await supabase.from("products").select("id, creator_id").in("id", productIds);
        const creatorIds = [...new Set((products || []).map((p) => p.creator_id).filter(Boolean))];
        for (const creatorId of creatorIds) {
          await supabase.from("notifications").insert({
            recipient_id: creatorId,
            actor_id: null,
            type: "abandoned_cart_creator",
            target_type: "cart",
            target_id: cart.id,
            target_user_id: creatorId,
            metadata: { product_ids: productIds },
          });
        }
      }
    }
    res.status(200).json({ ok: true, processed: carts.length });
  } catch (e) {
    console.error("cron/cart-reminders error", e);
    res.status(500).json({ error: e.message || "Failed" });
  }
});

/**
 * Cron: appointment reminders. Inserts appointment_reminder for appointments in the next 24h that haven't had a reminder sent.
 */
app.post("/cron/appointment-reminders", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Server not configured" });
  }
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const { data: appointments, error: fetchErr } = await supabase
      .from("appointments")
      .select("id, user_id, creator_id, scheduled_at")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", in24h)
      .is("reminder_notification_sent_at", null)
      .in("status", ["pending", "confirmed"]);
    if (fetchErr) {
      return res.status(500).json({ error: fetchErr.message || "Failed to fetch appointments" });
    }
    if (!appointments || appointments.length === 0) {
      return res.status(200).json({ ok: true, processed: 0 });
    }
    for (const apt of appointments) {
      await supabase.from("notifications").insert({
        recipient_id: apt.user_id,
        actor_id: apt.creator_id,
        type: "appointment_reminder",
        target_type: "appointment",
        target_id: apt.id,
        target_user_id: apt.user_id,
        metadata: { scheduled_at: apt.scheduled_at },
      });
      await supabase.from("appointments").update({ reminder_notification_sent_at: now.toISOString() }).eq("id", apt.id);
    }
    res.status(200).json({ ok: true, processed: appointments.length });
  } catch (e) {
    console.error("cron/appointment-reminders error", e);
    res.status(500).json({ error: e.message || "Failed" });
  }
});

/**
 * Buyer confirms delivery / release funds. Body: { buyerId }. Order must be escrow_held.
 */
app.post("/orders/:id/confirm-delivery", async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: "Server not configured" });
  }
  try {
    const orderId = req.params.id;
    const { buyerId } = req.body;
    if (!orderId || !buyerId) {
      return res.status(400).json({ error: "Missing order id or buyerId" });
    }
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("id, buyer_id, status")
      .eq("id", orderId)
      .single();
    if (fetchErr || !order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.buyer_id !== buyerId) {
      return res.status(403).json({ error: "Not authorized to confirm this order" });
    }
    if (order.status !== "escrow_held") {
      return res.status(400).json({ error: "Order is not in escrow", status: order.status });
    }
    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("orders")
      .update({ status: "released", released_at: now, updated_at: now })
      .eq("id", orderId);
    if (updateErr) {
      return res.status(500).json({ error: updateErr.message || "Failed to release" });
    }
    processPayoutsForOrder(orderId).catch((e) => console.error("processPayoutsForOrder", e));
    res.status(200).json({ ok: true, orderId });
  } catch (e) {
    console.error("confirm-delivery error", e);
    res.status(500).json({ error: e.message || "Confirm delivery failed" });
  }
});

/**
 * Database webhook: when a row is inserted into notifications, send Expo push to the recipient's devices.
 * Configure in Supabase: Database → Webhooks → Create hook on table "notifications", event INSERT, URL = POST https://your-server/webhooks/notification-created
 * Payload: { type: 'INSERT', table: 'notifications', schema: 'public', record: { id, recipient_id, type, ... }, old_record: null }
 */
function getPushMessage(notificationType) {
  const messages = {
    like: { title: "New like", body: "Someone liked your post" },
    comment: { title: "New comment", body: "Someone commented on your post" },
    comment_reply: { title: "Reply to your comment", body: "Someone replied to your comment" },
    comment_like: { title: "Comment liked", body: "Someone liked your comment" },
    follow: { title: "New follower", body: "Someone followed you" },
    repost: { title: "Repost", body: "Someone reposted your post" },
    save_post: { title: "Post saved", body: "Someone saved your post" },
    mention: { title: "You were mentioned", body: "Someone mentioned you" },
    product_sale: { title: "New sale", body: "You have a new sale" },
    product_review: { title: "New review", body: "Someone left a review on your product" },
    order_shipped: { title: "Order shipped", body: "Your order has shipped" },
    tracking_updated: { title: "Tracking updated", body: "Your order tracking was updated" },
    delivery_confirmed: { title: "Delivery confirmed", body: "A buyer confirmed delivery" },
    order_refunded: { title: "Order refunded", body: "Your order was refunded" },
    order_disputed: { title: "Order disputed", body: "Your order was disputed" },
    tip_received: { title: "Tip received", body: "You received a tip" },
    cart_reminder: { title: "Cart reminder", body: "You left items in your cart" },
    abandoned_cart_creator: { title: "Cart activity", body: "Someone had your product in their cart" },
    booking: { title: "New booking", body: "Someone booked an appointment" },
    appointment_reminder: { title: "Appointment reminder", body: "You have an upcoming appointment" },
  };
  return messages[notificationType] || { title: "Hubble", body: "You have a new notification" };
}

app.post("/webhooks/notification-created", async (req, res) => {
  try {
    const { type, table, record } = req.body || {};
    if (type !== "INSERT" || table !== "notifications" || !record?.recipient_id) {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }
    const recipientId = record.recipient_id;
    const notificationType = record.type || "like";
    const notificationId = record.id;
    const { title, body } = getPushMessage(notificationType);

    if (!supabase) {
      return res.status(503).json({
        error: "Server not configured",
        message: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env (see server/.env.example)",
      });
    }

    const { data: tokens, error: tokensErr } = await supabase
      .from("push_tokens")
      .select("expo_push_token")
      .eq("user_id", recipientId);
    if (tokensErr) {
      console.warn("[push] push_tokens lookup error for", recipientId, tokensErr.message);
      return res.status(200).json({ ok: true, sent: 0 });
    }
    if (!tokens?.length) {
      console.warn("[push] No push tokens for recipient", recipientId, "- app may not have registered (permission, or run on physical device)");
      return res.status(200).json({ ok: true, sent: 0 });
    }

    const messages = tokens.map(({ expo_push_token }) => ({
      to: expo_push_token,
      title,
      body,
      data: { notificationId, type: notificationType },
      sound: "default",
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[push] Expo API error", response.status, result);
      return res.status(500).json({ error: "Push send failed" });
    }
    const results = Array.isArray(result.data) ? result.data : [];
    const sent = results.filter((r) => r.status === "ok").length;
    const errors = results.filter((r) => r.status === "error").map((r) => r.message);
    if (errors.length) console.warn("[push] Expo delivery issues:", errors);
    console.log("[push] recipient", recipientId, "tokens:", tokens.length, "sent:", sent);
    return res.status(200).json({ ok: true, sent });
  } catch (e) {
    console.error("webhooks/notification-created error", e);
    return res.status(500).json({ error: e.message || "Failed" });
  }
});

/**
 * Stripe Connect onboarding. Body: { userId }. Returns { url } to open in browser.
 * Creates Express account if needed and stores stripe_connect_account_id in profiles.
 */
app.post("/connect/onboard", async (req, res) => {
  if (!stripe || !supabase) {
    return res.status(503).json({ error: "Server not configured" });
  }
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("id", userId)
      .single();
    if (profileErr || !profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    let accountId = profile.stripe_connect_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
      });
      accountId = account.id;
      await supabase.from("profiles").update({ stripe_connect_account_id: accountId }).eq("id", userId);
    }
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: CONNECT_REFRESH_URL,
      return_url: CONNECT_RETURN_URL,
      type: "account_onboarding",
    });
    res.status(200).json({ url: accountLink.url });
  } catch (e) {
    console.error("connect/onboard error", e);
    res.status(500).json({ error: e.message || "Onboarding failed" });
  }
});

app.listen(port, () => {
  console.log(`Hubble payments server running at http://localhost:${port}`);
  if (!stripe) console.warn("STRIPE_SECRET_KEY not set – payment endpoints will return 503.");
  if (!supabase) console.warn("SUPABASE_* not set – confirm-order will return 503.");
});
