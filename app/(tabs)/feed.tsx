import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { FeedRandomPostsCarousel } from "../../components/FeedRandomPostsCarousel";
import { FeedUserCard } from "../../components/FeedUserCard";
import { PostCard } from "../../components/PostCard";
import { ReportProfileModal } from "../../components/ReportProfileModal";
import { TipModal } from "../../components/TipModal";
import { Avatar, EmptyState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useCommunity } from "../../context/CommunityContext";
import { useProfile } from "../../context/ProfileContext";
import { usePostCommentCounts } from "../../hooks/usePostCommentCounts";
import { usePostDislikes } from "../../hooks/usePostDislikes";
import { usePostLikes } from "../../hooks/usePostLikes";
import { usePostReposts } from "../../hooks/usePostReposts";
import {
  getCurrentPositionAsync,
  Accuracy as LocationAccuracy,
  requestForegroundPermissionsAsync,
} from "../../lib/location";
import {
  recencyDecayScore,
  normalize,
  reputationScore as reputationScoreFn,
  getTokenBoost,
  FEED_RANKING_WEIGHTS,
} from "../../lib/feed-ranking";
import { reportPostWatch } from "../../lib/postWatchTime";
import supabase from "../../lib/supabase";
import type { PostRow, ProfileRow } from "../../lib/supabase-profiles";

const FEED_SORT_STORAGE_KEY = "hubble_feed_sort";
const ALGORITHM_MORE_KEY = "hubble_algorithm_more";
const ALGORITHM_LESS_KEY = "hubble_algorithm_less";
const ALGORITHM_POST_TYPES_KEY = "hubble_algorithm_post_types";

type SortBy = "for_you" | "newest" | "most_liked" | "most_commented" | "oldest" | "random";

const FEED_SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: "for_you", label: "For you" },
  { key: "newest", label: "Newest first" },
  { key: "most_liked", label: "Most liked" },
  { key: "most_commented", label: "Most commented" },
  { key: "oldest", label: "Oldest first" },
  { key: "random", label: "Random" },
];

function getSortLabel(sortBy: SortBy): string {
  return FEED_SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? "For you";
}

const SORT_BUTTON_LABELS: Record<SortBy, string> = {
  for_you: "For you",
  newest: "Newest",
  most_liked: "Most liked",
  most_commented: "Comments",
  oldest: "Oldest",
  random: "Random",
};

function isValidSortBy(value: unknown): value is SortBy {
  return typeof value === "string" && FEED_SORT_OPTIONS.some((o) => o.key === value);
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type FeedPost = {
  post: PostRow & { place_name?: string | null; hashtags?: string[] };
  profile: ProfileRow | null;
};

type FeedItem = FeedPost & { isSponsored: boolean };

async function fetchTrendingPosts(limit: number): Promise<FeedPost[]> {
  if (!supabase) return [];
  const { data: idsData, error: rpcError } = await supabase.rpc("get_trending_post_ids", {
    hours_window: 48,
    max_count: limit,
  });
  if (rpcError || !idsData?.length) return [];
  const ids = (idsData as { post_id: string }[]).map((r) => r.post_id);
  const { data, error } = await supabase
    .from("posts")
    .select("*, profiles!user_id(display_name, username, avatar_url)")
    .in("id", ids);
  if (error) return [];
  const byId = new Map((data ?? []).map((row: Record<string, unknown>) => [row.id as string, row]));
  return ids
    .filter((id) => byId.has(id))
    .map((id) => {
      const row = byId.get(id) as Record<string, unknown>;
      return {
        post: {
          id: row.id as string,
          user_id: row.user_id as string,
          type: row.type as string,
          title: row.title as string | null,
          body: row.body as string | null,
          media_uri: row.media_uri as string | null,
          created_at: row.created_at as string,
          poll_options: Array.isArray(row.poll_options) ? (row.poll_options as string[]) : undefined,
        },
        profile: row.profiles as ProfileRow | null,
      };
    });
}

async function fetchTrendingHashtags(limit: number): Promise<{ name: string; post_count: number }[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_trending_hashtags", {
    days_window: 7,
    max_count: limit,
  });
  if (error) return [];
  return (data ?? []).map((r: { tag_name: string; post_count: number }) => ({
    name: r.tag_name,
    post_count: Number(r.post_count),
  }));
}

async function fetchNearbyPosts(
  userLat: number,
  userLng: number,
  radiusKm: number,
  limit: number
): Promise<FeedPost[]> {
  if (!supabase) return [];
  const { data: idsData, error: rpcError } = await supabase.rpc("get_nearby_post_ids", {
    user_lat: userLat,
    user_lng: userLng,
    radius_km: radiusKm,
    max_count: limit,
  });
  if (rpcError || !idsData?.length) return [];
  const ids = (idsData as { post_id: string }[]).map((r) => r.post_id);
  const { data, error } = await supabase
    .from("posts")
    .select("*, profiles!user_id(display_name, username, avatar_url)")
    .in("id", ids);
  if (error) return [];
  const byId = new Map((data ?? []).map((row: Record<string, unknown>) => [row.id as string, row]));
  return ids
    .filter((id) => byId.has(id))
    .map((id) => {
      const row = byId.get(id) as Record<string, unknown>;
      return {
        post: {
          id: row.id as string,
          user_id: row.user_id as string,
          type: row.type as string,
          title: row.title as string | null,
          body: row.body as string | null,
          media_uri: row.media_uri as string | null,
          created_at: row.created_at as string,
          poll_options: Array.isArray(row.poll_options) ? (row.poll_options as string[]) : undefined,
        },
        profile: row.profiles as ProfileRow | null,
      };
    });
}

async function fetchVideoPosts(limit: number): Promise<FeedPost[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("posts")
    .select("*, profiles!user_id(display_name, username, avatar_url)")
    .eq("type", "video")
    .not("media_uri", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((row: Record<string, unknown>) => ({
    post: {
      id: row.id as string,
      user_id: row.user_id as string,
      type: row.type as string,
      title: row.title as string | null,
      body: row.body as string | null,
      media_uri: row.media_uri as string | null,
      created_at: row.created_at as string,
      poll_options: Array.isArray(row.poll_options) ? (row.poll_options as string[]) : undefined,
    },
    profile: row.profiles as ProfileRow | null,
  }));
}

async function fetchSponsoredPosts(limit: number): Promise<FeedPost[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("posts")
    .select("*, profiles!user_id(display_name, username, avatar_url)")
    .eq("is_sponsored", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((row: Record<string, unknown>) => ({
    post: {
      id: row.id as string,
      user_id: row.user_id as string,
      type: row.type as string,
      title: row.title as string | null,
      body: row.body as string | null,
      media_uri: row.media_uri as string | null,
      created_at: row.created_at as string,
      is_sponsored: true,
      poll_options: Array.isArray(row.poll_options) ? (row.poll_options as string[]) : undefined,
    },
    profile: row.profiles as ProfileRow | null,
  }));
}

function postMatchesTopics(post: PostRow, topics: string[]): boolean {
  if (topics.length === 0) return false;
  const text = [post.title, post.body].filter(Boolean).join(" ").toLowerCase();
  return topics.some((t) => t.trim().toLowerCase() && text.includes(t.trim().toLowerCase()));
}

const TRENDING_STRIP_ITEM_WIDTH = 120;
const TRENDING_STRIP_ITEM_HEIGHT = 100;
const TRENDING_STRIP_GAP = 8;
const TRENDING_STRIP_HEADER_HEIGHT = 14 + 8 + TRENDING_STRIP_ITEM_HEIGHT + 12; // title + margin + strip + margin
const TRENDING_TAGS_STRIP_HEIGHT = 14 + 8 + 32 + 12; // title + margin + chip row + margin

function TrendingTagsStrip({
  tags,
  onPressTag,
}: {
  tags: { name: string; post_count: number }[];
  onPressTag: (name: string) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: "#a78bfa", fontSize: 14, fontWeight: "600", marginBottom: 8, paddingHorizontal: 4 }}>
        Trending tags
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: "row", flexWrap: "nowrap", gap: 8, paddingRight: 16 }}
      >
        {tags.map((tag) => (
          <Pressable
            key={tag.name}
            onPress={() => onPressTag(tag.name)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: "rgba(124, 58, 237, 0.3)",
            }}
          >
            <Text style={{ color: "#c4b5fd", fontSize: 13 }}>#{tag.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function NearYouStrip({
  posts,
  onPressPost,
}: {
  posts: FeedPost[];
  onPressPost: (postId: string) => void;
}) {
  if (posts.length === 0) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: "#a78bfa", fontSize: 14, fontWeight: "600", marginBottom: 8, paddingHorizontal: 4 }}>
        Near you
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: TRENDING_STRIP_GAP, paddingRight: 16 }}
      >
        {posts.map(({ post, profile }) => {
          const title = post.title?.trim() || post.body?.trim() || "Post";
          const firstLine = title.split(/\n/)[0].slice(0, 40) + (title.length > 40 ? "…" : "");
          return (
            <Pressable
              key={post.id}
              onPress={() => onPressPost(post.id)}
              style={{
                width: TRENDING_STRIP_ITEM_WIDTH,
                height: TRENDING_STRIP_ITEM_HEIGHT,
                borderRadius: 10,
                overflow: "hidden",
                backgroundColor: "#27272a",
              }}
            >
              {post.media_uri ? (
                <Image
                  source={{ uri: post.media_uri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : (
                <View style={{ flex: 1, backgroundColor: "#3f3f46", justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ color: "#71717a", fontSize: 11 }} numberOfLines={2}>
                    {firstLine}
                  </Text>
                </View>
              )}
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: 6,
                  backgroundColor: "rgba(0,0,0,0.6)",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11 }} numberOfLines={1}>
                  {firstLine}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function TrendingStrip({
  posts,
  onPressPost,
}: {
  posts: FeedPost[];
  onPressPost: (postId: string) => void;
}) {
  if (posts.length === 0) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: "#a78bfa", fontSize: 14, fontWeight: "600", marginBottom: 8, paddingHorizontal: 4 }}>
        Trending
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: TRENDING_STRIP_GAP, paddingRight: 16 }}
      >
        {posts.map(({ post, profile }) => {
          const title = post.title?.trim() || post.body?.trim() || "Post";
          const firstLine = title.split(/\n/)[0].slice(0, 40) + (title.length > 40 ? "…" : "");
          return (
            <Pressable
              key={post.id}
              onPress={() => onPressPost(post.id)}
              style={{
                width: TRENDING_STRIP_ITEM_WIDTH,
                height: TRENDING_STRIP_ITEM_HEIGHT,
                borderRadius: 10,
                overflow: "hidden",
                backgroundColor: "#27272a",
              }}
            >
              {post.media_uri ? (
                <Image
                  source={{ uri: post.media_uri }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : (
                <View style={{ flex: 1, backgroundColor: "#3f3f46", justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ color: "#71717a", fontSize: 11 }} numberOfLines={2}>
                    {firstLine}
                  </Text>
                </View>
              )}
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: 6,
                  backgroundColor: "rgba(0,0,0,0.6)",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11 }} numberOfLines={1}>
                  {firstLine}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function FeedItemWithSwipes({
  item,
  isSponsored,
  isFocused,
  cardWidth,
  itemHeight,
  getLikeState,
  getDislikeState,
  getRepostState,
  getCommentCount,
  savedPostIds,
  handlePressCreator,
  handleLike,
  handleDislike,
  handleShare,
  handleRequestTip,
  toggleRepost,
  toggleSavePost,
  refreshCommentCounts,
  onRandomPostsLoaded,
  onReportUser,
  onBlockUser,
  onHidePost,
  onDeletePost,
  onFollow,
  isFollowing,
}: {
  item: FeedPost;
  isSponsored: boolean;
  /** When true, this row is the one in view; video (if any) will autoplay. */
  isFocused?: boolean;
  cardWidth: number;
  itemHeight: number;
  getLikeState: (id: string) => { isLiked: boolean; likeCount: number };
  getDislikeState: (id: string) => { isDisliked: boolean; dislikeCount: number };
  getRepostState: (id: string) => { isReposted: boolean; repostCount: number };
  getCommentCount: (id: string) => number;
  savedPostIds: string[];
  handlePressCreator: (userId: string) => void;
  handleLike: (postId: string) => void;
  handleDislike: (postId: string) => void;
  handleShare: (postId: string, title: string | null) => void;
  handleRequestTip: (postTitle?: string) => void;
  toggleRepost: (postId: string) => void;
  toggleSavePost: (postId: string) => void;
  refreshCommentCounts: () => void;
  onRandomPostsLoaded: (ids: string[]) => void;
  onReportUser?: (userId: string) => void;
  onBlockUser?: (userId: string) => void;
  onHidePost?: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
  onFollow?: (userId: string) => void;
  isFollowing?: (userId: string) => boolean;
}) {
  const router = useRouter();
  const { post, profile } = item;
  const { isLiked, likeCount } = getLikeState(post.id);
  const { isDisliked, dislikeCount } = getDislikeState(post.id);
  const { isReposted, repostCount } = getRepostState(post.id);
  const scrollRef = useRef<ScrollView>(null);
  const [isCenterSlideVisible, setIsCenterSlideVisible] = useState(true);
  const lastCenterVisibleRef = useRef(true);
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: cardWidth, animated: false });
  }, [cardWidth]);
  const updateCenterVisible = useCallback(
    (contentOffsetX: number) => {
      const page = Math.round(contentOffsetX / cardWidth);
      const centerVisible = page === 1;
      if (lastCenterVisibleRef.current !== centerVisible) {
        lastCenterVisibleRef.current = centerVisible;
        setIsCenterSlideVisible(centerVisible);
      }
    },
    [cardWidth]
  );
  return (
    <View style={{ height: itemHeight, width: cardWidth }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: cardWidth, y: 0 }}
        style={{ width: cardWidth, height: itemHeight }}
        contentContainerStyle={{ width: cardWidth * 3 }}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={(e) => updateCenterVisible(e.nativeEvent.contentOffset.x)}
        onMomentumScrollEnd={(e) => {
          updateCenterVisible(e.nativeEvent.contentOffset.x);
        }}
      >
        <View style={{ width: cardWidth, height: itemHeight }}>
          <FeedUserCard
            creatorId={post.user_id}
            profile={profile}
            cardWidth={cardWidth}
            itemHeight={itemHeight}
            onPressCreator={handlePressCreator}
            onPressPost={(creatorId, postId) => router.push({ pathname: "/creator/[id]", params: { id: creatorId, postId } })}
          />
        </View>
        <View style={{ width: cardWidth, height: itemHeight }}>
          <PostCard
            post={{
              id: post.id,
              type: post.type,
              title: post.title,
              body: post.body,
              mediaUri: post.media_uri,
              createdAt: post.created_at,
              placeName: post.place_name ?? undefined,
              hashtags: post.hashtags?.length ? post.hashtags : undefined,
              pollOptions: post.poll_options?.length ? post.poll_options : undefined,
            }}
            creator={
              profile
                ? {
                    id: post.user_id,
                    displayName: profile.display_name ?? "Creator",
                    username: profile.username ?? "",
                    avatarUri: profile.avatar_url,
                  }
                : null
            }
            postUserId={post.user_id}
            onPressHashtag={(tag) => router.push({ pathname: "/tag/[name]", params: { name: tag } })}
            onPressCreator={handlePressCreator}
            onLike={() => handleLike(post.id)}
            onDislike={() => handleDislike(post.id)}
            onShare={() => handleShare(post.id, post.title)}
            onRepost={() => toggleRepost(post.id)}
            onSave={() => toggleSavePost(post.id)}
            onTip={() => handleRequestTip(post.title ?? undefined)}
            showTip
            isLiked={isLiked}
            isDisliked={isDisliked}
            isReposted={isReposted}
            isSaved={savedPostIds.includes(post.id)}
            likeCount={likeCount}
            dislikeCount={dislikeCount}
            repostCount={repostCount}
            commentCount={getCommentCount(post.id)}
            repostedByMe={isReposted}
            fillContainer
            onCommentAdded={refreshCommentCounts}
            isSponsored={isSponsored}
            layout="reels"
            shouldPlayVideo={isFocused && isCenterSlideVisible}
            onReportUser={onReportUser}
            onBlockUser={onBlockUser}
            onHidePost={onHidePost}
            onDeletePost={onDeletePost}
            onFollow={profile ? () => onFollow?.(post.user_id) : undefined}
            isFollowing={isFollowing?.(post.user_id)}
          />
        </View>
        <View style={{ width: cardWidth, height: itemHeight }}>
          <FeedRandomPostsCarousel
            cardWidth={cardWidth}
            itemHeight={itemHeight}
            getLikeState={getLikeState}
            getDislikeState={getDislikeState}
            getRepostState={getRepostState}
            getCommentCount={getCommentCount}
            savedPostIds={savedPostIds}
            handlePressCreator={handlePressCreator}
            handleLike={handleLike}
            handleDislike={handleDislike}
            handleShare={handleShare}
            handleRequestTip={handleRequestTip}
            toggleRepost={toggleRepost}
            toggleSavePost={toggleSavePost}
            refreshCommentCounts={refreshCommentCounts}
            onPostsLoaded={onRandomPostsLoaded}
            excludePostIds={[post.id]}
            creatorId={post.user_id}
            onReportUser={onReportUser}
            onBlockUser={onBlockUser}
            onHidePost={onHidePost}
            onDeletePost={onDeletePost}
            onFollow={onFollow}
            isFollowing={isFollowing}
          />
        </View>
      </ScrollView>
    </View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { width: screenWidth, height: viewHeight } = useWindowDimensions();
  const isTablet = screenWidth >= 768;
  const cardWidth = isTablet ? screenWidth / 2 : screenWidth * 0.82;
  const contentSlotHeight = viewHeight * 0.72;
  const itemHeight = contentSlotHeight;
  const gapHeight = viewHeight * 0.3;
  const slotHeight = contentSlotHeight + gapHeight;
  const paddingVertical = 0;
  const paddingHorizontal = 0;
  const { user } = useAuth();
  const { selectedCommunityId, selectedCommunity, setSelectedCommunityId } = useCommunity();
  const { savedPostIds, toggleSavePost, blockUser, blockedUserIds } = useProfile();
  const [reportTargetUserId, setReportTargetUserId] = useState<string | null>(null);
  const [hiddenPostIds, setHiddenPostIds] = useState<Set<string>>(() => new Set());
  const [items, setItems] = useState<FeedPost[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<FeedPost[]>([]);
  const [trendingHashtags, setTrendingHashtags] = useState<{ name: string; post_count: number }[]>([]);
  const [nearbyPosts, setNearbyPosts] = useState<FeedPost[]>([]);
  const [sponsoredPosts, setSponsoredPosts] = useState<FeedPost[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [purchasedCreatorIds, setPurchasedCreatorIds] = useState<Set<string>>(new Set());
  const [engagementVelocityByPostId, setEngagementVelocityByPostId] = useState<Record<string, number>>({});
  const [commentDepthByPostId, setCommentDepthByPostId] = useState<Record<string, { total: number; replyCount: number }>>({});
  const [watchTimeByPostId, setWatchTimeByPostId] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const feedFocusStartRef = useRef<number>(Date.now());
  const feedPreviousIndexRef = useRef<number | null>(null);
  const mergedFeedItemsRef = useRef<FeedItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tipModalVisible, setTipModalVisible] = useState(false);
  const [tipForPostTitle, setTipForPostTitle] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortBy>("for_you");
  const [algorithmModalVisible, setAlgorithmModalVisible] = useState(false);
  const [algorithmSeeMore, setAlgorithmSeeMore] = useState<string[]>([]);
  const [algorithmSeeLess, setAlgorithmSeeLess] = useState<string[]>([]);
  const [algorithmPostTypes, setAlgorithmPostTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedFeedIndex, setFocusedFeedIndex] = useState<number | null>(0);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const feedListRef = useRef<FlatList>(null);

  const feedViewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;
  const onFeedViewableItemsChanged = useCallback(
    (info: { viewableItems: Array<{ index: number | null }> }) => {
      const first = info.viewableItems[0];
      const idx = first?.index ?? null;
      const prev = feedPreviousIndexRef.current;
      if (prev !== null && prev >= 0) {
        const list = mergedFeedItemsRef.current;
        const item = list[prev];
        if (item && (Date.now() - feedFocusStartRef.current) / 1000 >= 1) {
          reportPostWatch(item.post.id, user?.id ?? null, (Date.now() - feedFocusStartRef.current) / 1000).catch(
            () => {}
          );
        }
      }
      feedPreviousIndexRef.current = idx;
      feedFocusStartRef.current = Date.now();
      setFocusedFeedIndex(idx);
    },
    [user?.id]
  );

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(FEED_SORT_STORAGE_KEY);
        if (stored != null && isValidSortBy(stored)) setSortBy(stored);
      } catch {
        // ignore
      }
    })();
  }, []);

  const loadAlgorithmPreferences = useCallback(async () => {
    try {
      const [moreRaw, lessRaw, typesRaw] = await Promise.all([
        AsyncStorage.getItem(ALGORITHM_MORE_KEY),
        AsyncStorage.getItem(ALGORITHM_LESS_KEY),
        AsyncStorage.getItem(ALGORITHM_POST_TYPES_KEY),
      ]);
      if (moreRaw) {
        const parsed = JSON.parse(moreRaw);
        if (Array.isArray(parsed)) setAlgorithmSeeMore(parsed.filter((x): x is string => typeof x === "string"));
      }
      if (lessRaw) {
        const parsed = JSON.parse(lessRaw);
        if (Array.isArray(parsed)) setAlgorithmSeeLess(parsed.filter((x): x is string => typeof x === "string"));
      }
      if (typesRaw) {
        const parsed = JSON.parse(typesRaw);
        if (Array.isArray(parsed)) setAlgorithmPostTypes(parsed.filter((x): x is string => typeof x === "string"));
        else setAlgorithmPostTypes([]);
      } else {
        setAlgorithmPostTypes([]);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadAlgorithmPreferences();
  }, [loadAlgorithmPreferences]);

  useFocusEffect(
    useCallback(() => {
      loadAlgorithmPreferences();
    }, [loadAlgorithmPreferences])
  );

  const setSortByAndPersist = useCallback((key: SortBy) => {
    setSortBy(key);
    AsyncStorage.setItem(FEED_SORT_STORAGE_KEY, key).catch(() => {});
  }, []);

  const fetchFeed = useCallback(async () => {
    if (!supabase) return;
    const limit =
      sortBy === "for_you" || sortBy === "most_liked" || sortBy === "most_commented" || sortBy === "random"
        ? 100
        : 50;
    const ascending = sortBy === "oldest";
    let query = supabase
      .from("posts")
      .select("*, profiles!user_id(display_name, username, avatar_url, reputation_score, verified_tier), post_hashtags(hashtags(name))")
      .order("created_at", { ascending })
      .limit(limit);
    if (selectedCommunityId) {
      query = query.eq("user_id", selectedCommunityId);
    }
    const { data, error } = await query;
    if (error) {
      setItems([]);
      return;
    }
    let list: FeedPost[] = (data ?? []).map((row: Record<string, unknown>) => {
      const phList = (row.post_hashtags as Array<{ hashtags: { name: string } | null }> | undefined) ?? [];
      const hashtags = phList.map((ph) => ph.hashtags?.name).filter((n): n is string => !!n);
      return {
        post: {
          id: row.id as string,
          user_id: row.user_id as string,
          type: row.type as string,
          title: row.title as string | null,
          body: row.body as string | null,
          media_uri: row.media_uri as string | null,
          created_at: row.created_at as string,
          is_sponsored: (row.is_sponsored as boolean) ?? false,
          place_name: (row.place_name as string | null) ?? null,
          hashtags,
          poll_options: Array.isArray(row.poll_options) ? (row.poll_options as string[]) : undefined,
        },
        profile: row.profiles as ProfileRow | null,
      };
    });
    if (sortBy === "random") {
      list = shuffleArray(list).slice(0, 50);
    }
    setItems(list);
  }, [sortBy, selectedCommunityId]);

  useEffect(() => {
    setLoading(true);
    fetchFeed().finally(() => setLoading(false));
  }, [fetchFeed]);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      fetchFeed();
      return () => {
        setIsScreenFocused(false);
      };
    }, [fetchFeed])
  );

  useEffect(() => {
    fetchTrendingPosts(10).then(setTrendingPosts);
    fetchTrendingHashtags(10).then(setTrendingHashtags);
    fetchSponsoredPosts(5).then(setSponsoredPosts);
  }, []);

  useEffect(() => {
    if (!user?.id || !supabase) return;
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .then(({ data }) => {
        setFollowingIds(new Set((data ?? []).map((r: { following_id: string }) => r.following_id)));
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !supabase) return;
    (async () => {
      const { data: ordersData } = await supabase
        .from("orders")
        .select("id")
        .eq("buyer_id", user.id);
      if (!ordersData?.length) {
        setPurchasedCreatorIds(new Set());
        return;
      }
      const orderIds = ordersData.map((o: { id: string }) => o.id);
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("creator_id")
        .in("order_id", orderIds);
      const creatorIds = new Set(
        (itemsData ?? [])
          .map((r: { creator_id: string | null }) => r.creator_id)
          .filter((id): id is string => id != null)
      );
      setPurchasedCreatorIds(creatorIds);
    })();
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await requestForegroundPermissionsAsync();
        if (!perm || perm.status !== "granted" || cancelled) return;
        const loc = await getCurrentPositionAsync({ accuracy: LocationAccuracy.Balanced });
        if (cancelled || !loc) return;
        const list = await fetchNearbyPosts(loc.coords.latitude, loc.coords.longitude, 50, 10);
        if (!cancelled) setNearbyPosts(list);
      } catch {
        // ignore (e.g. location unavailable or permission denied)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchFeed(),
      fetchTrendingPosts(10).then(setTrendingPosts),
      fetchTrendingHashtags(10).then(setTrendingHashtags),
      fetchSponsoredPosts(5).then(setSponsoredPosts),
    ]);
    try {
      const perm = await requestForegroundPermissionsAsync();
      if (perm?.status === "granted") {
        const loc = await getCurrentPositionAsync({ accuracy: LocationAccuracy.Balanced });
        if (loc) fetchNearbyPosts(loc.coords.latitude, loc.coords.longitude, 50, 10).then(setNearbyPosts);
      }
    } catch {
      // ignore
    }
    setRefreshing(false);
  }, [fetchFeed]);

  const postIds = useMemo(() => items.map((i) => i.post.id), [items]);

  useEffect(() => {
    if (!supabase || postIds.length === 0 || sortBy !== "for_you") {
      if (sortBy !== "for_you") {
        setEngagementVelocityByPostId({});
        setCommentDepthByPostId({});
        setWatchTimeByPostId({});
      }
      return;
    }
    (async () => {
      const [velRes, depthRes, watchRes] = await Promise.all([
        supabase.rpc("get_post_engagement_velocity", { post_ids: postIds, hours_window: 24 }),
        supabase.rpc("get_post_comment_depth", { post_ids: postIds }),
        supabase.rpc("get_post_watch_aggregates", { post_ids: postIds, days_window: 7 }),
      ]);
      const velMap: Record<string, number> = {};
      (velRes.data ?? []).forEach((r: { post_id: string; velocity_count: number }) => {
        velMap[r.post_id] = Number(r.velocity_count) || 0;
      });
      setEngagementVelocityByPostId(velMap);
      const depthMap: Record<string, { total: number; replyCount: number }> = {};
      (depthRes.data ?? []).forEach(
        (r: { post_id: string; total_comments: number; reply_count: number }) => {
          depthMap[r.post_id] = {
            total: Number(r.total_comments) || 0,
            replyCount: Number(r.reply_count) || 0,
          };
        }
      );
      setCommentDepthByPostId(depthMap);
      const watchMap: Record<string, number> = {};
      (watchRes.data ?? []).forEach((r: { post_id: string; total_seconds: number }) => {
        watchMap[r.post_id] = Number(r.total_seconds) || 0;
      });
      setWatchTimeByPostId(watchMap);
    })();
  }, [postIds.join(","), sortBy]);

  const [randomPostIds, setRandomPostIds] = useState<string[]>([]);
  const trendingPostIds = useMemo(() => trendingPosts.map((i) => i.post.id), [trendingPosts]);
  const nearbyPostIds = useMemo(() => nearbyPosts.map((i) => i.post.id), [nearbyPosts]);
  const nearbyPostIdsSet = useMemo(() => new Set(nearbyPostIds), [nearbyPostIds]);
  const sponsoredPostIds = useMemo(() => sponsoredPosts.map((i) => i.post.id), [sponsoredPosts]);
  const allPostIds = useMemo(
    () => [
      ...new Set([
        ...postIds,
        ...randomPostIds,
        ...trendingPostIds,
        ...nearbyPostIds,
        ...sponsoredPostIds,
      ]),
    ],
    [postIds, randomPostIds, trendingPostIds, nearbyPostIds, sponsoredPostIds]
  );
  const { getState: getLikeState, toggleLike } = usePostLikes(allPostIds);
  const { getState: getDislikeState, toggleDislike } = usePostDislikes(allPostIds);
  const { getCommentCount, refresh: refreshCommentCounts } = usePostCommentCounts(allPostIds);
  const { getState: getRepostState, toggleRepost } = usePostReposts(allPostIds);

  const handleRandomPostsLoaded = useCallback((ids: string[]) => {
    setRandomPostIds((prev) => [...new Set([...prev, ...ids])]);
  }, []);

  const itemsFilteredByType = useMemo(() => {
    if (algorithmPostTypes.length === 0) return items;
    return items.filter((i) => algorithmPostTypes.includes(i.post.type));
  }, [items, algorithmPostTypes]);

  const sortedItems = useMemo(() => {
    const list = [...itemsFilteredByType];
    if (sortBy === "for_you") {
      if (list.length === 0) return list;
      const nowMs = Date.now();
      const recencyScores = list.map((i) => recencyDecayScore(new Date(i.post.created_at).getTime(), nowMs));
      const minRec = Math.min(...recencyScores);
      const maxRec = Math.max(...recencyScores);
      const maxLikes = Math.max(1, ...list.map((i) => getLikeState(i.post.id).likeCount));
      const maxComments = Math.max(1, ...list.map((i) => getCommentCount(i.post.id)));
      const velocityValues = list.map((i) => engagementVelocityByPostId[i.post.id] ?? 0);
      const maxVelocity = Math.max(1, ...velocityValues);
      const depthValues = list.map((i) => (commentDepthByPostId[i.post.id]?.total ?? 0) + (commentDepthByPostId[i.post.id]?.replyCount ?? 0) * 0.5);
      const maxDepth = Math.max(1, ...depthValues);
      const watchValues = list.map((i) => watchTimeByPostId[i.post.id] ?? 0);
      const maxWatch = Math.max(1, ...watchValues);
      const W = FEED_RANKING_WEIGHTS;
      const wLikes = 0.1;
      const wComments = 0.1;
      return list
        .map((item) => {
          const t = new Date(item.post.created_at).getTime();
          const recencyNorm = maxRec > minRec ? normalize(recencyDecayScore(t, nowMs), minRec, maxRec) : 1;
          const likeNorm = getLikeState(item.post.id).likeCount / maxLikes;
          const commentNorm = getCommentCount(item.post.id) / maxComments;
          const velocityNorm = (engagementVelocityByPostId[item.post.id] ?? 0) / maxVelocity;
          const depthNorm = maxDepth > 0
            ? ((commentDepthByPostId[item.post.id]?.total ?? 0) + (commentDepthByPostId[item.post.id]?.replyCount ?? 0) * 0.5) / maxDepth
            : 0;
          const watchNorm = (watchTimeByPostId[item.post.id] ?? 0) / maxWatch;
          const followBoost = followingIds.has(item.post.user_id) ? 1 : 0;
          const repNorm = item.profile
            ? reputationScoreFn(item.profile.reputation_score, item.profile.verified_tier)
            : 0;
          const geoBoost = nearbyPostIdsSet.has(item.post.id) ? 1 : 0;
          const purchaseBoost = purchasedCreatorIds.has(item.post.user_id) ? 1 : 0;
          const sponsoredBoost = item.post.is_sponsored ? 1 : 0;
          const matchesMore = postMatchesTopics(item.post, algorithmSeeMore);
          const matchesLess = postMatchesTopics(item.post, algorithmSeeLess);
          const tokenBoost = user?.id ? getTokenBoost(user.id, item.post.id) : 0;
          const score =
            W.recencyDecay * recencyNorm +
            W.follow * followBoost +
            W.engagementVelocity * velocityNorm +
            W.commentDepth * depthNorm +
            W.watchTime * watchNorm +
            wLikes * likeNorm +
            wComments * commentNorm +
            W.reputation * repNorm +
            W.geo * geoBoost +
            W.purchaseBehavior * purchaseBoost +
            W.sponsored * sponsoredBoost +
            W.seeMore * (matchesMore ? 1 : 0) +
            W.seeLess * (matchesLess ? 1 : 0) +
            W.token * tokenBoost;
          return { item, score };
        })
        .sort((a, b) => b.score - a.score)
        .map((x) => x.item);
    }
    if (sortBy === "random") {
      const reposted: FeedPost[] = [];
      const rest: FeedPost[] = [];
      list.forEach((item) => {
        if (getRepostState(item.post.id).isReposted) reposted.push(item);
        else rest.push(item);
      });
      return [...reposted, ...shuffleArray(rest)];
    }
    return list.sort((a, b) => {
      const aReposted = getRepostState(a.post.id).isReposted;
      const bReposted = getRepostState(b.post.id).isReposted;
      if (aReposted && !bReposted) return -1;
      if (!aReposted && bReposted) return 1;
      if (sortBy === "most_liked") {
        const aLikes = getLikeState(a.post.id).likeCount;
        const bLikes = getLikeState(b.post.id).likeCount;
        if (aLikes !== bLikes) return bLikes - aLikes;
      }
      if (sortBy === "most_commented") {
        const aComments = getCommentCount(a.post.id);
        const bComments = getCommentCount(b.post.id);
        if (aComments !== bComments) return bComments - aComments;
      }
      const aTime = new Date(a.post.created_at).getTime();
      const bTime = new Date(b.post.created_at).getTime();
      if (sortBy === "oldest") return aTime - bTime;
      return bTime - aTime;
    });
  }, [
    itemsFilteredByType,
    getRepostState,
    sortBy,
    getLikeState,
    getCommentCount,
    followingIds,
    nearbyPostIdsSet,
    purchasedCreatorIds,
    engagementVelocityByPostId,
    commentDepthByPostId,
    watchTimeByPostId,
    algorithmSeeMore,
    algorithmSeeLess,
    user?.id,
  ]);

  const feedItems = useMemo(() => {
    const list = sortedItems;
    if (algorithmSeeMore.length === 0 && algorithmSeeLess.length === 0) return list;
    const seeMoreOnly: FeedPost[] = [];
    const neutral: FeedPost[] = [];
    const seeLessGroup: FeedPost[] = [];
    for (const item of list) {
      const matchesMore = postMatchesTopics(item.post, algorithmSeeMore);
      const matchesLess = postMatchesTopics(item.post, algorithmSeeLess);
      if (matchesLess && algorithmSeeLess.length > 0) seeLessGroup.push(item);
      else if (matchesMore && algorithmSeeMore.length > 0) seeMoreOnly.push(item);
      else neutral.push(item);
    }
    return [...seeMoreOnly, ...neutral, ...seeLessGroup];
  }, [sortedItems, algorithmSeeMore, algorithmSeeLess]);

  const filteredFeedItems = useMemo(
    () =>
      feedItems.filter(
        (i) => !hiddenPostIds.has(i.post.id) && !blockedUserIds.includes(i.post.user_id)
      ),
    [feedItems, hiddenPostIds, blockedUserIds]
  );

  const mergedFeedItems = useMemo((): FeedItem[] => {
    const feedIds = new Set(filteredFeedItems.map((i) => i.post.id));
    const sponsoredOnly = sponsoredPosts.filter(
      (s) => !feedIds.has(s.post.id) && !hiddenPostIds.has(s.post.id) && !blockedUserIds.includes(s.post.user_id)
    );
    const list: FeedItem[] = [];
    let sIdx = 0;
    for (let i = 0; i < filteredFeedItems.length; i++) {
      const insertSponsored =
        sIdx < sponsoredOnly.length &&
        ((i + 1) === 5 || (i + 1) === 9 || ((i + 1) > 10 && (i + 1 - 10) % 8 === 0));
      if (insertSponsored && sponsoredOnly[sIdx]) {
        list.push({ ...sponsoredOnly[sIdx], isSponsored: true });
        sIdx++;
      }
      list.push({ ...filteredFeedItems[i], isSponsored: filteredFeedItems[i].post.is_sponsored ?? false });
    }
    return list;
  }, [filteredFeedItems, sponsoredPosts, hiddenPostIds, blockedUserIds]);

  useEffect(() => {
    mergedFeedItemsRef.current = mergedFeedItems;
  }, [mergedFeedItems]);

  useEffect(() => {
    if (!isScreenFocused && feedPreviousIndexRef.current !== null && feedPreviousIndexRef.current >= 0) {
      const list = mergedFeedItemsRef.current;
      const item = list[feedPreviousIndexRef.current];
      if (item && (Date.now() - feedFocusStartRef.current) / 1000 >= 1) {
        reportPostWatch(item.post.id, user?.id ?? null, (Date.now() - feedFocusStartRef.current) / 1000).catch(
          () => {}
        );
      }
      feedPreviousIndexRef.current = null;
    }
  }, [isScreenFocused, user?.id]);

  const listHeaderHeight = 0;

  const handleTrendingPostPress = useCallback(
    (postId: string) => {
      const index = mergedFeedItems.findIndex((i) => i.post.id === postId);
      if (index >= 0 && feedListRef.current) {
        const offset = paddingVertical + listHeaderHeight + index * slotHeight;
        feedListRef.current.scrollToOffset({ offset, animated: true });
      }
    },
    [mergedFeedItems, listHeaderHeight, paddingVertical, slotHeight]
  );

  const handleSearchSubmit = useCallback(async () => {
    const q = searchQuery.trim().replace(/^#+/, "").toLowerCase();
    if (!q || !supabase) return;
    const { data } = await supabase
      .from("hashtags")
      .select("name")
      .ilike("name", `%${q}%`)
      .limit(5);
    const first = (data ?? [])[0] as { name: string } | undefined;
    if (first) router.push({ pathname: "/tag/[name]", params: { name: first.name } });
  }, [searchQuery, router]);

  const handleShare = useCallback((_postId: string, title: string | null) => {
    Share.share({ message: title ?? "Check out this post" }).catch(() => {});
  }, []);

  const handleFollow = useCallback(
    async (userId: string) => {
      if (!user?.id || !supabase || userId === user.id) return;
      const following = followingIds.has(userId);
      if (following) {
        await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
        setFollowingIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      } else {
        await supabase.from("follows").insert({ follower_id: user.id, following_id: userId });
        setFollowingIds((prev) => new Set([...prev, userId]));
      }
    },
    [user?.id, followingIds]
  );

  const handleReportUser = useCallback((userId: string) => {
    setReportTargetUserId(userId);
  }, []);

  const handleBlockUser = useCallback(
    (userId: string) => {
      Alert.alert("Block user?", "You won't see posts from this user.", [
        { text: "Cancel", style: "cancel" },
        { text: "Block", style: "destructive", onPress: () => blockUser(userId) },
      ]);
    },
    [blockUser]
  );

  const handleHidePost = useCallback((postId: string) => {
    setHiddenPostIds((prev) => new Set([...prev, postId]));
  }, []);

  const handleDeletePost = useCallback(
    async (postId: string) => {
      if (!supabase) return;
      await supabase.from("posts").delete().eq("id", postId);
      setItems((prev) => prev.filter((i) => i.post.id !== postId));
      setTrendingPosts((prev) => prev.filter((i) => i.post.id !== postId));
      setNearbyPosts((prev) => prev.filter((i) => i.post.id !== postId));
      setSponsoredPosts((prev) => prev.filter((i) => i.post.id !== postId));
    },
    []
  );

  const handlePressCreator = useCallback(
    (userId: string) => {
      router.push(`/creator/${userId}`);
    },
    [router]
  );

  const handleLike = useCallback(
    async (postId: string) => {
      if (getDislikeState(postId).isDisliked) await toggleDislike(postId);
      toggleLike(postId);
    },
    [getDislikeState, toggleDislike, toggleLike]
  );

  const handleDislike = useCallback(
    async (postId: string) => {
      if (getLikeState(postId).isLiked) await toggleLike(postId);
      toggleDislike(postId);
    },
    [getLikeState, toggleLike, toggleDislike]
  );

  const handleRequestTip = useCallback((postTitle?: string) => {
    setTipForPostTitle(postTitle);
    setTipModalVisible(true);
  }, []);

  if (loading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <View className="flex-row items-center gap-2 border-b border-zinc-800 bg-zinc-800/80 px-3 py-2">
        <View className="flex-1 flex-row items-center rounded-lg bg-zinc-900 px-3 py-2.5">
          <Ionicons name="search-outline" size={20} color="#71717a" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search posts and #hashtags"
            placeholderTextColor="#71717a"
            className="ml-2 flex-1 text-base text-zinc-100"
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
          />
        </View>
        <Pressable
          onPress={() => setAlgorithmModalVisible(true)}
          className="h-10 w-10 items-center justify-center rounded-lg bg-zinc-700"
          accessibilityRole="button"
          accessibilityLabel="Filter"
        >
          <Ionicons name="filter-outline" size={20} color="#e4e4e7" />
        </Pressable>
      </View>
      {selectedCommunity ? (
        <View className="flex-row items-center justify-between border-b border-zinc-800 bg-zinc-800/60 px-3 py-2">
          <Text className="text-sm text-zinc-300" numberOfLines={1}>
            Viewing {selectedCommunity.displayName}&apos;s community
          </Text>
          <Pressable onPress={() => setSelectedCommunityId(null)} className="rounded-full p-2">
            <Ionicons name="close" size={20} color="#71717a" />
          </Pressable>
        </View>
      ) : null}
      <Modal
        visible={algorithmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAlgorithmModalVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-center items-center px-6"
          onPress={() => setAlgorithmModalVisible(false)}
        >
          <View className="bg-zinc-900 rounded-xl border border-zinc-700 w-full max-w-sm overflow-hidden">
            <View className="flex-row items-center justify-between border-b border-zinc-700 px-4 py-3">
              <Text className="text-base font-semibold text-zinc-100">Feed algorithm</Text>
              <Pressable onPress={() => setAlgorithmModalVisible(false)} className="p-2">
                <Ionicons name="close" size={22} color="#71717a" />
              </Pressable>
            </View>
            <View className="py-2">
              <Pressable
                onPress={() => {
                  setAlgorithmModalVisible(false);
                  router.push("/algorithm");
                }}
                className="flex-row items-center justify-between px-4 py-3 active:bg-zinc-800 border-b border-zinc-800"
              >
                <Text className="text-zinc-100">Your algorithm</Text>
                <Ionicons name="chevron-forward" size={20} color="#71717a" />
              </Pressable>
              {FEED_SORT_OPTIONS.map(({ key, label }) => (
                <Pressable
                  key={key}
                  onPress={() => {
                    setSortByAndPersist(key);
                    setAlgorithmModalVisible(false);
                  }}
                  className="flex-row items-center justify-between px-4 py-3 active:bg-zinc-800"
                >
                  <Text className="text-zinc-100">{label}</Text>
                  {sortBy === key ? (
                    <Ionicons name="checkmark-circle" size={22} color="#a78bfa" />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
      <FlatList
        ref={feedListRef}
        data={mergedFeedItems}
        keyExtractor={(item, index) => `${item.post.id}-${index}`}
        ListHeaderComponent={null}
        pagingEnabled
        snapToInterval={slotHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        windowSize={3}
        maxToRenderPerBatch={2}
        getItemLayout={(_, index) => {
          return {
            length: contentSlotHeight,
            offset: paddingVertical + listHeaderHeight + index * slotHeight,
            index,
          };
        }}
        ItemSeparatorComponent={() => <View style={{ height: gapHeight }} />}
        contentContainerStyle={
          mergedFeedItems.length === 0
            ? { flexGrow: 1, justifyContent: "center" as const }
            : {
                width: screenWidth,
                alignItems: "center",
              }
        }
        viewabilityConfig={feedViewabilityConfig}
        onViewableItemsChanged={onFeedViewableItemsChanged}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" />
        }
        ListEmptyComponent={
          <View
            style={{
              minHeight: viewHeight,
              width: cardWidth,
              justifyContent: "center",
            }}
          >
            <EmptyState message="No posts yet. Create one to get started." />
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={{ height: contentSlotHeight, width: screenWidth, alignItems: "center" }}>
            <FeedItemWithSwipes
              item={item}
              isSponsored={item.isSponsored}
              isFocused={isScreenFocused && index === focusedFeedIndex}
              cardWidth={cardWidth}
              itemHeight={itemHeight}
            getLikeState={getLikeState}
            getDislikeState={getDislikeState}
            getRepostState={getRepostState}
            getCommentCount={getCommentCount}
            savedPostIds={savedPostIds}
            handlePressCreator={handlePressCreator}
            handleLike={handleLike}
            handleDislike={handleDislike}
            handleShare={handleShare}
            handleRequestTip={handleRequestTip}
            toggleRepost={toggleRepost}
            toggleSavePost={toggleSavePost}
            refreshCommentCounts={refreshCommentCounts}
            onRandomPostsLoaded={handleRandomPostsLoaded}
            onReportUser={handleReportUser}
            onBlockUser={handleBlockUser}
            onHidePost={handleHidePost}
            onDeletePost={handleDeletePost}
            onFollow={handleFollow}
            isFollowing={(userId) => followingIds.has(userId)}
            />
          </View>
        )}
      />
      <ReportProfileModal
        visible={reportTargetUserId !== null}
        reportedId={reportTargetUserId}
        onClose={() => setReportTargetUserId(null)}
      />
      <TipModal
        visible={tipModalVisible}
        forPostTitle={tipForPostTitle}
        onClose={() => {
          setTipModalVisible(false);
          setTipForPostTitle(undefined);
        }}
      />
    </View>
  );
}
