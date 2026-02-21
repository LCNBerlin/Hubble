import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { PostCard } from "./PostCard";
import supabase from "../lib/supabase";
import type { ProfileRow, PostRow } from "../lib/supabase-profiles";

const RANDOM_BATCH_SIZE = 20;
const RANDOM_FETCH_LIMIT = 100;

export type FeedPostCarouselItem = {
  post: PostRow & { place_name?: string | null; hashtags?: string[] };
  profile: ProfileRow | null;
};

export function FeedRandomPostsCarousel({
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
  onPostsLoaded,
  excludePostIds,
  creatorId,
  onReportUser,
  onBlockUser,
  onHidePost,
  onDeletePost,
  onFollow,
  isFollowing,
}: {
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
  onPostsLoaded: (ids: string[]) => void;
  excludePostIds: string[];
  creatorId: string;
  onReportUser?: (userId: string) => void;
  onBlockUser?: (userId: string) => void;
  onHidePost?: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
  onFollow?: (userId: string) => void;
  isFollowing?: (userId: string) => boolean;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPostCarouselItem[]>([]);
  const [loading, setLoading] = useState(true);
  const loadingMore = useRef(false);

  const fetchBatch = useCallback(
    async (exclude: string[]) => {
      if (!supabase || !creatorId) return [];
      const query = supabase
        .from("posts")
        .select("*, profiles!user_id(display_name, username, avatar_url), post_hashtags(hashtags(name))")
        .eq("user_id", creatorId)
        .order("created_at", { ascending: false })
        .limit(RANDOM_FETCH_LIMIT);
      const { data, error } = await query;
      if (error) return [];
      const list: FeedPostCarouselItem[] = (data ?? [])
        .filter((row: Record<string, unknown>) => !exclude.includes(row.id as string))
        .map((row: Record<string, unknown>) => {
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
              place_name: (row.place_name as string | null) ?? null,
              hashtags,
              poll_options: Array.isArray(row.poll_options) ? (row.poll_options as string[]) : undefined,
            },
            profile: row.profiles as ProfileRow | null,
          };
        });
      return list.slice(0, RANDOM_BATCH_SIZE);
    },
    [creatorId]
  );

  const excludeRef = useRef(excludePostIds);
  excludeRef.current = excludePostIds;

  const loadInitial = useCallback(() => {
    setLoading(true);
    fetchBatch(excludeRef.current).then((batch) => {
      setPosts(batch);
      if (batch.length > 0) onPostsLoaded(batch.map((i) => i.post.id));
      setLoading(false);
    });
  }, [fetchBatch, onPostsLoaded]);

  const loadMore = useCallback(() => {
    if (loadingMore.current || posts.length === 0) return;
    const existingIds = posts.map((i) => i.post.id);
    const allExclude = [...new Set([...excludeRef.current, ...existingIds])];
    loadingMore.current = true;
    fetchBatch(allExclude).then((batch) => {
      if (batch.length > 0) {
        setPosts((prev) => [...prev, ...batch]);
        onPostsLoaded(batch.map((i) => i.post.id));
      }
      loadingMore.current = false;
    });
  }, [posts.length, fetchBatch, onPostsLoaded]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  if (loading && posts.length === 0) {
    return (
      <View style={{ width: cardWidth, height: itemHeight }} className="rounded-xl border border-zinc-700 bg-zinc-900 items-center justify-center">
        <ActivityIndicator size="small" color="#a78bfa" />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={{ width: cardWidth, height: itemHeight }} className="rounded-xl border border-zinc-700 bg-zinc-900 items-center justify-center">
        <Text className="text-sm text-zinc-500 text-center">No more posts from this creator</Text>
      </View>
    );
  }

  return (
    <View style={{ width: cardWidth, height: itemHeight }}>
      <FlatList
        data={posts}
        keyExtractor={(i) => i.post.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => {
          const { post, profile } = item;
          const { isLiked, likeCount } = getLikeState(post.id);
          const { isDisliked, dislikeCount } = getDislikeState(post.id);
          const { isReposted, repostCount } = getRepostState(post.id);
          return (
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
                layout="reels"
                onReportUser={onReportUser}
                onBlockUser={onBlockUser}
                onHidePost={onHidePost}
                onDeletePost={onDeletePost}
                onFollow={profile ? () => onFollow?.(post.user_id) : undefined}
                isFollowing={isFollowing?.(post.user_id)}
              />
            </View>
          );
        }}
      />
    </View>
  );
}
