import { Controller, Post, Body, Param, UseGuards, HttpCode } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("payments")
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Public()
  @Post("validate-coupon")
  @HttpCode(200)
  validateCoupon(@Body() body: { code: string; subtotalCents: number }) {
    return this.payments.validateCoupon(body.code, body.subtotalCents);
  }

  @Post("create-intent")
  createIntent(@Body() body: { amount: number; currency: string; metadata?: Record<string, string>; couponCode?: string; subtotalCents?: number }) {
    return this.payments.createPaymentIntent(body.amount, body.currency, body.metadata || {}, body.couponCode, body.subtotalCents);
  }

  @Post("confirm-order")
  confirmOrder(@Body() body: { paymentIntentId: string; buyerId: string; cartItems: { productId: string; creatorId?: string; title: string; priceCents: number; quantity: number }[]; subtotalCents: number; discountCents?: number; totalCents?: number; couponCode?: string }) {
    return this.payments.confirmOrder(body.paymentIntentId, body.buyerId, body.cartItems, body.subtotalCents, body.discountCents, body.totalCents, body.couponCode);
  }

  @Post("orders/:id/confirm-delivery")
  confirmDelivery(@Param("id") orderId: string, @CurrentUser() user: JwtUser) {
    return this.payments.confirmDelivery(orderId, user.sub);
  }

  @Post("orders/:id/ship")
  shipOrder(@Param("id") orderId: string, @Body() body: { carrier?: string; trackingNumber?: string; trackingUrl?: string; status?: string }) {
    return this.payments.shipOrder(orderId, body.carrier, body.trackingNumber, body.trackingUrl, body.status);
  }

  @Post("abandoned-cart")
  abandonedCart(@CurrentUser() user: JwtUser, @Body() body: { cartSnapshot?: unknown[]; subtotalCents: number }) {
    return this.payments.trackAbandonedCart(user.sub, body.cartSnapshot || [], body.subtotalCents);
  }

  @Post("connect/onboard")
  connectOnboard(@CurrentUser() user: JwtUser, @Body() body: { returnUrl?: string; refreshUrl?: string }) {
    const returnUrl = body.returnUrl || process.env.CONNECT_RETURN_URL || "https://hubble.app/connect-return";
    const refreshUrl = body.refreshUrl || process.env.CONNECT_REFRESH_URL || "https://hubble.app/connect-refresh";
    return this.payments.connectOnboard(user.sub, returnUrl, refreshUrl);
  }
}
