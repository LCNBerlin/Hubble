import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { EngagementService } from "./engagement.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@Controller("analytics/engagement")
@UseGuards(JwtAuthGuard)
export class EngagementController {
  constructor(private svc: EngagementService) {}

  @Get(":creatorId/audience-overview")
  audienceOverview(@Param("creatorId") id: string) { return this.svc.getAudienceOverview(id); }

  @Get(":creatorId/content-performance")
  contentPerformance(@Param("creatorId") id: string) { return this.svc.getContentPerformance(id); }

  @Get(":creatorId/time-insights")
  timeInsights(@Param("creatorId") id: string) { return this.svc.getTimeBasedInsights(id); }

  @Get(":creatorId/audience-depth")
  audienceDepth(@Param("creatorId") id: string) { return this.svc.getAudienceDepth(id); }

  @Get(":creatorId/community-health")
  communityHealth(@Param("creatorId") id: string) { return this.svc.getCommunityHealthIndex(id); }

  @Get(":creatorId/churn-risk")
  churnRisk(@Param("creatorId") id: string) { return this.svc.getChurnRisk(id); }

  @Get(":creatorId/cohort-analysis")
  cohortAnalysis(@Param("creatorId") id: string) { return this.svc.getCohortAnalysis(id); }

  @Get(":creatorId/behavioral-tracking")
  behavioralTracking(@Param("creatorId") id: string) { return this.svc.getBehavioralTracking(id); }

  @Get(":creatorId/conversion-attribution")
  conversionAttribution(@Param("creatorId") id: string) { return this.svc.getConversionAttribution(id); }

  @Get(":creatorId/subscriber-activity")
  subscriberActivity(@Param("creatorId") id: string) { return this.svc.getSubscriberActivity(id); }

  @Get(":creatorId/messaging-engagement")
  messagingEngagement(@Param("creatorId") id: string) { return this.svc.getMessagingEngagement(id); }
}
