import { Controller, Get, Param, UseGuards, ForbiddenException } from "@nestjs/common";
import { EngagementService } from "./engagement.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("analytics/engagement")
@UseGuards(JwtAuthGuard)
export class EngagementController {
  constructor(private svc: EngagementService) {}

  private guard(user: JwtUser, creatorId: string) {
    if (user.sub !== creatorId) throw new ForbiddenException("Access denied");
  }

  @Get(":creatorId/audience-overview")
  audienceOverview(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getAudienceOverview(id); }

  @Get(":creatorId/content-performance")
  contentPerformance(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getContentPerformance(id); }

  @Get(":creatorId/time-insights")
  timeInsights(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getTimeBasedInsights(id); }

  @Get(":creatorId/audience-depth")
  audienceDepth(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getAudienceDepth(id); }

  @Get(":creatorId/community-health")
  communityHealth(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getCommunityHealthIndex(id); }

  @Get(":creatorId/churn-risk")
  churnRisk(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getChurnRisk(id); }

  @Get(":creatorId/cohort-analysis")
  cohortAnalysis(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getCohortAnalysis(id); }

  @Get(":creatorId/behavioral-tracking")
  behavioralTracking(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getBehavioralTracking(id); }

  @Get(":creatorId/conversion-attribution")
  conversionAttribution(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getConversionAttribution(id); }

  @Get(":creatorId/subscriber-activity")
  subscriberActivity(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getSubscriberActivity(id); }

  @Get(":creatorId/messaging-engagement")
  messagingEngagement(@CurrentUser() user: JwtUser, @Param("creatorId") id: string) { this.guard(user, id); return this.svc.getMessagingEngagement(id); }
}
