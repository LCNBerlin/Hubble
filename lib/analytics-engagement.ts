import supabase from "./supabase";

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

export async function getAudienceOverview(creatorId: string): Promise<AudienceOverview> {
  if (!supabase) {
    return {
      totalFollowers: 0,
      newFollowersLast7Days: 0,
      newFollowersLast30Days: 0,
      unfollowsLast7Days: 0,
      unfollowsLast30Days: 0,
      activeFollowersPercent: null,
      followerGrowthRate: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("followers_count")
    .eq("id", creatorId)
    .single();

  const totalFollowers = profile?.followers_count ?? 0;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { count: newLast7 } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", creatorId)
    .gte("created_at", sevenDaysAgo);

  const { count: newLast30 } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", creatorId)
    .gte("created_at", thirtyDaysAgo);

  return {
    totalFollowers,
    newFollowersLast7Days: newLast7 ?? 0,
    newFollowersLast30Days: newLast30 ?? 0,
    unfollowsLast7Days: 0,
    unfollowsLast30Days: 0,
    activeFollowersPercent: null,
    followerGrowthRate: totalFollowers > 0 && (newLast30 ?? 0) > 0 ? ((newLast30 ?? 0) / totalFollowers) * 100 : null,
  };
}

export async function getContentPerformance(creatorId: string): Promise<ContentPerformance> {
  if (!supabase) {
    return {
      totalPosts: 0,
      totalLikes: 0,
      totalComments: 0,
      totalReposts: 0,
      totalSaves: 0,
      topPosts: [],
    };
  }

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, created_at")
    .eq("user_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!posts?.length) {
    return {
      totalPosts: 0,
      totalLikes: 0,
      totalComments: 0,
      totalReposts: 0,
      totalSaves: 0,
      topPosts: [],
    };
  }

  const postIds = posts.map((p) => p.id);

  const [likesRes, commentsRes, repostsRes, savesRes] = await Promise.all([
    supabase.from("post_likes").select("post_id").in("post_id", postIds),
    supabase.from("post_comments").select("post_id").in("post_id", postIds),
    supabase.from("reposts").select("post_id").in("post_id", postIds),
    supabase.from("saved_posts").select("post_id").in("post_id", postIds),
  ]);

  const countBy = (arr: { post_id: string }[]): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const row of arr) {
      out[row.post_id] = (out[row.post_id] ?? 0) + 1;
    }
    return out;
  };

  const likesByPost = countBy(likesRes.data ?? []);
  const commentsByPost = countBy(commentsRes.data ?? []);
  const repostsByPost = countBy(repostsRes.data ?? []);
  const savesByPost = countBy(savesRes.data ?? []);

  let totalLikes = 0;
  let totalComments = 0;
  let totalReposts = 0;
  let totalSaves = 0;

  const postEngagements: PostEngagement[] = posts.map((post) => {
    const likes = likesByPost[post.id] ?? 0;
    const comments = commentsByPost[post.id] ?? 0;
    const reposts = repostsByPost[post.id] ?? 0;
    const saves = savesByPost[post.id] ?? 0;
    totalLikes += likes;
    totalComments += comments;
    totalReposts += reposts;
    totalSaves += saves;
    const totalEng = likes + comments + reposts + saves;
    const engagementRate = totalEng > 0 ? (totalEng / (likes + 1)) * 100 : 0;
    return {
      postId: post.id,
      title: post.title,
      likes,
      comments,
      reposts,
      saves,
      engagementRate,
      createdAt: post.created_at,
    };
  });

  const topPosts = postEngagements
    .sort((a, b) => b.likes + b.comments + b.reposts + b.saves - (a.likes + a.comments + a.reposts + a.saves))
    .slice(0, 5);

  return {
    totalPosts: posts.length,
    totalLikes,
    totalComments,
    totalReposts,
    totalSaves,
    topPosts,
  };
}

/** Engagement from followers only (subscriber = follower). */
export type SubscriberActivityMetrics = {
  likesFromFollowersLifetime: number;
  likesFromFollowersLast7Days: number;
  commentsFromFollowersLifetime: number;
  commentsFromFollowersLast7Days: number;
  repostsFromFollowersLifetime: number;
  repostsFromFollowersLast7Days: number;
  /** Distinct followers who liked, commented, or reposted. */
  uniqueEngagersLifetime: number;
  /** Subscriber engagement as % of total engagement (likes+comments+reposts from followers / total). */
  subscriberEngagementSharePercent: number | null;
};

export async function getSubscriberActivityMetrics(creatorId: string): Promise<SubscriberActivityMetrics> {
  const empty: SubscriberActivityMetrics = {
    likesFromFollowersLifetime: 0,
    likesFromFollowersLast7Days: 0,
    commentsFromFollowersLifetime: 0,
    commentsFromFollowersLast7Days: 0,
    repostsFromFollowersLifetime: 0,
    repostsFromFollowersLast7Days: 0,
    uniqueEngagersLifetime: 0,
    subscriberEngagementSharePercent: null,
  };

  if (!supabase) return empty;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [postsRes, followsRes] = await Promise.all([
    supabase.from("posts").select("id").eq("user_id", creatorId),
    supabase.from("follows").select("follower_id").eq("following_id", creatorId),
  ]);

  const postIds = (postsRes?.data ?? []).map((p) => p.id);
  const followerIds = new Set((followsRes?.data ?? []).map((f) => f.follower_id));

  if (postIds.length === 0 || followerIds.size === 0) return empty;

  const [likesRes, commentsRes, repostsRes] = await Promise.all([
    supabase.from("post_likes").select("user_id, post_id, created_at").in("post_id", postIds),
    supabase.from("post_comments").select("user_id, post_id, created_at").in("post_id", postIds),
    supabase.from("reposts").select("user_id, post_id, created_at").in("post_id", postIds),
  ]);

  let likesFromFollowersLifetime = 0;
  let likesFromFollowersLast7Days = 0;
  let commentsFromFollowersLifetime = 0;
  let commentsFromFollowersLast7Days = 0;
  let repostsFromFollowersLifetime = 0;
  let repostsFromFollowersLast7Days = 0;
  const engagerIds = new Set<string>();

  for (const row of likesRes?.data ?? []) {
    if (!followerIds.has(row.user_id)) continue;
    likesFromFollowersLifetime += 1;
    engagerIds.add(row.user_id);
    if (row.created_at >= sevenDaysAgo) likesFromFollowersLast7Days += 1;
  }
  for (const row of commentsRes?.data ?? []) {
    if (!followerIds.has(row.user_id)) continue;
    commentsFromFollowersLifetime += 1;
    engagerIds.add(row.user_id);
    if (row.created_at >= sevenDaysAgo) commentsFromFollowersLast7Days += 1;
  }
  for (const row of repostsRes?.data ?? []) {
    if (!followerIds.has(row.user_id)) continue;
    repostsFromFollowersLifetime += 1;
    engagerIds.add(row.user_id);
    if (row.created_at >= sevenDaysAgo) repostsFromFollowersLast7Days += 1;
  }

  const subscriberEngagementTotal =
    likesFromFollowersLifetime + commentsFromFollowersLifetime + repostsFromFollowersLifetime;
  const [totalLikesRes, totalCommentsRes, totalRepostsRes] = await Promise.all([
    supabase.from("post_likes").select("post_id").in("post_id", postIds),
    supabase.from("post_comments").select("post_id").in("post_id", postIds),
    supabase.from("reposts").select("post_id").in("post_id", postIds),
  ]);
  const totalEngagement =
    (totalLikesRes?.data?.length ?? 0) +
    (totalCommentsRes?.data?.length ?? 0) +
    (totalRepostsRes?.data?.length ?? 0);
  const subscriberEngagementSharePercent =
    totalEngagement > 0
      ? Math.round((subscriberEngagementTotal / totalEngagement) * 10000) / 100
      : null;

  return {
    likesFromFollowersLifetime,
    likesFromFollowersLast7Days,
    commentsFromFollowersLifetime,
    commentsFromFollowersLast7Days,
    repostsFromFollowersLifetime,
    repostsFromFollowersLast7Days,
    uniqueEngagersLifetime: engagerIds.size,
    subscriberEngagementSharePercent,
  };
}

/** Messaging engagement: DM access grants (paid access to message creator). */
export type MessagingEngagementMetrics = {
  totalDmAccessGrants: number;
  newDmAccessGrantsLast7Days: number;
  newDmAccessGrantsLast30Days: number;
  totalDmAccessRevenueCents: number;
};

export async function getMessagingEngagementMetrics(creatorId: string): Promise<MessagingEngagementMetrics> {
  const empty: MessagingEngagementMetrics = {
    totalDmAccessGrants: 0,
    newDmAccessGrantsLast7Days: 0,
    newDmAccessGrantsLast30Days: 0,
    totalDmAccessRevenueCents: 0,
  };

  if (!supabase) return empty;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: grants } = await supabase
    .from("dm_access_grants")
    .select("amount_cents, created_at")
    .eq("creator_id", creatorId);

  const rows = grants ?? [];
  let totalDmAccessRevenueCents = 0;
  let newDmAccessGrantsLast7Days = 0;
  let newDmAccessGrantsLast30Days = 0;

  for (const row of rows) {
    totalDmAccessRevenueCents += row.amount_cents ?? 0;
    if (row.created_at >= sevenDaysAgo) newDmAccessGrantsLast7Days += 1;
    if (row.created_at >= thirtyDaysAgo) newDmAccessGrantsLast30Days += 1;
  }

  return {
    totalDmAccessGrants: rows.length,
    newDmAccessGrantsLast7Days,
    newDmAccessGrantsLast30Days,
    totalDmAccessRevenueCents,
  };
}

/** Time-based insights: engagement and posting over time windows + peak times. */
export type TimeBasedInsightsMetrics = {
  engagementLast24Hours: number;
  engagementLast7Days: number;
  engagementLast30Days: number;
  postsLast7Days: number;
  postsLast30Days: number;
  avgEngagementPerPostLast7Days: number | null;
  avgEngagementPerPostLast30Days: number | null;
  /** Hour (0–23) UTC with most engagement. */
  peakEngagementHour: number | null;
  /** Day of week (0 = Sunday … 6 = Saturday) with most engagement. */
  peakEngagementDayOfWeek: number | null;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getPeakDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? "—";
}

export async function getTimeBasedInsightsMetrics(creatorId: string): Promise<TimeBasedInsightsMetrics> {
  const empty: TimeBasedInsightsMetrics = {
    engagementLast24Hours: 0,
    engagementLast7Days: 0,
    engagementLast30Days: 0,
    postsLast7Days: 0,
    postsLast30Days: 0,
    avgEngagementPerPostLast7Days: null,
    avgEngagementPerPostLast30Days: null,
    peakEngagementHour: null,
    peakEngagementDayOfWeek: null,
  };

  if (!supabase) return empty;

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, created_at")
    .eq("user_id", creatorId);

  const postList = posts ?? [];
  const postIds = postList.map((p) => p.id);
  let postsLast7Days = 0;
  let postsLast30Days = 0;
  for (const p of postList) {
    if (p.created_at >= sevenDaysAgo) postsLast7Days += 1;
    if (p.created_at >= thirtyDaysAgo) postsLast30Days += 1;
  }

  if (postIds.length === 0) return { ...empty, postsLast7Days, postsLast30Days };

  const [likesRes, commentsRes, repostsRes] = await Promise.all([
    supabase.from("post_likes").select("created_at").in("post_id", postIds).gte("created_at", thirtyDaysAgo),
    supabase.from("post_comments").select("created_at").in("post_id", postIds).gte("created_at", thirtyDaysAgo),
    supabase.from("reposts").select("created_at").in("post_id", postIds).gte("created_at", thirtyDaysAgo),
  ]);

  const allDates: string[] = [];
  const pushDates = (rows: { created_at: string }[] | null) => {
    for (const row of rows ?? []) allDates.push(row.created_at);
  };
  pushDates(likesRes.data);
  pushDates(commentsRes.data);
  pushDates(repostsRes.data);

  let engagementLast24Hours = 0;
  let engagementLast7Days = 0;
  let engagementLast30Days = 0;
  const hourCounts: number[] = Array.from({ length: 24 }, () => 0);
  const dayCounts: number[] = Array.from({ length: 7 }, () => 0);

  for (const iso of allDates) {
    if (iso >= twentyFourHoursAgo) engagementLast24Hours += 1;
    if (iso >= sevenDaysAgo) engagementLast7Days += 1;
    if (iso >= thirtyDaysAgo) engagementLast30Days += 1;
    const d = new Date(iso);
    const hour = d.getUTCHours();
    const day = d.getUTCDay();
    hourCounts[hour] += 1;
    dayCounts[day] += 1;
  }

  let peakEngagementHour: number | null = null;
  let peakEngagementDayOfWeek: number | null = null;
  let maxH = 0;
  let maxD = 0;
  for (let i = 0; i < 24; i++) {
    if (hourCounts[i] > maxH) {
      maxH = hourCounts[i];
      peakEngagementHour = i;
    }
  }
  for (let i = 0; i < 7; i++) {
    if (dayCounts[i] > maxD) {
      maxD = dayCounts[i];
      peakEngagementDayOfWeek = i;
    }
  }

  const avgEngagementPerPostLast7Days =
    postsLast7Days > 0 ? Math.round((engagementLast7Days / postsLast7Days) * 100) / 100 : null;
  const avgEngagementPerPostLast30Days =
    postsLast30Days > 0 ? Math.round((engagementLast30Days / postsLast30Days) * 100) / 100 : null;

  return {
    engagementLast24Hours,
    engagementLast7Days,
    engagementLast30Days,
    postsLast7Days,
    postsLast30Days,
    avgEngagementPerPostLast7Days,
    avgEngagementPerPostLast30Days,
    peakEngagementHour,
    peakEngagementDayOfWeek,
  };
}

/** Audience depth: how much of the audience actually engages (vs lurkers) and repeat-engagement. */
export type AudienceDepthMetrics = {
  totalFollowers: number;
  /** Followers who have liked, commented, or reposted at least once. */
  uniqueEngagers: number;
  /** Unique engagers as % of followers. */
  engagementDepthPercent: number | null;
  /** Total likes + comments + reposts from followers (lifetime). */
  totalEngagementFromFollowers: number;
  /** Followers who engaged 2+ times (repeat / super fans). */
  repeatEngagers: number;
  /** Repeat engagers as % of unique engagers. */
  repeatEngagersPercent: number | null;
  /** Avg engagement events per engager (among followers). */
  avgEngagementsPerEngager: number | null;
  /** Followers who never liked, commented, or reposted. */
  lurkersCount: number;
  /** Lurkers as % of followers. */
  lurkersPercent: number | null;
};

export async function getAudienceDepthMetrics(creatorId: string): Promise<AudienceDepthMetrics> {
  const empty: AudienceDepthMetrics = {
    totalFollowers: 0,
    uniqueEngagers: 0,
    engagementDepthPercent: null,
    totalEngagementFromFollowers: 0,
    repeatEngagers: 0,
    repeatEngagersPercent: null,
    avgEngagementsPerEngager: null,
    lurkersCount: 0,
    lurkersPercent: null,
  };

  if (!supabase) return empty;

  const [postsRes, followsRes] = await Promise.all([
    supabase.from("posts").select("id").eq("user_id", creatorId),
    supabase.from("follows").select("follower_id").eq("following_id", creatorId),
  ]);

  const postIds = (postsRes?.data ?? []).map((p) => p.id);
  const followerIds = new Set((followsRes?.data ?? []).map((f) => f.follower_id));
  const totalFollowers = followerIds.size;

  if (postIds.length === 0 || totalFollowers === 0) {
    return {
      ...empty,
      totalFollowers,
      lurkersCount: totalFollowers,
      lurkersPercent: 100,
    };
  }

  const [likesRes, commentsRes, repostsRes] = await Promise.all([
    supabase.from("post_likes").select("user_id").in("post_id", postIds),
    supabase.from("post_comments").select("user_id").in("post_id", postIds),
    supabase.from("reposts").select("user_id").in("post_id", postIds),
  ]);

  const eventsPerFollower: Record<string, number> = {};
  const count = (rows: { user_id: string }[] | null) => {
    for (const row of rows ?? []) {
      if (!followerIds.has(row.user_id)) continue;
      eventsPerFollower[row.user_id] = (eventsPerFollower[row.user_id] ?? 0) + 1;
    }
  };
  count(likesRes.data);
  count(commentsRes.data);
  count(repostsRes.data);

  const counts = Object.values(eventsPerFollower);
  const uniqueEngagers = counts.length;
  const totalEngagementFromFollowers = counts.reduce((a, b) => a + b, 0);
  const repeatEngagers = counts.filter((c) => c >= 2).length;
  const engagementDepthPercent =
    totalFollowers > 0 ? Math.round((uniqueEngagers / totalFollowers) * 10000) / 100 : null;
  const repeatEngagersPercent =
    uniqueEngagers > 0 ? Math.round((repeatEngagers / uniqueEngagers) * 10000) / 100 : null;
  const avgEngagementsPerEngager =
    uniqueEngagers > 0 ? Math.round((totalEngagementFromFollowers / uniqueEngagers) * 100) / 100 : null;
  const lurkersCount = totalFollowers - uniqueEngagers;
  const lurkersPercent = totalFollowers > 0 ? Math.round((lurkersCount / totalFollowers) * 10000) / 100 : null;

  return {
    totalFollowers,
    uniqueEngagers,
    engagementDepthPercent,
    totalEngagementFromFollowers,
    repeatEngagers,
    repeatEngagersPercent,
    avgEngagementsPerEngager,
    lurkersCount,
    lurkersPercent,
  };
}

/** Single cohort: followers who followed in a time window and their engagement. */
export type CohortRow = {
  label: string;
  size: number;
  engagedCount: number;
  engagementRatePercent: number | null;
};

/** Cohort analysis: followers grouped by when they followed, with engagement rate per cohort. */
export type CohortAnalysisMetrics = {
  cohorts: CohortRow[];
};

export async function getCohortAnalysisMetrics(creatorId: string): Promise<CohortAnalysisMetrics> {
  const empty: CohortAnalysisMetrics = { cohorts: [] };

  if (!supabase) return empty;

  const now = new Date();
  const t = now.getTime();
  const day = 24 * 60 * 60 * 1000;
  const windows: { label: string; start: Date; end: Date }[] = [
    { label: "Last 7 days", start: new Date(t - 7 * day), end: now },
    { label: "8–14 days ago", start: new Date(t - 14 * day), end: new Date(t - 7 * day) },
    { label: "15–21 days ago", start: new Date(t - 21 * day), end: new Date(t - 14 * day) },
    { label: "22–30 days ago", start: new Date(t - 30 * day), end: new Date(t - 21 * day) },
  ];

  const [postsRes, followsRes] = await Promise.all([
    supabase.from("posts").select("id").eq("user_id", creatorId),
    supabase.from("follows").select("follower_id, created_at").eq("following_id", creatorId),
  ]);

  const postIds = (postsRes?.data ?? []).map((p) => p.id);
  const follows = followsRes?.data ?? [];

  if (postIds.length === 0) {
    return {
      cohorts: windows.map((w) => {
        const size = follows.filter((f) => {
          const d = new Date(f.created_at).getTime();
          return d >= w.start.getTime() && d < w.end.getTime();
        }).length;
        return { label: w.label, size, engagedCount: 0, engagementRatePercent: null };
      }),
    };
  }

  const [likesRes, commentsRes, repostsRes] = await Promise.all([
    supabase.from("post_likes").select("user_id").in("post_id", postIds),
    supabase.from("post_comments").select("user_id").in("post_id", postIds),
    supabase.from("reposts").select("user_id").in("post_id", postIds),
  ]);

  const engagedFollowerIds = new Set<string>();
  const add = (rows: { user_id: string }[] | null) => {
    for (const row of rows ?? []) engagedFollowerIds.add(row.user_id);
  };
  add(likesRes.data);
  add(commentsRes.data);
  add(repostsRes.data);

  const cohorts: CohortRow[] = windows.map((w) => {
    const startMs = w.start.getTime();
    const endMs = w.end.getTime();
    const inCohort = follows.filter((f) => {
      const d = new Date(f.created_at).getTime();
      return d >= startMs && d < endMs;
    });
    const size = inCohort.length;
    const engagedCount = inCohort.filter((f) => engagedFollowerIds.has(f.follower_id)).length;
    const engagementRatePercent =
      size > 0 ? Math.round((engagedCount / size) * 10000) / 100 : null;
    return {
      label: w.label,
      size,
      engagedCount,
      engagementRatePercent,
    };
  });

  return { cohorts };
}

/** Behavioral tracking: how followers engage (action mix: likes vs comments vs reposts). */
export type BehavioralTrackingMetrics = {
  likesFromFollowers: number;
  commentsFromFollowers: number;
  repostsFromFollowers: number;
  totalActions: number;
  likesSharePercent: number | null;
  commentsSharePercent: number | null;
  repostsSharePercent: number | null;
  /** Label of the most common action: "likes" | "comments" | "reposts" */
  dominantAction: "likes" | "comments" | "reposts" | null;
};

export async function getBehavioralTrackingMetrics(creatorId: string): Promise<BehavioralTrackingMetrics> {
  const empty: BehavioralTrackingMetrics = {
    likesFromFollowers: 0,
    commentsFromFollowers: 0,
    repostsFromFollowers: 0,
    totalActions: 0,
    likesSharePercent: null,
    commentsSharePercent: null,
    repostsSharePercent: null,
    dominantAction: null,
  };

  if (!supabase) return empty;

  const [postsRes, followsRes] = await Promise.all([
    supabase.from("posts").select("id").eq("user_id", creatorId),
    supabase.from("follows").select("follower_id").eq("following_id", creatorId),
  ]);

  const postIds = (postsRes?.data ?? []).map((p) => p.id);
  const followerIds = new Set((followsRes?.data ?? []).map((f) => f.follower_id));

  if (postIds.length === 0 || followerIds.size === 0) return empty;

  const [likesRes, commentsRes, repostsRes] = await Promise.all([
    supabase.from("post_likes").select("user_id").in("post_id", postIds),
    supabase.from("post_comments").select("user_id").in("post_id", postIds),
    supabase.from("reposts").select("user_id").in("post_id", postIds),
  ]);

  let likesFromFollowers = 0;
  let commentsFromFollowers = 0;
  let repostsFromFollowers = 0;
  for (const row of likesRes?.data ?? []) {
    if (followerIds.has(row.user_id)) likesFromFollowers += 1;
  }
  for (const row of commentsRes?.data ?? []) {
    if (followerIds.has(row.user_id)) commentsFromFollowers += 1;
  }
  for (const row of repostsRes?.data ?? []) {
    if (followerIds.has(row.user_id)) repostsFromFollowers += 1;
  }

  const totalActions = likesFromFollowers + commentsFromFollowers + repostsFromFollowers;
  const likesSharePercent =
    totalActions > 0 ? Math.round((likesFromFollowers / totalActions) * 10000) / 100 : null;
  const commentsSharePercent =
    totalActions > 0 ? Math.round((commentsFromFollowers / totalActions) * 10000) / 100 : null;
  const repostsSharePercent =
    totalActions > 0 ? Math.round((repostsFromFollowers / totalActions) * 10000) / 100 : null;

  let dominantAction: "likes" | "comments" | "reposts" | null = null;
  if (totalActions > 0) {
    const max = Math.max(likesFromFollowers, commentsFromFollowers, repostsFromFollowers);
    if (max === likesFromFollowers) dominantAction = "likes";
    else if (max === commentsFromFollowers) dominantAction = "comments";
    else dominantAction = "reposts";
  }

  return {
    likesFromFollowers,
    commentsFromFollowers,
    repostsFromFollowers,
    totalActions,
    likesSharePercent,
    commentsSharePercent,
    repostsSharePercent,
    dominantAction,
  };
}

/** Attribution row: one post's contribution to engagement. */
export type AttributionPost = {
  postId: string;
  title: string | null;
  likes: number;
  comments: number;
  reposts: number;
  totalEngagement: number;
};

/** Conversion attribution: which content drove engagement (likes, comments, reposts). */
export type ConversionAttributionMetrics = {
  totalEngagement: number;
  /** Top 5 posts by total engagement. */
  topPostsByEngagement: AttributionPost[];
  /** Share of total engagement from top 5 posts. */
  top5EngagementSharePercent: number | null;
  /** Post that drove the most likes. */
  topPostByLikes: AttributionPost | null;
  /** Post that drove the most comments. */
  topPostByComments: AttributionPost | null;
  /** Post that drove the most reposts. */
  topPostByReposts: AttributionPost | null;
};

export async function getConversionAttributionMetrics(creatorId: string): Promise<ConversionAttributionMetrics> {
  const empty: ConversionAttributionMetrics = {
    totalEngagement: 0,
    topPostsByEngagement: [],
    top5EngagementSharePercent: null,
    topPostByLikes: null,
    topPostByComments: null,
    topPostByReposts: null,
  };

  if (!supabase) return empty;

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title")
    .eq("user_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!posts?.length) return empty;

  const postIds = posts.map((p) => p.id);

  const [likesRes, commentsRes, repostsRes] = await Promise.all([
    supabase.from("post_likes").select("post_id").in("post_id", postIds),
    supabase.from("post_comments").select("post_id").in("post_id", postIds),
    supabase.from("reposts").select("post_id").in("post_id", postIds),
  ]);

  const countByPost = (rows: { post_id: string }[] | null): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const row of rows ?? []) {
      out[row.post_id] = (out[row.post_id] ?? 0) + 1;
    }
    return out;
  };
  const likesByPost = countByPost(likesRes.data);
  const commentsByPost = countByPost(commentsRes.data);
  const repostsByPost = countByPost(repostsRes.data);

  const attributionPosts: AttributionPost[] = posts.map((post) => {
    const likes = likesByPost[post.id] ?? 0;
    const comments = commentsByPost[post.id] ?? 0;
    const reposts = repostsByPost[post.id] ?? 0;
    return {
      postId: post.id,
      title: post.title,
      likes,
      comments,
      reposts,
      totalEngagement: likes + comments + reposts,
    };
  });

  const totalEngagement = attributionPosts.reduce((s, p) => s + p.totalEngagement, 0);
  const byEngagement = [...attributionPosts].sort((a, b) => b.totalEngagement - a.totalEngagement);
  const topPostsByEngagement = byEngagement.slice(0, 5);
  const top5Sum = topPostsByEngagement.reduce((s, p) => s + p.totalEngagement, 0);
  const top5EngagementSharePercent =
    totalEngagement > 0 ? Math.round((top5Sum / totalEngagement) * 10000) / 100 : null;

  const byLikes = [...attributionPosts].sort((a, b) => b.likes - a.likes);
  const byComments = [...attributionPosts].sort((a, b) => b.comments - a.comments);
  const byReposts = [...attributionPosts].sort((a, b) => b.reposts - a.reposts);

  return {
    totalEngagement,
    topPostsByEngagement,
    top5EngagementSharePercent,
    topPostByLikes: byLikes[0] ?? null,
    topPostByComments: byComments[0] ?? null,
    topPostByReposts: byReposts[0] ?? null,
  };
}

/** Churn risk: followers who haven't engaged recently (at-risk of unfollowing). */
export type ChurnRiskMetrics = {
  totalFollowers: number;
  /** Followers who followed 30+ days ago and had no engagement in the last 30 days. */
  atRiskCount: number;
  atRiskPercent: number | null;
  /** Followers who had at least one like/comment/repost in the last 30 days. */
  engagedLast30DaysCount: number;
  engagedLast30DaysPercent: number | null;
  /** Followers who followed in the last 7 days (new, not yet at risk). */
  newFollowersLast7Days: number;
};

export async function getChurnRiskMetrics(creatorId: string): Promise<ChurnRiskMetrics> {
  const empty: ChurnRiskMetrics = {
    totalFollowers: 0,
    atRiskCount: 0,
    atRiskPercent: null,
    engagedLast30DaysCount: 0,
    engagedLast30DaysPercent: null,
    newFollowersLast7Days: 0,
  };

  if (!supabase) return empty;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [postsRes, followsRes] = await Promise.all([
    supabase.from("posts").select("id").eq("user_id", creatorId),
    supabase.from("follows").select("follower_id, created_at").eq("following_id", creatorId),
  ]);

  const postIds = (postsRes?.data ?? []).map((p) => p.id);
  const follows = followsRes?.data ?? [];
  const totalFollowers = follows.length;

  if (totalFollowers === 0) return empty;

  const newFollowersLast7Days = follows.filter((f) => f.created_at >= sevenDaysAgo).length;

  if (postIds.length === 0) {
    const atRiskCount = follows.filter((f) => f.created_at < thirtyDaysAgo).length;
    return {
      totalFollowers,
      atRiskCount,
      atRiskPercent: totalFollowers > 0 ? Math.round((atRiskCount / totalFollowers) * 10000) / 100 : null,
      engagedLast30DaysCount: 0,
      engagedLast30DaysPercent: 0,
      newFollowersLast7Days,
    };
  }

  const [likesRes, commentsRes, repostsRes] = await Promise.all([
    supabase.from("post_likes").select("user_id, created_at").in("post_id", postIds).gte("created_at", thirtyDaysAgo),
    supabase.from("post_comments").select("user_id, created_at").in("post_id", postIds).gte("created_at", thirtyDaysAgo),
    supabase.from("reposts").select("user_id, created_at").in("post_id", postIds).gte("created_at", thirtyDaysAgo),
  ]);

  const engagedInLast30Days = new Set<string>();
  const add = (rows: { user_id: string }[] | null) => {
    for (const row of rows ?? []) engagedInLast30Days.add(row.user_id);
  };
  add(likesRes.data);
  add(commentsRes.data);
  add(repostsRes.data);

  let engagedLast30DaysCount = 0;
  let atRiskCount = 0;
  for (const f of follows) {
    const followedAt = new Date(f.created_at).getTime();
    const followed30PlusAgo = followedAt < new Date(thirtyDaysAgo).getTime();
    const engagedRecently = engagedInLast30Days.has(f.follower_id);
    if (engagedRecently) engagedLast30DaysCount += 1;
    if (followed30PlusAgo && !engagedRecently) atRiskCount += 1;
  }

  const atRiskPercent = totalFollowers > 0 ? Math.round((atRiskCount / totalFollowers) * 10000) / 100 : null;
  const engagedLast30DaysPercent = totalFollowers > 0 ? Math.round((engagedLast30DaysCount / totalFollowers) * 10000) / 100 : null;

  return {
    totalFollowers,
    atRiskCount,
    atRiskPercent,
    engagedLast30DaysCount,
    engagedLast30DaysPercent,
    newFollowersLast7Days,
  };
}

/** Community health: composite 0–100 index from depth, retention, growth, and activity. */
export type CommunityHealthIndexMetrics = {
  /** Overall health score 0–100. */
  healthIndex: number;
  /** Engagement depth: % of followers who have ever engaged (0–100). */
  engagementDepthScore: number;
  /** Retention: 100 − at-risk % (0–100). */
  retentionScore: number;
  /** Growth: score from new followers in last 30d (0–100). */
  growthScore: number;
  /** Recent activity: score from engagement from followers in last 7d (0–100). */
  activityScore: number;
};

export async function getCommunityHealthIndexMetrics(creatorId: string): Promise<CommunityHealthIndexMetrics> {
  const empty: CommunityHealthIndexMetrics = {
    healthIndex: 0,
    engagementDepthScore: 0,
    retentionScore: 0,
    growthScore: 0,
    activityScore: 0,
  };

  if (!supabase) return empty;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [postsRes, followsRes] = await Promise.all([
    supabase.from("posts").select("id").eq("user_id", creatorId),
    supabase.from("follows").select("follower_id, created_at").eq("following_id", creatorId),
  ]);

  const postIds = (postsRes?.data ?? []).map((p) => p.id);
  const follows = followsRes?.data ?? [];
  const totalFollowers = follows.length;
  const followerIds = new Set(follows.map((f) => f.follower_id));

  const newFollowersLast7Days = follows.filter((f) => f.created_at >= sevenDaysAgo).length;
  const newFollowersLast30Days = follows.filter((f) => f.created_at >= thirtyDaysAgo).length;

  if (totalFollowers === 0) return empty;

  const [likesRes, commentsRes, repostsRes] = await Promise.all([
    supabase.from("post_likes").select("user_id, created_at").in("post_id", postIds),
    supabase.from("post_comments").select("user_id, created_at").in("post_id", postIds),
    supabase.from("reposts").select("user_id, created_at").in("post_id", postIds),
  ]);

  const engagerIds = new Set<string>();
  let engagementLast7dFromFollowers = 0;
  let engagementLast30dFromFollowers = 0;
  const engagedInLast30Days = new Set<string>();

  const process = (rows: { user_id: string; created_at: string }[] | null) => {
    for (const row of rows ?? []) {
      if (!followerIds.has(row.user_id)) continue;
      engagerIds.add(row.user_id);
      if (row.created_at >= sevenDaysAgo) engagementLast7dFromFollowers += 1;
      if (row.created_at >= thirtyDaysAgo) {
        engagementLast30dFromFollowers += 1;
        engagedInLast30Days.add(row.user_id);
      }
    }
  };
  process(likesRes.data);
  process(commentsRes.data);
  process(repostsRes.data);

  const uniqueEngagers = engagerIds.size;
  const atRiskCount = follows.filter((f) => {
    const followed30PlusAgo = f.created_at < thirtyDaysAgo;
    return followed30PlusAgo && !engagedInLast30Days.has(f.follower_id);
  }).length;
  const atRiskPercent = totalFollowers > 0 ? (atRiskCount / totalFollowers) * 100 : 0;

  const engagementDepthScore = Math.min(100, totalFollowers > 0 ? (uniqueEngagers / totalFollowers) * 100 : 0);
  const retentionScore = Math.max(0, 100 - atRiskPercent);
  const growthScore = Math.min(100, newFollowersLast30Days * 5);
  const activityScore =
    engagementLast30dFromFollowers > 0
      ? Math.min(100, (engagementLast7dFromFollowers / engagementLast30dFromFollowers) * 100)
      : Math.min(100, engagementLast7dFromFollowers * 5);

  const healthIndex = Math.round(
    (engagementDepthScore + retentionScore + growthScore + activityScore) / 4
  );

  return {
    healthIndex,
    engagementDepthScore: Math.round(engagementDepthScore * 100) / 100,
    retentionScore: Math.round(retentionScore * 100) / 100,
    growthScore: Math.round(growthScore * 100) / 100,
    activityScore: Math.round(activityScore * 100) / 100,
  };
}
