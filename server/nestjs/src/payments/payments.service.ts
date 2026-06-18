import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import Stripe from "stripe";

const ESCROW_DAYS = 7;

@Injectable()
export class PaymentsService {
  private stripe: Stripe | null;

  constructor(private config: ConfigService, private db: DataSource) {
    const key = config.get<string>("STRIPE_SECRET_KEY");
    this.stripe = key ? new Stripe(key) : null;
  }

  private normalizeCode(code: unknown): string {
    return String(code || "").trim().toUpperCase();
  }

  async validateCoupon(code: string, subtotalCents: number) {
    const normalized = this.normalizeCode(code);
    if (!normalized) return { valid: false, discountCents: 0, message: "Invalid code" };
    const sub = Math.round(Number(subtotalCents)) || 0;
    const rows = await this.db.query(
      `SELECT * FROM promo_codes WHERE code = $1`,
      [normalized]
    );
    const row = rows[0];
    if (!row) return { valid: false, discountCents: 0, message: "Code not found" };
    const now = new Date();
    if (row.expires_at && new Date(row.expires_at) < now) return { valid: false, discountCents: 0, message: "Code expired" };
    if (row.max_uses != null && row.used_count >= row.max_uses) return { valid: false, discountCents: 0, message: "Code no longer available" };
    let discountCents = 0;
    if (row.discount_percent != null) {
      discountCents = Math.floor((sub * Math.min(100, Math.max(0, Number(row.discount_percent) || 0))) / 100);
    } else if (row.discount_cents != null) {
      discountCents = Math.min(Number(row.discount_cents) || 0, sub);
    }
    return { valid: true, discountCents, message: "OK", promoCodeId: row.id };
  }

  async createPaymentIntent(amount: number, currency: string, metadata: Record<string, string>, couponCode?: string, subtotalCents?: number) {
    if (!this.stripe) throw new BadRequestException("Payments not configured");
    let amountCents = Math.round(Number(amount));
    let discountCents = 0;
    if (couponCode && Number.isFinite(Number(subtotalCents))) {
      const sub = Math.round(Number(subtotalCents));
      const result = await this.validateCoupon(couponCode, sub);
      if (result.valid && result.discountCents > 0) {
        discountCents = result.discountCents;
        amountCents = Math.max(1, sub - discountCents);
      }
    }
    if (!Number.isFinite(amountCents) || amountCents < 1) throw new BadRequestException("Invalid amount");
    if (amountCents < 50 && discountCents === 0) throw new BadRequestException("Minimum amount is 50 cents");
    const validCurrencies = ["usd", "eur", "gbp", "jpy", "cad", "aud", "chf", "inr", "mxn", "brl"];
    const cur = String(currency || "usd").toLowerCase();
    if (!validCurrencies.includes(cur)) throw new BadRequestException("Unsupported currency");
    const pi = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: cur,
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: metadata.type || "tip",
        ...(metadata.postTitle && { postTitle: String(metadata.postTitle).slice(0, 500) }),
        ...(metadata.productId && { productId: String(metadata.productId) }),
        ...(metadata.productTitle && { productTitle: String(metadata.productTitle).slice(0, 500) }),
      },
    });
    return { clientSecret: pi.client_secret, paymentIntentId: pi.id, discountCents };
  }

  async confirmOrder(paymentIntentId: string, buyerId: string, cartItems: { productId: string; creatorId?: string; title: string; priceCents: number; quantity: number }[], subtotalCents: number, discountCents = 0, totalCents?: number, couponCode?: string) {
    if (!this.stripe) throw new BadRequestException("Payments not configured");
    const pi = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "succeeded") throw new BadRequestException(`Payment not succeeded: ${pi.status}`);
    const existing = await this.db.query(`SELECT id FROM orders WHERE stripe_payment_intent_id = $1`, [paymentIntentId]);
    if (existing[0]) return { orderId: existing[0].id };
    const sub = Math.round(Number(subtotalCents));
    const disc = Math.round(Number(discountCents));
    const total = Number.isFinite(Number(totalCents)) ? Math.round(Number(totalCents)) : Math.max(0, sub - disc);
    const escrowReleaseAt = new Date(Date.now() + ESCROW_DAYS * 86_400_000);
    let couponId: string | null = null;
    if (couponCode) {
      const result = await this.validateCoupon(couponCode, sub);
      if (result.valid && result.promoCodeId) couponId = result.promoCodeId;
    }
    const orderRows = await this.db.query(
      `INSERT INTO orders (buyer_id, status, subtotal_cents, discount_cents, total_cents, currency, stripe_payment_intent_id, escrow_release_at)
       VALUES ($1, 'escrow_held', $2, $3, $4, 'usd', $5, $6) RETURNING id`,
      [buyerId, sub, disc, total, paymentIntentId, escrowReleaseAt]
    );
    const orderId = orderRows[0].id;
    if (couponId) {
      await this.db.query(`UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1`, [couponId]);
    }
    await this.db.query(`DELETE FROM abandoned_carts WHERE user_id = $1`, [buyerId]);
    const rows = cartItems.map((item) => [
      orderId,
      String(item.productId),
      item.creatorId || null,
      item.title || "Untitled",
      Math.round(Number(item.priceCents) || 0),
      Math.max(1, Math.round(Number(item.quantity) || 1)),
      Math.round(Number(item.priceCents) || 0) * Math.max(1, Math.round(Number(item.quantity) || 1)),
    ]);
    for (const row of rows) {
      await this.db.query(
        `INSERT INTO order_items (order_id, product_id, creator_id, title, price_cents, quantity, line_total_cents) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        row
      );
    }
    this.processPayoutsForOrder(orderId).catch((e) => console.error("processPayouts error", e));
    return { orderId };
  }

  async confirmDelivery(orderId: string, buyerId: string) {
    const rows = await this.db.query(`SELECT id, buyer_id, status FROM orders WHERE id = $1`, [orderId]);
    if (!rows[0]) throw new NotFoundException("Order not found");
    if (rows[0].buyer_id !== buyerId) throw new ForbiddenException("Not authorized");
    if (rows[0].status !== "escrow_held") throw new BadRequestException(`Order not in escrow: ${rows[0].status}`);
    const now = new Date().toISOString();
    await this.db.query(`UPDATE orders SET status = 'released', released_at = $1, updated_at = $1 WHERE id = $2`, [now, orderId]);
    this.processPayoutsForOrder(orderId).catch((e) => console.error("processPayouts error", e));
    return { ok: true, orderId };
  }

  async shipOrder(orderId: string, sellerId: string, carrier?: string, trackingNumber?: string, _trackingUrl?: string, status = "in_transit") {
    const rows = await this.db.query(
      `SELECT o.id FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1 AND oi.creator_id = $2
       LIMIT 1`,
      [orderId, sellerId]
    );
    if (!rows[0]) throw new ForbiddenException("Not authorized to ship this order");
    const validStatuses = ["created", "in_transit", "out_for_delivery", "delivered"];
    const shipStatus = validStatuses.includes(status) ? status : "in_transit";
    await this.db.query(
      `INSERT INTO shipments (order_id, carrier, tracking_number, status) VALUES ($1, $2, $3, $4)`,
      [orderId, carrier || null, trackingNumber || null, shipStatus]
    );
    return { ok: true };
  }

  async trackAbandonedCart(userId: string, cartSnapshot: unknown[], _subtotalCents: number) {
    await this.db.query(`DELETE FROM abandoned_carts WHERE user_id = $1`, [userId]);
    await this.db.query(
      `INSERT INTO abandoned_carts (user_id, cart_snapshot) VALUES ($1, $2)`,
      [userId, JSON.stringify(cartSnapshot)]
    );
    return { ok: true };
  }

  async connectOnboard(userId: string, returnUrl: string, refreshUrl: string) {
    if (!this.stripe) throw new BadRequestException("Payments not configured");
    const rows = await this.db.query(`SELECT stripe_connect_account_id FROM profiles WHERE id = $1`, [userId]);
    if (!rows[0]) throw new NotFoundException("Profile not found");
    let accountId = rows[0].stripe_connect_account_id;
    if (!accountId) {
      const account = await this.stripe.accounts.create({ type: "express", country: "US" });
      accountId = account.id;
      await this.db.query(`UPDATE profiles SET stripe_connect_account_id = $1 WHERE id = $2`, [accountId, userId]);
    }
    const link = await this.stripe.accountLinks.create({ account: accountId, refresh_url: refreshUrl, return_url: returnUrl, type: "account_onboarding" });
    return { url: link.url };
  }

  private async processPayoutsForOrder(orderId: string) {
    if (!this.stripe) return;
    const items = await this.db.query(
      `SELECT id, creator_id, product_id, line_total_cents FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    for (const item of items) {
      if (!item.creator_id || item.line_total_cents < 1) continue;
      const splits = await this.db.query(
        `SELECT partner_id, split_percent FROM revenue_splits WHERE owner_id = $1 AND target_type = 'product' AND target_id = $2`,
        [item.creator_id, item.product_id]
      );
      const recipients: { creatorId: string; amountCents: number }[] = [];
      if (splits.length > 0) {
        let ownerCents = item.line_total_cents;
        for (const s of splits) {
          const cents = Math.floor((item.line_total_cents * (s.split_percent || 0)) / 100);
          if (cents > 0 && s.partner_id) { recipients.push({ creatorId: s.partner_id, amountCents: cents }); ownerCents -= cents; }
        }
        if (ownerCents > 0) recipients.push({ creatorId: item.creator_id, amountCents: ownerCents });
      } else {
        recipients.push({ creatorId: item.creator_id, amountCents: item.line_total_cents });
      }
      for (const r of recipients) {
        if (r.amountCents < 1) continue;
        const profile = await this.db.query(`SELECT stripe_connect_account_id FROM profiles WHERE id = $1`, [r.creatorId]);
        if (!profile[0]?.stripe_connect_account_id) {
          await this.db.query(
            `INSERT INTO creator_payouts (order_id, order_item_id, creator_id, amount_cents, fee_cents, status, instant) VALUES ($1, $2, $3, $4, 0, 'pending', false)`,
            [orderId, item.id, r.creatorId, r.amountCents]
          );
          continue;
        }
        try {
          const transfer = await this.stripe.transfers.create({ amount: r.amountCents, currency: "usd", destination: profile[0].stripe_connect_account_id });
          await this.db.query(
            `INSERT INTO creator_payouts (order_id, order_item_id, creator_id, amount_cents, fee_cents, stripe_transfer_id, status, instant) VALUES ($1, $2, $3, $4, 0, $5, 'paid', false)`,
            [orderId, item.id, r.creatorId, r.amountCents, transfer.id]
          );
        } catch (e) {
          console.error("transfer error", item.id, r.creatorId, e);
          await this.db.query(
            `INSERT INTO creator_payouts (order_id, order_item_id, creator_id, amount_cents, fee_cents, status, instant) VALUES ($1, $2, $3, $4, 0, 'failed', false)`,
            [orderId, item.id, r.creatorId, r.amountCents]
          );
        }
      }
    }
  }
}
