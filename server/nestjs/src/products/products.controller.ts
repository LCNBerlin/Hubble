import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("products")
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get("search")
  search(@Query("q") q: string, @Query("limit") limit = "20") {
    return this.products.search(q, Number(limit));
  }

  @Get("by-creator/:creatorId")
  getByCreator(@Param("creatorId") creatorId: string) {
    return this.products.getByCreator(creatorId);
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.products.getById(id);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    return this.products.create(user.sub, body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    return this.products.update(id, user.sub, body);
  }

  @Delete(":id")
  @HttpCode(204)
  delete(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.products.delete(id, user.sub);
  }

  @Get(":id/reviews")
  getReviews(@Param("id") id: string) {
    return this.products.getReviews(id);
  }

  @Post(":id/reviews")
  addReview(@Param("id") id: string, @CurrentUser() user: JwtUser, @Body() body: { rating: number; body?: string }) {
    return this.products.addReview(id, user.sub, body.rating, body.body);
  }
}
