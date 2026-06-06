import { Controller, Get, Param, UseGuards, ForbiddenException } from "@nestjs/common";
import { IncomeService } from "./income.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("analytics/income")
@UseGuards(JwtAuthGuard)
export class IncomeController {
  constructor(private svc: IncomeService) {}

  private guard(user: JwtUser, creatorId: string) {
    if (user.sub !== creatorId) throw new ForbiddenException("Access denied");
  }

  @Get(":creatorId/revenue-overview")
  revenueOverview(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getRevenueOverview(id); }

  @Get(":creatorId/transaction-metrics")
  transactionMetrics(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getTransactionMetrics(id); }

  @Get(":creatorId/unit-economics")
  unitEconomics(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getUnitEconomics(id); }

  @Get(":creatorId/cash-flow")
  cashFlow(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getCashFlowDynamics(id); }

  @Get(":creatorId/revenue-forecast")
  revenueForecast(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getRevenueForecast(id); }

  @Get(":creatorId/affiliate-referral")
  affiliateReferral(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getAffiliateReferral(id); }

  @Get(":creatorId/subscription-metrics")
  subscriptionMetrics(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getSubscriptionMetrics(id); }

  @Get(":creatorId/revenue-quality")
  revenueQuality(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getRevenueQuality(id); }

  @Get(":creatorId/funnel-monetization")
  funnelMonetization(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getFunnelMonetization(id); }

  @Get(":creatorId/traffic-to-revenue")
  trafficToRevenue(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getTrafficToRevenue(id); }
}
