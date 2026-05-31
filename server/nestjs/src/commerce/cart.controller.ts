import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode } from "@nestjs/common";
import { CartService } from "./cart.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("cart")
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private cart: CartService) {}

  @Get()
  getCart(@CurrentUser() user: JwtUser) {
    return this.cart.getCart(user.sub);
  }

  @Post("items")
  upsertItem(@CurrentUser() user: JwtUser, @Body() body: { productId: string; quantity: number; selectedTierIndex?: number }) {
    return this.cart.upsertItem(user.sub, body.productId, body.quantity, body.selectedTierIndex);
  }

  @Patch("items/:productId")
  @HttpCode(204)
  updateItem(@CurrentUser() user: JwtUser, @Param("productId") productId: string, @Body() body: { quantity?: number; selectedTierIndex?: number }) {
    return this.cart.upsertItem(user.sub, productId, body.quantity ?? 1, body.selectedTierIndex ?? 0);
  }

  @Delete("items/:productId")
  @HttpCode(204)
  removeItem(@CurrentUser() user: JwtUser, @Param("productId") productId: string) {
    return this.cart.removeItem(user.sub, productId);
  }

  @Delete()
  @HttpCode(204)
  clearCart(@CurrentUser() user: JwtUser) {
    return this.cart.clearCart(user.sub);
  }
}
