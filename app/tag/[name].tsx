import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { FeedRandomPostsCarousel } from "../../components/FeedRandomPostsCarousel";
import { FeedUserCard } from "../../components/FeedUserCard";
import { PostCard } from "../../components/PostCard";
import { PostPreviewCard } from "../../components/PostPreviewCard";
import { TipModal } from "../../components/TipModal";
import { useAuth } from "../../context/AuthContext";
import { usePostCommentCounts } from "../../hooks/usePostCommentCounts";
import { usePostDislikes } from "../../hooks/usePostDislikes";
import { usePostLikes } from "../../hooks/usePostLikes";
import { usePostReposts } from "../../hooks/usePostReposts";
import supabase from "../../lib/supabase";
import type { ProfileRow, PostRow } from "../../lib/supabase-profiles";
import { useProfile } from "../../context/ProfileContext";

const GRID_PADDING = 16;
const GRID_GAP = 8;
const NUM_COLUMNS = 5;

type TagPostItem = {
  post: PostRow;
  profile: ProfileRow | null;
};

function TagReelsRow({
  item,
  index,
  isFocused,
  cardWidth,
  itemHeight,
  getLikeState,
  getDislikeState,
  getRepostState,
  getCommentCount,
  safeSavedPostIds,
  handlePressCreator,
  handlePressHashtag,
  handleRequestTip,
  toggleLike,
  toggleDislike,
  toggleRepost,
  toggleSavePost,
  refreshCommentCounts,
}: {
  item: TagPostItem;
  index: number;
  isFocused: boolean;
  cardWidth: number;
  itemHeight: number;
  getLikeState: (id: string) => { isLiked: boolean; likeCount: number };
  getDislikeState: (id: string) => { isDisliked: boolean; dislikeCount: number };
  getRepostState: (id: string) => { isReposted: boolean; repostCount: number };
  getCommentCount: (id: string) => number;
  safeSavedPostIds: string[];
  handlePressCreator: (userId: string) => void;
  handlePressHashtag: (tag: string) => void;
  handleRequestTip: (postTitle?: string) => void;
  toggleLike: (postId: string) => void;
  toggleDislike: (postId: string) => void;
  toggleRepost: (postId: string) => void;
  toggleSavePost: (postId: string) => void;
  refreshCommentCounts: () => void;
}) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [isCenterSlideVisible, setIsCenterSlideVisible] = useState(true);
  const lastCenterVisibleRef = useRef(true);
  const { post, profile } = item;

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

  const handleShare = useCallback((postId: string, title: string | null) => {
    const text = title?.trim() || "Check out this post on Hubble";
    Share.share({ message: text }).catch(() => {});
  }, []);

  const { isLiked, likeCount } = getLikeState(post.id);
  const { isDisliked, dislikeCount } = getDislikeState(post.id);
  const { isReposted, repostCount } = getRepostState(post.id);

  return (
    <View style={{ width: cardWidth, height: itemHeight }}>
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
        onMomentumScrollEnd={(e) => updateCenterVisible(e.nativeEvent.contentOffset.x)}
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
            onPressCreator={handlePressCreator}
            onPressHashtag={handlePressHashtag}
            onLike={() => toggleLike(post.id)}
            onDislike={() => toggleDislike(post.id)}
            onShare={() => handleShare(post.id, post.title)}
            onRepost={() => toggleRepost(post.id)}
            onSave={() => toggleSavePost(post.id)}
            onTip={() => handleRequestTip(post.title ?? undefined)}
            showTip
            isLiked={isLiked}
            likeCount={likeCount}
            isDisliked={isDisliked}
            dislikeCount={dislikeCount}
            isReposted={isReposted}
            repostCount={repostCount}
            commentCount={getCommentCount(post.id)}
            onCommentAdded={refreshCommentCounts}
            isSaved={safeSavedPostIds.includes(post.id)}
            fillContainer
            layout="reels"
            shouldPlayVideo={isFocused && isCenterSlideVisible}
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
            savedPostIds={safeSavedPostIds}
            handlePressCreator={handlePressCreator}
            handleLike={toggleLike}
            handleDislike={toggleDislike}
            handleShare={handleShare}
            handleRequestTip={handleRequestTip}
            toggleRepost={toggleRepost}
            toggleSavePost={toggleSavePost}
            refreshCommentCounts={refreshCommentCounts}
            onPostsLoaded={() => {}}
            excludePostIds={[post.id]}
            creatorId={post.user_id}
          />
        </View>
      </ScrollView>
    </View>
  );
}

export default function TagFeedScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { savedPostIds, toggleSavePost } = useProfile();
  const tagName = (name ?? "").trim().toLowerCase();
  const [items, setItems] = useState<TagPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TagPostItem | null>(null);
  const [focusedTagIndex, setFocusedTagIndex] = useState<number | null>(0);
  const [tipModalVisible, setTipModalVisible] = useState(false);
  const [tipForPostTitle, setTipForPostTitle] = useState<string | undefined>(undefined);
  const { width, height } = useWindowDimensions();
  const tagModalScale = 0.75;
  const tagModalCardWidth = width * tagModalScale;
  const tagModalItemHeight = height * tagModalScale;
  const tagModalSlotHeight = height;
  const tagViewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;
  const onTagViewableItemsChanged = useCallback(
    (info: { viewableItems: Array<{ index: number | null }> }) => {
      const first = info.viewableItems[0];
      const idx = first?.index;
      setFocusedTagIndex(idx != null ? idx : null);
    },
    []
  );
  const handleRequestTip = useCallback((postTitle?: string) => {
    setTipForPostTitle(postTitle);
    setTipModalVisible(true);
  }, []);
  const contentWidth = width > 0 ? width - GRID_PADDING * 2 : 0;
  const columnWidth =
    contentWidth > 0 ? (contentWidth - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS : 60;
  const cellHeight = columnWidth * 1.15;

  const rows: TagPostItem[][] = [];
  for (let i = 0; i < items.length; i += NUM_COLUMNS) {
    rows.push(items.slice(i, i + NUM_COLUMNS));
  }

  const fetchPosts = useCallback(async () => {
    if (!supabase || !tagName) {
      setItems([]);
      return;
    }
    const { data: tagRow } = await supabase.from("hashtags").select("id").eq("name", tagName).maybeSingle();
    if (!tagRow?.id) {
      setItems([]);
      return;
    }
    const { data: phRows } = await supabase
      .from("post_hashtags")
      .select("post_id")
      .eq("hashtag_id", tagRow.id);
    const postIds = (phRows ?? []).map((r: { post_id: string }) => r.post_id);
    if (postIds.length === 0) {
      setItems([]);
      return;
    }
    const { data: postsData } = await supabase
      .from("posts")
      .select("*, profiles!user_id(display_name, username, avatar_url)")
      .in("id", postIds)
      .order("created_at", { ascending: false });
    const list: TagPostItem[] = (postsData ?? []).map((row: Record<string, unknown>) => ({
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
    setItems(list);
  }, [tagName]);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    await fetchPosts();
    if (showRefresh) setRefreshing(false);
    else setLoading(false);
  }, [fetchPosts]);

  useEffect(() => {
    load();
  }, [load]);

  const postIds = items.map((i) => i.post.id);
  const { getState: getLikeState, toggleLike } = usePostLikes(postIds);
  const { getState: getDislikeState, toggleDislike } = usePostDislikes(postIds);
  const { getState: getRepostState, toggleRepost } = usePostReposts(postIds);
  const { getCommentCount, refresh: refreshCommentCounts } = usePostCommentCounts(postIds);
  const safeSavedPostIds = savedPostIds ?? [];

  const handlePressCreator = useCallback(
    (userId: string) => router.push({ pathname: "/creator/[id]", params: { id: userId } }),
    [router]
  );

  const handlePressHashtag = useCallback(
    (tag: string) => router.push({ pathname: "/tag/[name]", params: { name: tag } }),
    [router]
  );

  if (loading && items.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: tagName ? `#${tagName}` : "Tag" }} />
        <View className="flex-1 bg-zinc-950 items-center justify-center">
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: tagName ? `#${tagName}` : "Tag" }} />
      <View className="flex-1 bg-zinc-950">
        <View className="border-b border-zinc-800 px-4 py-3">
        <Text className="text-xl font-bold text-zinc-100">#{tagName || "tag"}</Text>
        <Text className="text-sm text-zinc-500">
          {items.length} {items.length === 1 ? "post" : "posts"}
        </Text>
      </View>
      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-4">
          <Ionicons name="pricetag-outline" size={48} color="#52525b" />
          <Text className="mt-2 text-center text-zinc-500">No posts with this tag yet.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.map((i) => i.post.id).join("-")}
          contentContainerStyle={{ padding: GRID_PADDING, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={["#a78bfa"]} />}
          renderItem={({ item: row }) => (
            <View style={{ flexDirection: "row", marginBottom: GRID_GAP }}>
              {row.map((item, colIndex) => (
                <View
                  key={item.post.id}
                  style={{
                    width: columnWidth,
                    height: cellHeight,
                    marginRight: colIndex < row.length - 1 ? GRID_GAP : 0,
                  }}
                >
                  <PostPreviewCard
                    post={{
                      id: item.post.id,
                      type: item.post.type,
                      title: item.post.title,
                      body: item.post.body,
                      mediaUri: item.post.media_uri,
                    }}
                    onPress={() => setSelectedItem(item)}
                    cardWidth={columnWidth}
                    cardHeight={cellHeight}
                  />
                </View>
              ))}
            </View>
          )}
        />
      )}

      <Modal visible={!!selectedItem} transparent animationType="fade">
        <View className="flex-1 bg-black">
          <TouchableOpacity
            onPress={() => setSelectedItem(null)}
            className="absolute top-12 right-4 z-10 rounded-full bg-black/50 p-2"
          >
            <Ionicons name="close" size={28} color="#e4e4e7" />
          </TouchableOpacity>
          {selectedItem && items.length > 0 && (
            <FlatList
              data={items}
              keyExtractor={(i) => i.post.id}
              initialScrollIndex={Math.min(
                Math.max(0, items.findIndex((i) => i.post.id === selectedItem.post.id)),
                Math.max(0, items.length - 1)
              )}
              initialNumToRender={Math.min(items.length, 3)}
              getItemLayout={(_, index) => ({
                length: tagModalSlotHeight,
                offset: index * tagModalSlotHeight,
                index,
              })}
              pagingEnabled
              snapToInterval={tagModalSlotHeight}
              snapToAlignment="start"
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              viewabilityConfig={tagViewabilityConfig}
              onViewableItemsChanged={onTagViewableItemsChanged}
              renderItem={({ item, index }) => (
                <View style={{ width, height: tagModalSlotHeight, justifyContent: "center", alignItems: "center" }}>
                  <TagReelsRow
                    item={item}
                    index={index}
                    isFocused={focusedTagIndex === index}
                    cardWidth={tagModalCardWidth}
                    itemHeight={tagModalItemHeight}
                  getLikeState={getLikeState}
                  getDislikeState={getDislikeState}
                  getRepostState={getRepostState}
                  getCommentCount={getCommentCount}
                  safeSavedPostIds={safeSavedPostIds}
                  handlePressCreator={handlePressCreator}
                  handlePressHashtag={handlePressHashtag}
                  handleRequestTip={handleRequestTip}
                  toggleLike={toggleLike}
                  toggleDislike={toggleDislike}
                  toggleRepost={toggleRepost}
                  toggleSavePost={toggleSavePost}
                  refreshCommentCounts={refreshCommentCounts}
                  />
                </View>
              )}
            />
          )}
        </View>
      </Modal>
      <TipModal
        visible={tipModalVisible}
        forPostTitle={tipForPostTitle}
        onClose={() => {
          setTipModalVisible(false);
          setTipForPostTitle(undefined);
        }}
      />
      </View>
    </>
  );
}
