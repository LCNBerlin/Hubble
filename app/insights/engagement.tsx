import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import {
  getAudienceDepthMetrics,
  getAudienceOverview,
  getBehavioralTrackingMetrics,
  getChurnRiskMetrics,
  getCommunityHealthIndexMetrics,
  getCohortAnalysisMetrics,
  getContentPerformance,
  getConversionAttributionMetrics,
  getMessagingEngagementMetrics,
  getPeakDayName,
  getSubscriberActivityMetrics,
  getTimeBasedInsightsMetrics,
  type AudienceOverview,
  type ContentPerformance,
} from "../../lib/analytics-engagement";
import { useAuth } from "../../context/AuthContext";
import {
  RecommendedActions,
  SectionHeader,
  StatRow,
  WidgetCard,
} from "../../components/analytics";

export default function EngagementScreen() {
  const { user } = useAuth();
  const [audience, setAudience] = useState<AudienceOverview | null>(null);
  const [content, setContent] = useState<ContentPerformance | null>(null);
  const [subscriberActivity, setSubscriberActivity] = useState<Awaited<ReturnType<typeof getSubscriberActivityMetrics>> | null>(null);
  const [messagingEngagement, setMessagingEngagement] = useState<Awaited<ReturnType<typeof getMessagingEngagementMetrics>> | null>(null);
  const [timeBasedInsights, setTimeBasedInsights] = useState<Awaited<ReturnType<typeof getTimeBasedInsightsMetrics>> | null>(null);
  const [audienceDepth, setAudienceDepth] = useState<Awaited<ReturnType<typeof getAudienceDepthMetrics>> | null>(null);
  const [cohortAnalysis, setCohortAnalysis] = useState<Awaited<ReturnType<typeof getCohortAnalysisMetrics>> | null>(null);
  const [behavioralTracking, setBehavioralTracking] = useState<Awaited<ReturnType<typeof getBehavioralTrackingMetrics>> | null>(null);
  const [conversionAttribution, setConversionAttribution] = useState<Awaited<ReturnType<typeof getConversionAttributionMetrics>> | null>(null);
  const [churnRisk, setChurnRisk] = useState<Awaited<ReturnType<typeof getChurnRiskMetrics>> | null>(null);
  const [communityHealth, setCommunityHealth] = useState<Awaited<ReturnType<typeof getCommunityHealthIndexMetrics>> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [a, c, sa, me, tb, ad, co, bt, ca, ch, cm] = await Promise.all([
        getAudienceOverview(user.id),
        getContentPerformance(user.id),
        getSubscriberActivityMetrics(user.id),
        getMessagingEngagementMetrics(user.id),
        getTimeBasedInsightsMetrics(user.id),
        getAudienceDepthMetrics(user.id),
        getCohortAnalysisMetrics(user.id),
        getBehavioralTrackingMetrics(user.id),
        getConversionAttributionMetrics(user.id),
        getChurnRiskMetrics(user.id),
        getCommunityHealthIndexMetrics(user.id),
      ]);
      setAudience(a);
      setContent(c);
      setSubscriberActivity(sa);
      setMessagingEngagement(me);
      setTimeBasedInsights(tb);
      setAudienceDepth(ad);
      setCohortAnalysis(co);
      setBehavioralTracking(bt);
      setConversionAttribution(ca);
      setChurnRisk(ch);
      setCommunityHealth(cm);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const tips: string[] = [];
  if (content?.topPosts?.[0]?.title) {
    tips.push(`Your top post recently: "${(content.topPosts[0].title || "Untitled").slice(0, 40)}..."`);
  }
  if (audience && audience.newFollowersLast7Days > 0) {
    tips.push(`You gained ${audience.newFollowersLast7Days} follower(s) this week. Keep posting.`);
  }
  if (content && content.totalPosts > 0 && content.totalLikes === 0) {
    tips.push("Try posting at different times to see when your audience is most active.");
  }
  if (tips.length === 0 && !loading) {
    tips.push("Create more posts and engage with your audience to see insights here.");
  }

  return (
    <ScrollView
      className="flex-1 bg-zinc-950"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <RecommendedActions tips={tips} />

      <SectionHeader title="Basic" subtitle="Fast insight, surface-level performance" />

      <WidgetCard title="Audience Overview" loading={loading}>
        {audience && (
          <>
            <StatRow label="Total followers" value={audience.totalFollowers} />
            <StatRow label="New followers (7 days)" value={audience.newFollowersLast7Days} />
            <StatRow label="New followers (30 days)" value={audience.newFollowersLast30Days} />
            <StatRow label="Active followers %" value={audience.activeFollowersPercent != null ? `${audience.activeFollowersPercent.toFixed(1)}%` : "—"} />
            <StatRow label="Follower growth rate" value={audience.followerGrowthRate != null ? `${audience.followerGrowthRate.toFixed(1)}%` : "—"} />
          </>
        )}
      </WidgetCard>

      <WidgetCard title="Content Performance" loading={loading}>
        {content && (
          <>
            <StatRow label="Post views" value="Coming soon" />
            <StatRow label="Total likes" value={content.totalLikes} />
            <StatRow label="Total comments" value={content.totalComments} />
            <StatRow label="Shares (reposts)" value={content.totalReposts} />
            <StatRow label="Saves" value={content.totalSaves} />
            <StatRow label="Posts" value={content.totalPosts} />
            {content.topPosts.length > 0 && (
              <>
                <Text className="mt-2 text-xs font-medium text-zinc-500">Top 5 by engagement</Text>
                {content.topPosts.map((p, i) => (
                  <StatRow
                    key={p.postId}
                    label={`#${i + 1} ${(p.title || "Untitled").slice(0, 25)}...`}
                    value={`${p.likes + p.comments + p.reposts + p.saves} eng`}
                  />
                ))}
              </>
            )}
          </>
        )}
      </WidgetCard>

      <WidgetCard title="Subscriber Activity" loading={loading}>
        {subscriberActivity && (
          <>
            <StatRow label="Likes from followers (lifetime)" value={subscriberActivity.likesFromFollowersLifetime} />
            <StatRow label="Likes from followers (7 days)" value={subscriberActivity.likesFromFollowersLast7Days} />
            <StatRow label="Comments from followers (lifetime)" value={subscriberActivity.commentsFromFollowersLifetime} />
            <StatRow label="Comments from followers (7 days)" value={subscriberActivity.commentsFromFollowersLast7Days} />
            <StatRow label="Reposts from followers (lifetime)" value={subscriberActivity.repostsFromFollowersLifetime} />
            <StatRow label="Reposts from followers (7 days)" value={subscriberActivity.repostsFromFollowersLast7Days} />
            <StatRow label="Unique engagers (followers)" value={subscriberActivity.uniqueEngagersLifetime} />
            <StatRow
              label="Subscriber share of engagement"
              value={subscriberActivity.subscriberEngagementSharePercent != null ? `${subscriberActivity.subscriberEngagementSharePercent}%` : "—"}
            />
          </>
        )}
      </WidgetCard>
      <WidgetCard title="Messaging Engagement" loading={loading}>
        {messagingEngagement && (
          <>
            <StatRow label="DM access grants (total)" value={messagingEngagement.totalDmAccessGrants} />
            <StatRow label="New DM access (7 days)" value={messagingEngagement.newDmAccessGrantsLast7Days} />
            <StatRow label="New DM access (30 days)" value={messagingEngagement.newDmAccessGrantsLast30Days} />
            <StatRow
              label="DM access revenue"
              value={`$${(messagingEngagement.totalDmAccessRevenueCents / 100).toFixed(2)}`}
            />
          </>
        )}
      </WidgetCard>
      <WidgetCard title="Time-Based Insights" loading={loading}>
        {timeBasedInsights && (
          <>
            <StatRow label="Engagement (24 hours)" value={timeBasedInsights.engagementLast24Hours} />
            <StatRow label="Engagement (7 days)" value={timeBasedInsights.engagementLast7Days} />
            <StatRow label="Engagement (30 days)" value={timeBasedInsights.engagementLast30Days} />
            <StatRow label="Posts (7 days)" value={timeBasedInsights.postsLast7Days} />
            <StatRow label="Posts (30 days)" value={timeBasedInsights.postsLast30Days} />
            <StatRow
              label="Avg engagement/post (7 days)"
              value={timeBasedInsights.avgEngagementPerPostLast7Days ?? "—"}
            />
            <StatRow
              label="Avg engagement/post (30 days)"
              value={timeBasedInsights.avgEngagementPerPostLast30Days ?? "—"}
            />
            <StatRow
              label="Peak engagement hour (UTC)"
              value={timeBasedInsights.peakEngagementHour != null ? `${timeBasedInsights.peakEngagementHour}:00` : "—"}
            />
            <StatRow
              label="Peak engagement day"
              value={timeBasedInsights.peakEngagementDayOfWeek != null ? getPeakDayName(timeBasedInsights.peakEngagementDayOfWeek) : "—"}
            />
          </>
        )}
      </WidgetCard>

      <SectionHeader title="Advanced" subtitle="Behavior intelligence and predictive power" />
      <WidgetCard title="Audience Depth Metrics" loading={loading}>
        {audienceDepth && (
          <>
            <StatRow label="Total followers" value={audienceDepth.totalFollowers} />
            <StatRow label="Unique engagers (followers)" value={audienceDepth.uniqueEngagers} />
            <StatRow
              label="Engagement depth %"
              value={audienceDepth.engagementDepthPercent != null ? `${audienceDepth.engagementDepthPercent}%` : "—"}
            />
            <StatRow label="Total engagement from followers" value={audienceDepth.totalEngagementFromFollowers} />
            <StatRow label="Repeat engagers (2+ actions)" value={audienceDepth.repeatEngagers} />
            <StatRow
              label="Repeat engagers %"
              value={audienceDepth.repeatEngagersPercent != null ? `${audienceDepth.repeatEngagersPercent}%` : "—"}
            />
            <StatRow
              label="Avg engagements per engager"
              value={audienceDepth.avgEngagementsPerEngager ?? "—"}
            />
            <StatRow label="Lurkers (no engagement)" value={audienceDepth.lurkersCount} />
            <StatRow
              label="Lurkers %"
              value={audienceDepth.lurkersPercent != null ? `${audienceDepth.lurkersPercent}%` : "—"}
            />
          </>
        )}
      </WidgetCard>
      <WidgetCard title="Cohort Analysis" loading={loading}>
        {cohortAnalysis && cohortAnalysis.cohorts.length > 0 && (
          <>
            {cohortAnalysis.cohorts.map((row) => (
              <StatRow
                key={row.label}
                label={row.label}
                value={
                  row.size === 0
                    ? "0 followers"
                    : row.engagementRatePercent != null
                      ? `${row.size} followers · ${row.engagedCount} engaged (${row.engagementRatePercent}%)`
                      : `${row.size} followers · ${row.engagedCount} engaged`
                }
              />
            ))}
          </>
        )}
      </WidgetCard>
      <WidgetCard title="Behavioral Tracking" loading={loading}>
        {behavioralTracking && (
          <>
            <StatRow label="Likes (from followers)" value={behavioralTracking.likesFromFollowers} />
            <StatRow label="Comments (from followers)" value={behavioralTracking.commentsFromFollowers} />
            <StatRow label="Reposts (from followers)" value={behavioralTracking.repostsFromFollowers} />
            <StatRow label="Total actions" value={behavioralTracking.totalActions} />
            <StatRow
              label="Likes share"
              value={behavioralTracking.likesSharePercent != null ? `${behavioralTracking.likesSharePercent}%` : "—"}
            />
            <StatRow
              label="Comments share"
              value={behavioralTracking.commentsSharePercent != null ? `${behavioralTracking.commentsSharePercent}%` : "—"}
            />
            <StatRow
              label="Reposts share"
              value={behavioralTracking.repostsSharePercent != null ? `${behavioralTracking.repostsSharePercent}%` : "—"}
            />
            <StatRow
              label="Dominant action"
              value={behavioralTracking.dominantAction ?? "—"}
            />
          </>
        )}
      </WidgetCard>
      <WidgetCard title="Conversion Attribution" loading={loading}>
        {conversionAttribution && (
          <>
            <StatRow label="Total engagement (attributed)" value={conversionAttribution.totalEngagement} />
            <StatRow
              label="Top 5 posts share of engagement"
              value={conversionAttribution.top5EngagementSharePercent != null ? `${conversionAttribution.top5EngagementSharePercent}%` : "—"}
            />
            {conversionAttribution.topPostByLikes && (
              <StatRow
                label="Top post by likes"
                value={`${(conversionAttribution.topPostByLikes.title || "Untitled").slice(0, 20)}... (${conversionAttribution.topPostByLikes.likes})`}
              />
            )}
            {conversionAttribution.topPostByComments && (
              <StatRow
                label="Top post by comments"
                value={`${(conversionAttribution.topPostByComments.title || "Untitled").slice(0, 20)}... (${conversionAttribution.topPostByComments.comments})`}
              />
            )}
            {conversionAttribution.topPostByReposts && (
              <StatRow
                label="Top post by reposts"
                value={`${(conversionAttribution.topPostByReposts.title || "Untitled").slice(0, 20)}... (${conversionAttribution.topPostByReposts.reposts})`}
              />
            )}
            {conversionAttribution.topPostsByEngagement.length > 0 && (
              <>
                <Text className="mt-2 text-xs font-medium text-zinc-500">Top 5 by total engagement</Text>
                {conversionAttribution.topPostsByEngagement.map((p, i) => (
                  <StatRow
                    key={p.postId}
                    label={`#${i + 1} ${(p.title || "Untitled").slice(0, 18)}...`}
                    value={`${p.totalEngagement} (${p.likes} L / ${p.comments} C / ${p.reposts} R)`}
                  />
                ))}
              </>
            )}
          </>
        )}
      </WidgetCard>
      <WidgetCard title="Churn Risk Monitoring" loading={loading}>
        {churnRisk && (
          <>
            <StatRow label="Total followers" value={churnRisk.totalFollowers} />
            <StatRow label="At-risk (no engagement in 30d)" value={churnRisk.atRiskCount} />
            <StatRow
              label="At-risk %"
              value={churnRisk.atRiskPercent != null ? `${churnRisk.atRiskPercent}%` : "—"}
            />
            <StatRow label="Engaged in last 30 days" value={churnRisk.engagedLast30DaysCount} />
            <StatRow
              label="Engaged (30d) %"
              value={churnRisk.engagedLast30DaysPercent != null ? `${churnRisk.engagedLast30DaysPercent}%` : "—"}
            />
            <StatRow label="New followers (7 days)" value={churnRisk.newFollowersLast7Days} />
          </>
        )}
      </WidgetCard>
      <WidgetCard title="Community Health Index" loading={loading}>
        {communityHealth && (
          <>
            <StatRow label="Health index (0–100)" value={communityHealth.healthIndex} />
            <StatRow label="Engagement depth score" value={communityHealth.engagementDepthScore} />
            <StatRow label="Retention score" value={communityHealth.retentionScore} />
            <StatRow label="Growth score" value={communityHealth.growthScore} />
            <StatRow label="Activity score" value={communityHealth.activityScore} />
          </>
        )}
      </WidgetCard>
    </ScrollView>
  );
}
