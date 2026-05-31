import { Controller, Get, Post, Delete, Param, UseGuards, HttpCode } from "@nestjs/common";
import { WishlistService } from "./wishlist.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("wishlist")
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private wishlist: WishlistService) {}

  @Get()
  getWishlist(@CurrentUser() user: JwtUser) {
    return this.wishlist.getWishlist(user.sub);
  }

  @Post(":productId")
  @HttpCode(204)
  add(@CurrentUser() user: JwtUser, @Param("productId") productId: string) {
    return this.wishlist.addToWishlist(user.sub, productId);
  }

  @Delete(":productId")
  @HttpCode(204)
  remove(@CurrentUser() user: JwtUser, @Param("productId") productId: string) {
    return this.wishlist.removeFromWishlist(user.sub, productId);
  }
}
