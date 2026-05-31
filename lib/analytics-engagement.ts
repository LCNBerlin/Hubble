import { apiGet } from "./api";

export type AudienceOverview = {
  totalFollowers: number;
  newFollowersLast7Days: number;
  newFollowersLast30Days: number;
  unfollowsLast7Days: number;
  unfollowsLast30Days: number;
  activeFollowersPercent: number | null;
  followerGrowthRate: number | null;
};

export type PostEngagement = {
  postId: string;
  title: string | null;
  likes: number;
  comments: number;
  reposts: number;
  saves: number;
  engagementRate: number;
  createdAt: string;
};

export type ContentPerformance = {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalReposts: number;
  totalSaves: number;
  topPosts: PostEngagement[];
};

export type SubscriberActivityMetrics = {
  likesFromFollowersLifetime: number;
  likesFromFollowersLast7Days: number;
  commentsFromFollowersLifetime: number;
  commentsFromFollowersLast7Days: number;
  repostsFromFollowersLifetime: number;
  repostsFromFollowersLast7Days: number;
  uniqueEngagersLifetime: number;
  subscriberEngagementSharePercent: number | null;
};

export type MessagingEngagementMetrics = {
  totalDmAccessGrants: number;
  newDmAccessGrantsLast7Days: number;
  newDmAccessGrantsLast30Days: number;
  totalDmAccessRevenueCents: number;
};

export type TimeBasedInsightsMetrics = {
  engagementLast24Hours: number;
  engagementLast7Days: number;
  engagementLast30Days: number;
  postsLast7Days: number;
  postsLast30Days: number;
  avgEngagementPerPostLast7Days: number | null;
  avgEngagementPerPostLast30Days: number | null;
  peakEngagementHour: number | null;
  peakEngagementDayOfWeek: number | null;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function getPeakDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? "—";
}

export type AudienceDepthMetrics = {
  totalFollowers: number;
  uniqueEngagers: number;
  engagementDepthPercent: number | null;
  totalEngagementFromFollowers: number;
  repeatEngagers: number;
  repeatEngagersPercent: number | null;
  avgEngagementsPerEngager: number | null;
  lurkersCount: number;
  lurkersPercent: number | null;
};

export type CohortRow = {
  label: string;
  size: number;
  engagedCount: number;
  engagementRatePercent: number | null;
};

export type CohortAnalysisMetrics = {
  cohorts: CohortRow[];
};

export type BehavioralTrackingMetrics = {
  likesFromFollowers: number;
  commentsFromFollowers: number;
  repostsFromFollowers: number;
  totalActions: number;
  likesSharePercent: number | null;
  commentsSharePercent: number | null;
  repostsSharePercent: number | null;
  dominantAction: "likes" | "comments" | "reposts" | null;
};

export type AttributionPost = {
  postId: string;
  title: string | null;
  likes: number;
  comments: number;
  reposts: number;
  totalEngagement: number;
};

export type ConversionAttributionMetrics = {
  totalEngagement: number;
  topPostsByEngagement: AttributionPost[];
  top5EngagementSharePercent: number | null;
  topPostByLikes: AttributionPost | null;
  topPostByComments: AttributionPost | null;
  topPostByReposts: AttributionPost | null;
};

export type ChurnRiskMetrics = {
  totalFollowers: number;
  atRiskCount: number;
  atRiskPercent: number | null;
  engagedLast30DaysCount: number;
  engagedLast30DaysPercent: number | null;
  newFollowersLast7Days: number;
};

export type CommunityHealthIndexMetrics = {
  healthIndex: number;
  engagementDepthScore: number;
  retentionScore: number;
  growthScore: number;
  activityScore: number;
};

export async function getAudienceOverview(creatorId: string): Promise<AudienceOverview> {
  return apiGet(`/analytics/engagement/${creatorId}/audience-overview`);
}

export async function getContentPerformance(creatorId: string): Promise<ContentPerformance> {
  return apiGet(`/analytics/engagement/${creatorId}/content-performance`);
}

export async function getSubscriberActivityMetrics(creatorId: string): Promise<SubscriberActivityMetrics> {
  return apiGet(`/analytics/engagement/${creatorId}/subscriber-activity`);
}

export async function getMessagingEngagementMetrics(creatorId: string): Promise<MessagingEngagementMetrics> {
  return apiGet(`/analytics/engagement/${creatorId}/messaging-engagement`);
}

export async function getTimeBasedInsightsMetrics(creatorId: string): Promise<TimeBasedInsightsMetrics> {
  return apiGet(`/analytics/engagement/${creatorId}/time-insights`);
}

export async function getAudienceDepthMetrics(creatorId: string): Promise<AudienceDepthMetrics> {
  return apiGet(`/analytics/engagement/${creatorId}/audience-depth`);
}

export async function getCohortAnalysisMetrics(creatorId: string): Promise<CohortAnalysisMetrics> {
  return apiGet(`/analytics/engagement/${creatorId}/cohort-analysis`);
}

export async function getBehavioralTrackingMetrics(creatorId: string): Promise<BehavioralTrackingMetrics> {
  return apiGet(`/analytics/engagement/${creatorId}/behavioral-tracking`);
}

export async function getConversionAttributionMetrics(creatorId: string): Promise<ConversionAttributionMetrics> {
  return apiGet(`/analytics/engagement/${creatorId}/conversion-attribution`);
}

export async function getChurnRiskMetrics(creatorId: string): Promise<ChurnRiskMetrics> {
  return apiGet(`/analytics/engagement/${creatorId}/churn-risk`);
}

export async function getCommunityHealthIndexMetrics(creatorId: string): Promise<CommunityHealthIndexMetrics> {
  return apiGet(`/analytics/engagement/${creatorId}/community-health`);
}
