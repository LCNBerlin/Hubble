import { Controller, Get, UseGuards } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Get()
  getMyOrders(@CurrentUser() user: JwtUser) {
    return this.orders.getForBuyer(user.sub);
  }

  @Get("payouts")
  getMyPayouts(@CurrentUser() user: JwtUser) {
    return this.orders.getPayoutsForCreator(user.sub);
  }
}
