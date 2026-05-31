import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { IncomeService } from "./income.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@Controller("analytics/income")
@UseGuards(JwtAuthGuard)
export class IncomeController {
  constructor(private svc: IncomeService) {}

  @Get(":creatorId/revenue-overview")
  revenueOverview(@Param("creatorId") id: string) { return this.svc.getRevenueOverview(id); }

  @Get(":creatorId/transaction-metrics")
  transactionMetrics(@Param("creatorId") id: string) { return this.svc.getTransactionMetrics(id); }

  @Get(":creatorId/unit-economics")
  unitEconomics(@Param("creatorId") id: string) { return this.svc.getUnitEconomics(id); }

  @Get(":creatorId/cash-flow")
  cashFlow(@Param("creatorId") id: string) { return this.svc.getCashFlowDynamics(id); }

  @Get(":creatorId/revenue-forecast")
  revenueForecast(@Param("creatorId") id: string) { return this.svc.getRevenueForecast(id); }

  @Get(":creatorId/affiliate-referral")
  affiliateReferral(@Param("creatorId") id: string) { return this.svc.getAffiliateReferral(id); }

  @Get(":creatorId/subscription-metrics")
  subscriptionMetrics(@Param("creatorId") id: string) { return this.svc.getSubscriptionMetrics(id); }

  @Get(":creatorId/revenue-quality")
  revenueQuality(@Param("creatorId") id: string) { return this.svc.getRevenueQuality(id); }

  @Get(":creatorId/funnel-monetization")
  funnelMonetization(@Param("creatorId") id: string) { return this.svc.getFunnelMonetization(id); }

  @Get(":creatorId/traffic-to-revenue")
  trafficToRevenue(@Param("creatorId") id: string) { return this.svc.getTrafficToRevenue(id); }
}
