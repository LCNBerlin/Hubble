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
import { EmptyState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useCommunityStore } from "../../store/community-store";
import { useSavedDataQuery } from "../../hooks/useProfileQuery";
import { useToggleSavePostMutation, useBlockMutation } from "../../hooks/useProfileMutations";
import { usePostEngagement } from "../../hooks/usePostEngagement";
import { postMatchesTopics } from "../../lib/feed-ranking";
import { reportPostWatch } from "../../lib/postWatchTime";
import { apiGet, apiPost, apiDelete } from "../../lib/api";
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

type FlatFeedPost = PostRow & { place_name?: string | null; hashtags?: string[]; username?: string | null; display_name?: string | null; avatar_url?: string | null; reputation_score?: number | null; verified_tier?: string | null };

type FeedPost = {
  post: PostRow & { place_name?: string | null; hashtags?: string[] };
  profile: ProfileRow | null;
};

type FeedItem = FeedPost & { isSponsored: boolean };

function flatToFeedPost(row: FlatFeedPost): FeedPost {
  return {
    post: row,
    profile: row.username || row.display_name ? ({
      id: row.user_id,
      display_name: row.display_name ?? null,
      username: row.username ?? "",
      avatar_url: row.avatar_url ?? null,
      bio: null,
      banner_url: null,
      followers_count: 0,
      following_count: 0,
      created_at: "",
      updated_at: "",
      reputation_score: row.reputation_score ?? null,
      verified_tier: row.verified_tier ?? null,
    } as ProfileRow) : null,
  };
}

async function fetchTrendingPosts(limit: number): Promise<FeedPost[]> {
  try {
    const data = await apiGet<FlatFeedPost[]>(`/feed/trending/posts?hours=48&limit=${limit}`);
    return (data ?? []).map(flatToFeedPost);
  } catch { return []; }
}

async function fetchTrendingHashtags(limit: number): Promise<{ name: string; post_count: number }[]> {
  try {
    const data = await apiGet<{ name: string; count: number }[]>(`/feed/trending/hashtags?days=7&limit=${limit}`);
    return (data ?? []).map((r) => ({ name: r.name, post_count: Number(r.count) }));
  } catch { return []; }
}

const TRENDING_STRIP_ITEM_WIDTH = 120;
const TRENDING_STRIP_ITEM_HEIGHT = 100;
const TRENDING_STRIP_GAP = 8;

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
        {posts.map(({ post }) => {
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
  const { user } = useAuth();
  const { selectedCommunityId, selectedCommunity, setSelectedCommunityId } = useCommunityStore();
  const { data: savedData } = useSavedDataQuery(user?.id);
  const savedPostIds = savedData?.postIds ?? [];
  const blockedUserIds = savedData?.blockedIds ?? [];
  const toggleSavePostMutation = useToggleSavePostMutation();
  const toggleSavePost = (postId: string) => toggleSavePostMutation.mutate(postId);
  const blockMutation = useBlockMutation();
  const blockUser = (userId: string) => blockMutation.mutate(userId);
  const [reportTargetUserId, setReportTargetUserId] = useState<string | null>(null);
  const [hiddenPostIds, setHiddenPostIds] = useState<Set<string>>(() => new Set());
  const [items, setItems] = useState<FeedPost[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<FeedPost[]>([]);
  const [trendingHashtags, setTrendingHashtags] = useState<{ name: string; post_count: number }[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
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
    const limit = sortBy === "for_you" ? 50 : 100;
    try {
      const qs = new URLSearchParams({ limit: String(limit) });
      if (selectedCommunityId) qs.set("creatorId", selectedCommunityId);
      const data = await apiGet<FlatFeedPost[]>(`/feed?${qs.toString()}`);
      let list: FeedPost[] = (data ?? []).map(flatToFeedPost);
      if (sortBy === "random") list = shuffleArray(list).slice(0, 50);
      setItems(list);
    } catch {
      setItems([]);
    }
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
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    apiGet<string[]>("/profiles/me/following-ids")
      .then((data) => setFollowingIds(new Set(data ?? [])))
      .catch(() => {});
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchFeed(),
      fetchTrendingPosts(10).then(setTrendingPosts),
      fetchTrendingHashtags(10).then(setTrendingHashtags),
    ]);
    setRefreshing(false);
  }, [fetchFeed]);

  const postIds = useMemo(() => items.map((i) => i.post.id), [items]);

  const [randomPostIds, setRandomPostIds] = useState<string[]>([]);
  const trendingPostIds = useMemo(() => trendingPosts.map((i) => i.post.id), [trendingPosts]);
  const allPostIds = useMemo(
    () => [...new Set([...postIds, ...randomPostIds, ...trendingPostIds])],
    [postIds, randomPostIds, trendingPostIds]
  );
  const { getEngagement, toggleLike, toggleDislike, toggleRepost, refresh: refreshEngagement } = usePostEngagement(allPostIds);

  const handleRandomPostsLoaded = useCallback((ids: string[]) => {
    setRandomPostIds((prev) => [...new Set([...prev, ...ids])]);
  }, []);

  const itemsFilteredByType = useMemo(() => {
    if (algorithmPostTypes.length === 0) return items;
    return items.filter((i) => algorithmPostTypes.includes(i.post.type));
  }, [items, algorithmPostTypes]);

  const sortedItems = useMemo(() => {
    const list = [...itemsFilteredByType];
    if (sortBy === "for_you") return list;
    if (sortBy === "random") {
      const reposted: FeedPost[] = [];
      const rest: FeedPost[] = [];
      list.forEach((item) => {
        if (getEngagement(item.post.id).isReposted) reposted.push(item);
        else rest.push(item);
      });
      return [...reposted, ...shuffleArray(rest)];
    }
    return list.sort((a, b) => {
      const aReposted = getEngagement(a.post.id).isReposted;
      const bReposted = getEngagement(b.post.id).isReposted;
      if (aReposted && !bReposted) return -1;
      if (!aReposted && bReposted) return 1;
      if (sortBy === "most_liked") {
        const aLikes = getEngagement(a.post.id).likeCount;
        const bLikes = getEngagement(b.post.id).likeCount;
        if (aLikes !== bLikes) return bLikes - aLikes;
      }
      if (sortBy === "most_commented") {
        const aComments = getEngagement(a.post.id).commentCount;
        const bComments = getEngagement(b.post.id).commentCount;
        if (aComments !== bComments) return bComments - aComments;
      }
      const aTime = new Date(a.post.created_at).getTime();
      const bTime = new Date(b.post.created_at).getTime();
      if (sortBy === "oldest") return aTime - bTime;
      return bTime - aTime;
    });
  }, [itemsFilteredByType, getEngagement, sortBy]);

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

  const mergedFeedItems = useMemo((): FeedItem[] =>
    filteredFeedItems.map((item) => ({ ...item, isSponsored: item.post.is_sponsored ?? false })),
    [filteredFeedItems]);

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

  const handleSearchSubmit = useCallback(() => {
    const q = searchQuery.trim().replace(/^#+/, "").toLowerCase();
    if (!q) return;
    router.push({ pathname: "/tag/[name]", params: { name: q } });
  }, [searchQuery, router]);

  const handleShare = useCallback((_postId: string, title: string | null) => {
    Share.share({ message: title ?? "Check out this post" }).catch(() => {});
  }, []);

  const handleFollow = useCallback(
    async (userId: string) => {
      if (!user?.id || userId === user.id) return;
      const following = followingIds.has(userId);
      if (following) {
        await apiDelete(`/profiles/${userId}/follow`).catch(() => {});
        setFollowingIds((prev) => { const next = new Set(prev); next.delete(userId); return next; });
      } else {
        await apiPost(`/profiles/${userId}/follow`).catch(() => {});
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
      await apiDelete(`/posts/${postId}`).catch(() => {});
      setItems((prev) => prev.filter((i) => i.post.id !== postId));
      setTrendingPosts((prev) => prev.filter((i) => i.post.id !== postId));
    },
    []
  );

  const handlePressCreator = useCallback(
    (userId: string) => {
      router.push(`/creator/${userId}`);
    },
    [router]
  );

  const handleLike = toggleLike;
  const handleDislike = toggleDislike;

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
              getLikeState={getEngagement}
              getDislikeState={getEngagement}
              getRepostState={getEngagement}
              getCommentCount={(id) => getEngagement(id).commentCount}
              savedPostIds={savedPostIds}
              handlePressCreator={handlePressCreator}
              handleLike={handleLike}
              handleDislike={handleDislike}
              handleShare={handleShare}
              handleRequestTip={handleRequestTip}
              toggleRepost={toggleRepost}
              toggleSavePost={toggleSavePost}
              refreshCommentCounts={refreshEngagement}
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
