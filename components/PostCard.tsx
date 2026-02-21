import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import * as Linking from "expo-linking";
import { POST_TYPE_LABELS } from "../lib/constants";
import { formatExactTimestamp } from "../lib/formatTimeAgo";
import { parseHashtagSegments } from "../lib/hashtags";
import { reportPostWatch } from "../lib/postWatchTime";
import supabase from "../lib/supabase";
import { FullscreenVideoModal } from "./FullscreenVideoModal";
import { Card, Avatar, TypeBadge, PostActionBar } from "./ui";

const MEDIA_HEIGHT_FIXED = 160;
const COMMENT_AVATAR_SIZE = 32;
const REELS_DESCRIPTION_MAX_CHARS = 50;

export type PostCardPost = {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  mediaUri: string | null;
  createdAt?: string;
  placeName?: string | null;
  hashtags?: string[];
  pollOptions?: string[];
};

export type PostCardCreator = {
  id: string;
  displayName: string;
  username: string;
  avatarUri: string | null;
};

export type PostCardProps = {
  post: PostCardPost;
  /** When set, show creator row (feed/creator page). When undefined, show current user header (profile). */
  creator?: PostCardCreator | null;
  onPressCreator?: (userId: string) => void;
  onLike?: () => void;
  onDislike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onRepost?: () => void;
  onSave?: () => void;
  onTip?: () => void;
  isLiked?: boolean;
  isDisliked?: boolean;
  isReposted?: boolean;
  isSaved?: boolean;
  likeCount?: number;
  dislikeCount?: number;
  repostCount?: number;
  commentCount?: number;
  showSave?: boolean;
  showTip?: boolean;
  /** Show "You reposted" when true (e.g. in feed after reposting). */
  repostedByMe?: boolean;
  /** When true, card fills its container (e.g. full-height feed cell). No bottom margin. */
  fillContainer?: boolean;
  /** When true, media (image/video) uses contain fit and is constrained to a max size so the full media is visible (e.g. in a popup). */
  containMedia?: boolean;
  /** When true, do not show the right label (e.g. "Public") on the action bar (e.g. in profile popup). */
  hideRightLabel?: boolean;
  /** Called after a new comment is posted (e.g. to refresh comment count). */
  onCommentAdded?: () => void;
  /** When set and equal to current user id, show Edit button on this post. */
  postUserId?: string;
  /** When set, show Delete in the post menu and call this when user confirms delete (e.g. on profile). */
  onDeletePost?: (postId: string) => void;
  /** Called when a hashtag in title/body is pressed (e.g. navigate to tag feed). */
  onPressHashtag?: (tagName: string) => void;
  /** When true, show a "Sponsored" label on the card. */
  isSponsored?: boolean;
  /** "reels" = media on top, creator + caption below, vertical action bar on right (TikTok/Reels style). */
  layout?: "default" | "reels";
  /** Optional follow button handler (reels layout). */
  onFollow?: () => void;
  /** When true, show "Following" and allow unfollow (reels layout). */
  isFollowing?: boolean;
  /** Called when user chooses Report (reels ellipsis menu). */
  onReportUser?: (userId: string) => void;
  /** Called when user chooses Block user (reels ellipsis menu). */
  onBlockUser?: (userId: string) => void;
  /** Called when user chooses Not interested (reels ellipsis menu). */
  onHidePost?: (postId: string) => void;
  /** When true, video (if any) autoplays; when false, pauses. Used by feed for viewport-based autoplay. */
  shouldPlayVideo?: boolean;
};

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  like_count: number;
  is_liked: boolean;
  dislike_count: number;
  is_disliked: boolean;
  author: {
    display_name: string | null;
    username: string;
    avatar_url: string | null;
  } | null;
};

const AVATAR_SIZE = 36;

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function PostCard({
  post,
  creator,
  onPressCreator,
  onLike,
  onDislike,
  onComment,
  onShare,
  onRepost,
  onSave,
  onTip,
  isLiked,
  isDisliked,
  isReposted,
  isSaved,
  likeCount,
  dislikeCount,
  repostCount,
  commentCount,
  showSave = true,
  showTip = false,
  repostedByMe = false,
  fillContainer = false,
  containMedia = false,
  hideRightLabel = false,
  onCommentAdded,
  postUserId,
  onDeletePost,
  onPressHashtag,
  isSponsored = false,
  layout = "default",
  onFollow,
  isFollowing = false,
  onReportUser,
  onBlockUser,
  onHidePost,
  shouldPlayVideo = false,
}: PostCardProps) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const isOwnPost = !!user?.id && !!postUserId && user.id === postUserId;
  const hitSlop = { top: 12, bottom: 12, left: 12, right: 12 };
  const mediaUri = post.mediaUri?.trim();
  const hasValidMediaUri =
    !!mediaUri && (mediaUri.startsWith("http") || mediaUri.startsWith("file"));
  const { height: windowHeight } = useWindowDimensions();
  const containedMediaMaxHeight = Math.min(windowHeight * 0.65, 500);
  const [fullscreenVideoUri, setFullscreenVideoUri] = useState<string | null>(null);
  const fullscreenOpenedAtRef = useRef<number>(0);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [repostModalVisible, setRepostModalVisible] = useState(false);
  const [repostQuote, setRepostQuote] = useState("");
  const [reelsDescriptionExpanded, setReelsDescriptionExpanded] = useState(false);
  const typeLabel = POST_TYPE_LABELS[post.type] ?? post.type;
  const displayTitle =
    post.title?.trim() && post.title.trim() !== "Untitled post" ? post.title.trim() : null;
  const displayBody = post.body?.trim() || null;
  const placeName = post.placeName?.trim() || null;
  const tagList = post.hashtags?.filter((t) => t?.trim()) ?? [];
  const videoPlayer = useVideoPlayer(
    post.type === "video" && mediaUri ? mediaUri : null,
    (player) => {
      player.loop = true;
    }
  );

  useEffect(() => {
    if (post.type !== "video" || !mediaUri) return;
    if (shouldPlayVideo) {
      videoPlayer.play();
    } else {
      videoPlayer.pause();
    }
    return () => {
      if (post.type === "video" && mediaUri) {
        try {
          videoPlayer.pause();
        } catch {
          // Player may already be disposed during unmount
        }
      }
    };
  }, [shouldPlayVideo, post.type, mediaUri, videoPlayer]);

  const handleRepostPress = useCallback(() => {
    if (isReposted) {
      onRepost?.();
      return;
    }
    setRepostQuote("");
    setRepostModalVisible(true);
  }, [isReposted, onRepost]);

  const handleRepostConfirm = useCallback(() => {
    onRepost?.();
    setRepostModalVisible(false);
    setRepostQuote("");
  }, [onRepost]);

  const fetchComments = useCallback(async (skipLoading = false) => {
    if (!supabase || !post.id) return;
    if (!skipLoading) setCommentsLoading(true);
    let rawRows: Record<string, unknown>[] = [];
    const withParent = await supabase
      .from("post_comments")
      .select("id, body, created_at, user_id, parent_id, profiles!user_id(display_name, username, avatar_url)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    if (withParent.error) {
      const withoutParent = await supabase
        .from("post_comments")
        .select("id, body, created_at, user_id, profiles!user_id(display_name, username, avatar_url)")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });
      if (withoutParent.error) {
        if (!skipLoading) setCommentsLoading(false);
        setComments([]);
        return;
      }
      rawRows = (withoutParent.data ?? []) as Record<string, unknown>[];
    } else {
      rawRows = (withParent.data ?? []) as Record<string, unknown>[];
    }
    if (!skipLoading) setCommentsLoading(false);
    const commentIds = rawRows.map((r) => r.id as string);
    let likeCountByComment: Record<string, number> = {};
    let likedCommentIds = new Set<string>();
    let dislikeCountByComment: Record<string, number> = {};
    let dislikedCommentIds = new Set<string>();
    if (commentIds.length > 0 && user?.id) {
      const [likeCountRes, myLikesRes, dislikeCountRes, myDislikesRes] = await Promise.all([
        supabase.from("comment_likes").select("comment_id").in("comment_id", commentIds),
        supabase.from("comment_likes").select("comment_id").eq("user_id", user.id).in("comment_id", commentIds),
        supabase.from("comment_dislikes").select("comment_id").in("comment_id", commentIds),
        supabase.from("comment_dislikes").select("comment_id").eq("user_id", user.id).in("comment_id", commentIds),
      ]);
      if (!likeCountRes.error) {
        (likeCountRes.data ?? []).forEach((r: { comment_id: string }) => {
          likeCountByComment[r.comment_id] = (likeCountByComment[r.comment_id] ?? 0) + 1;
        });
      }
      if (!myLikesRes.error) {
        likedCommentIds = new Set((myLikesRes.data ?? []).map((r: { comment_id: string }) => r.comment_id));
      }
      if (!dislikeCountRes.error) {
        (dislikeCountRes.data ?? []).forEach((r: { comment_id: string }) => {
          dislikeCountByComment[r.comment_id] = (dislikeCountByComment[r.comment_id] ?? 0) + 1;
        });
      }
      if (!myDislikesRes.error) {
        dislikedCommentIds = new Set((myDislikesRes.data ?? []).map((r: { comment_id: string }) => r.comment_id));
      }
    }
    const rows: CommentRow[] = rawRows.map((r) => {
      const profiles = r.profiles;
      const author = Array.isArray(profiles) ? profiles[0] : profiles;
      const id = r.id as string;
      return {
        id,
        body: r.body as string,
        created_at: r.created_at as string,
        user_id: r.user_id as string,
        parent_id: (r.parent_id as string | null) ?? null,
        like_count: likeCountByComment[id] ?? 0,
        is_liked: likedCommentIds.has(id),
        dislike_count: dislikeCountByComment[id] ?? 0,
        is_disliked: dislikedCommentIds.has(id),
        author: (author as CommentRow["author"]) ?? null,
      };
    });
    setComments(rows);
  }, [post.id, user?.id]);

  useEffect(() => {
    if (commentModalVisible && post.id) fetchComments();
    else if (!commentModalVisible) {
      setComments([]);
      setReplyingToCommentId(null);
    }
    if (!commentModalVisible) setCommentBody("");
  }, [commentModalVisible, post.id, fetchComments]);

  const submitComment = useCallback(async () => {
    const trimmed = commentBody.trim();
    if (!trimmed || commentSubmitting || !user?.id || !supabase) return;
    setCommentSubmitting(true);
    const insertPayload: { post_id: string; user_id: string; body: string; parent_id?: string } = {
      post_id: post.id,
      user_id: user.id,
      body: trimmed,
    };
    if (replyingToCommentId) insertPayload.parent_id = replyingToCommentId;
    const { error } = await supabase.from("post_comments").insert(insertPayload);
    setCommentSubmitting(false);
    if (error) return;
    setCommentBody("");
    setReplyingToCommentId(null);
    onCommentAdded?.();
    fetchComments();
  }, [commentBody, commentSubmitting, user?.id, post.id, replyingToCommentId, onCommentAdded, fetchComments]);

  const toggleCommentLike = useCallback(
    async (commentId: string) => {
      if (!supabase || !user?.id) return;
      const c = comments.find((x) => x.id === commentId);
      if (!c) return;
      const nextLiked = !c.is_liked;
      const prevState = comments.map((x) => (x.id === commentId ? { ...x } : x));
      if (nextLiked && c.is_disliked) {
        const { error: delErr } = await supabase.from("comment_dislikes").delete().eq("user_id", user.id).eq("comment_id", commentId);
        if (delErr) return;
        setComments((prev) =>
          prev.map((x) =>
            x.id === commentId
              ? {
                  ...x,
                  is_liked: true,
                  is_disliked: false,
                  like_count: x.like_count + 1,
                  dislike_count: Math.max(0, x.dislike_count - 1),
                }
              : x
          )
        );
      } else {
        setComments((prev) =>
          prev.map((x) =>
            x.id === commentId
              ? { ...x, is_liked: nextLiked, like_count: Math.max(0, x.like_count + (nextLiked ? 1 : -1)) }
              : x
          )
        );
      }
      const { error } = nextLiked
        ? await supabase.from("comment_likes").insert({ user_id: user.id, comment_id: commentId })
        : await supabase.from("comment_likes").delete().eq("user_id", user.id).eq("comment_id", commentId);
      if (error) {
        setComments(prevState);
      } else {
        fetchComments(true);
      }
    },
    [user?.id, comments, fetchComments]
  );

  const toggleCommentDislike = useCallback(
    async (commentId: string) => {
      if (!supabase || !user?.id) return;
      const c = comments.find((x) => x.id === commentId);
      if (!c) return;
      const nextDisliked = !c.is_disliked;
      const prevState = comments.map((x) => (x.id === commentId ? { ...x } : x));
      if (nextDisliked && c.is_liked) {
        const { error: delErr } = await supabase.from("comment_likes").delete().eq("user_id", user.id).eq("comment_id", commentId);
        if (delErr) return;
        setComments((prev) =>
          prev.map((x) =>
            x.id === commentId
              ? {
                  ...x,
                  is_disliked: true,
                  is_liked: false,
                  dislike_count: x.dislike_count + 1,
                  like_count: Math.max(0, x.like_count - 1),
                }
              : x
          )
        );
      } else {
        setComments((prev) =>
          prev.map((x) =>
            x.id === commentId
              ? {
                  ...x,
                  is_disliked: nextDisliked,
                  dislike_count: Math.max(0, x.dislike_count + (nextDisliked ? 1 : -1)),
                }
              : x
          )
        );
      }
      const { error } = nextDisliked
        ? await supabase.from("comment_dislikes").insert({ user_id: user.id, comment_id: commentId })
        : await supabase.from("comment_dislikes").delete().eq("user_id", user.id).eq("comment_id", commentId);
      if (error) {
        setComments(prevState);
      } else {
        fetchComments(true);
      }
    },
    [user?.id, comments, fetchComments]
  );

  const topLevelComments = comments.filter((c) => !c.parent_id);
  const repliesByParentId = comments.reduce<Record<string, CommentRow[]>>((acc, c) => {
    if (!c.parent_id) return acc;
    if (!acc[c.parent_id]) acc[c.parent_id] = [];
    acc[c.parent_id].push(c);
    return acc;
  }, {});
  const displayName = profile?.displayName ?? "User";
  const avatarUri = profile?.avatarUri ?? null;

  const headerContent =
    creator != null ? (
      <View className="flex-row items-center border-b border-zinc-700/80">
        <Pressable onPress={() => onPressCreator?.(creator.id)} className="flex-1 flex-row items-center gap-3 min-w-0">
          <Avatar uri={creator.avatarUri} size={AVATAR_SIZE} />
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-semibold text-zinc-100" numberOfLines={1}>
              {creator.displayName}
            </Text>
            {creator.username ? (
              <Text className="text-xs text-zinc-500" numberOfLines={1}>
                @{creator.username}
              </Text>
            ) : null}
          </View>
          {isSponsored ? (
            <Text className="text-[10px] text-zinc-500 font-medium mr-1">Sponsored</Text>
          ) : null}
          {post.createdAt ? (
            <Text className="text-xs text-zinc-500">{formatExactTimestamp(post.createdAt)}</Text>
          ) : null}
          <Ionicons name="chevron-forward" size={18} color="#71717a" />
        </Pressable>
        {isOwnPost && (
          <TouchableOpacity
            onPress={() => {
              if (onDeletePost) {
                Alert.alert("Post", undefined, [
                  { text: "Edit", onPress: () => router.push({ pathname: "/edit-post/[id]", params: { id: post.id } }) },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                      Alert.alert("Delete post?", "This cannot be undone.", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => onDeletePost(post.id) },
                      ]);
                    },
                  },
                  { text: "Cancel", style: "cancel" },
                ]);
              } else {
                router.push({ pathname: "/edit-post/[id]", params: { id: post.id } });
              }
            }}
            className="ml-1 p-2 rounded-full"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#71717a" />
          </TouchableOpacity>
        )}
      </View>
    ) : (
      <View className="flex-row items-center gap-2 border-b border-zinc-800/80">
        <Avatar uri={avatarUri} size={AVATAR_SIZE} />
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-semibold text-zinc-100" numberOfLines={1}>
            {displayName}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-xs text-zinc-500">Recent</Text>
            <TypeBadge label={typeLabel} typeKey={post.type} />
          </View>
        </View>
        {displayTitle ? (
          <Text className="text-xs text-zinc-400 max-w-[100px]" numberOfLines={1}>
            {displayTitle}
          </Text>
        ) : null}
        {isOwnPost && (
          <TouchableOpacity
            onPress={() => {
              if (onDeletePost) {
                Alert.alert("Post", undefined, [
                  { text: "Edit", onPress: () => router.push({ pathname: "/edit-post/[id]", params: { id: post.id } }) },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                      Alert.alert("Delete post?", "This cannot be undone.", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => onDeletePost(post.id) },
                      ]);
                    },
                  },
                  { text: "Cancel", style: "cancel" },
                ]);
              } else {
                router.push({ pathname: "/edit-post/[id]", params: { id: post.id } });
              }
            }}
            className="p-2 rounded-full"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#71717a" />
          </TouchableOpacity>
        )}
      </View>
    );

  const mediaContent = hasValidMediaUri && mediaUri ? (
    post.type === "video" ? (
      <View
        className={`overflow-hidden rounded-lg bg-black ${fillContainer && !containMedia ? "flex-1 min-h-0" : ""}`}
        style={
          containMedia
            ? { width: "100%", maxHeight: containedMediaMaxHeight }
            : fillContainer
              ? { width: "100%", maxWidth: "100%" }
              : { width: "100%", height: MEDIA_HEIGHT_FIXED }
        }
      >
        <VideoView
          player={videoPlayer}
          style={containMedia ? { width: "100%", height: containedMediaMaxHeight } : { width: "100%", height: "100%" }}
          contentFit={containMedia ? "contain" : "cover"}
          nativeControls
        />
        {!containMedia && (
          <TouchableOpacity
            onPress={() => {
              fullscreenOpenedAtRef.current = Date.now();
              setFullscreenVideoUri(mediaUri);
            }}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-2"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="expand-outline" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    ) : (
      <View
        className={fillContainer && !containMedia ? "flex-1 min-h-0" : ""}
        style={
          containMedia
            ? { width: "100%", maxHeight: containedMediaMaxHeight }
            : fillContainer
              ? { width: "100%", maxWidth: "100%" }
              : undefined
        }
      >
        <Image
          source={{ uri: mediaUri }}
          style={
            containMedia
              ? { width: "100%", height: containedMediaMaxHeight, borderRadius: 8 }
              : fillContainer
                ? { width: "100%", height: "100%", borderRadius: 8 }
                : { width: "100%", height: MEDIA_HEIGHT_FIXED, borderRadius: 8 }
          }
          contentFit={containMedia ? "contain" : "cover"}
        />
      </View>
    )
  ) : null;

  const renderTextWithHashtags = (source: string | null | undefined, className: string, numberOfLines?: number) => {
    if (!source) return null;
    const segments = parseHashtagSegments(source);
    if (segments.length === 0) return <Text className={className} numberOfLines={numberOfLines}>{source}</Text>;
    return (
      <Text className={className} numberOfLines={numberOfLines}>
        {segments.map((seg, i) =>
          seg.type === "text" ? (
            <Text key={i}>{seg.value}</Text>
          ) : (
            <Text
              key={i}
              onPress={() => onPressHashtag?.(seg.value)}
              className="text-violet-400"
            >
              #{seg.value}
            </Text>
          )
        )}
      </Text>
    );
  };

  const bodyContent = (
    <View className={fillContainer && hasValidMediaUri ? "flex-1 min-h-0" : ""}>
      <View>
        {creator != null && (
          <View className="flex-row items-center gap-1.5 mb-1">
            <TypeBadge label={typeLabel} typeKey={post.type} />
          </View>
        )}
        {displayTitle ? (
          renderTextWithHashtags(displayTitle, "text-base font-medium text-zinc-100 mb-0.5", 2)
        ) : null}
        {displayBody ? (
          renderTextWithHashtags(displayBody, "text-sm text-zinc-400", 4)
        ) : null}
        {post.type === "polls" && post.pollOptions && post.pollOptions.length > 0 ? (
          <View className="mt-2 gap-1.5">
            {(post.pollOptions as string[]).map((opt, i) => (
              <View key={i} className="rounded-lg border border-zinc-600 bg-zinc-800/60 px-3 py-2">
                <Text className="text-sm text-zinc-200" numberOfLines={2}>{opt}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {placeName ? (
          <View className="flex-row items-center gap-1.5 mt-1">
            <Ionicons name="location-outline" size={14} color="#71717a" />
            <Text className="text-xs text-zinc-500" numberOfLines={1}>{placeName}</Text>
          </View>
        ) : null}
        {tagList.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5 mt-1">
            {tagList.map((tag) => (
              <Text
                key={tag}
                onPress={() => onPressHashtag?.(tag)}
                className="text-xs text-violet-400"
              >
                #{tag}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      {mediaContent}
    </View>
  );

  if (layout === "reels") {
    const reelsMedia = hasValidMediaUri && mediaUri ? (
      post.type === "video" ? (
        <View className="flex-1 min-h-0 bg-black rounded-t-xl overflow-hidden">
          <VideoView
            player={videoPlayer}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            nativeControls
          />
          <TouchableOpacity
            onPress={() => {
              fullscreenOpenedAtRef.current = Date.now();
              setFullscreenVideoUri(mediaUri);
            }}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-2"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="expand-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-1 min-h-0 bg-black rounded-t-xl overflow-hidden">
          <Image
            source={{ uri: mediaUri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        </View>
      )
    ) : (
      <View className="bg-zinc-800/80 rounded-t-xl flex-1 min-h-[120]" />
    );
    return (
      <Card className={fillContainer ? "flex-1 overflow-hidden" : "overflow-hidden"}>
        {repostedByMe && (
          <View className="flex-row items-center gap-1.5 border-b border-zinc-700/80 bg-zinc-800/50">
            <Ionicons name="repeat" size={14} color="#a78bfa" />
            <Text className="text-xs text-zinc-400">You reposted</Text>
          </View>
        )}
        <View style={{ flex: 1, minHeight: 0, flexDirection: "row" }}>
          <View style={{ flex: 1, minHeight: 0 }}>
            {reelsMedia}
            <View className="absolute bottom-0 left-0 right-14 pt-8 pb-3 px-3">
              {creator != null && (
                <View className="flex-row items-center gap-2 mb-1.5">
                  <Pressable onPress={() => onPressCreator?.(creator.id)} className="flex-row items-center gap-2 flex-1 min-w-0">
                    <Avatar uri={creator.avatarUri} size={32} />
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-semibold text-white" numberOfLines={1}>
                        {creator.displayName}
                      </Text>
                      {creator.username ? (
                        <Text className="text-xs text-zinc-300" numberOfLines={1}>
                          @{creator.username}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                  {!isOwnPost && onFollow ? (
                    <TouchableOpacity
                      onPress={onFollow}
                      className={`rounded-md px-4 py-2 ${isFollowing ? "bg-white/20" : "bg-white"}`}
                    >
                      <Text className={`text-sm font-medium ${isFollowing ? "text-white" : "text-black"}`}>
                        {isFollowing ? "Following" : "Follow"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
              {displayTitle ? (
                renderTextWithHashtags(displayTitle, "text-sm font-semibold text-white mb-0.5", 2)
              ) : null}
              {displayBody ? (
                <Pressable
                  onPress={() => {
                    const body = displayBody;
                    if (body.length > REELS_DESCRIPTION_MAX_CHARS) {
                      setReelsDescriptionExpanded((prev) => !prev);
                    }
                  }}
                  className="min-w-0"
                >
                  {reelsDescriptionExpanded || displayBody.length <= REELS_DESCRIPTION_MAX_CHARS
                    ? renderTextWithHashtags(displayBody, "text-sm text-zinc-200")
                    : (
                        <Text className="text-sm text-zinc-200" numberOfLines={2}>
                          {displayBody.slice(0, REELS_DESCRIPTION_MAX_CHARS).trim()}
                          {displayBody.length > REELS_DESCRIPTION_MAX_CHARS ? "..." : ""}
                        </Text>
                      )}
                </Pressable>
              ) : null}
              {post.type === "polls" && post.pollOptions && post.pollOptions.length > 0 ? (
                <View className="mt-2 gap-1.5">
                  {(post.pollOptions as string[]).map((opt, i) => (
                    <View key={i} className="rounded-lg border border-zinc-500 bg-black/30 px-3 py-2">
                      <Text className="text-sm text-zinc-200" numberOfLines={2}>{opt}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {placeName ? (
                <View className="flex-row items-center gap-1 mt-1">
                  <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.8)" />
                  <Text className="text-xs text-zinc-300" numberOfLines={1}>{placeName}</Text>
                </View>
              ) : null}
              {tagList.length > 0 ? (
                <View className="flex-row flex-wrap gap-1.5 mt-1">
                  {tagList.map((tag) => (
                    <Text
                      key={tag}
                      onPress={() => onPressHashtag?.(tag)}
                      className="text-xs text-violet-300"
                    >
                      #{tag}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
          <View className="absolute right-2 top-4 bottom-4 justify-end gap-5">
            <TouchableOpacity onPress={onLike} className="items-center" hitSlop={hitSlop}>
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={28} color={isLiked ? "#f43f5e" : "#fff"} />
              <Text className="text-white text-xs font-medium">{formatCount(likeCount ?? 0)}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDislike} className="items-center" hitSlop={hitSlop}>
              <Ionicons name={isDisliked ? "thumbs-down" : "thumbs-down-outline"} size={26} color={isDisliked ? "#71717a" : "#fff"} />
              <Text className="text-white text-xs font-medium">{formatCount(dislikeCount ?? 0)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setCommentModalVisible(true);
                onComment?.();
              }}
              className="items-center"
              hitSlop={hitSlop}
            >
              <Ionicons name="chatbubble-outline" size={26} color="#fff" />
              <Text className="text-white text-xs font-medium">{formatCount(commentCount ?? 0)}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRepostPress} className="items-center" hitSlop={hitSlop}>
              <Ionicons name={isReposted ? "repeat" : "repeat-outline"} size={26} color={isReposted ? "#a78bfa" : "#fff"} />
              <Text className="text-white text-xs font-medium">{formatCount(repostCount ?? 0)}</Text>
            </TouchableOpacity>
            {showTip && (
              <TouchableOpacity onPress={onTip} className="items-center" hitSlop={hitSlop}>
                <Ionicons name="cash-outline" size={26} color="#fff" />
                <Text className="text-white text-xs font-medium">Tip</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onShare} className="items-center" hitSlop={hitSlop}>
              <Ionicons name="paper-plane-outline" size={26} color="#fff" />
              <Text className="text-white text-xs font-medium">Share</Text>
            </TouchableOpacity>
            {showSave && (
              <TouchableOpacity onPress={onSave} className="items-center" hitSlop={hitSlop}>
                <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={26} color={isSaved ? "#a78bfa" : "#fff"} />
                <Text className="text-white text-xs font-medium">Save</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className="items-center"
              hitSlop={hitSlop}
              onPress={() => {
                const postUrl = Linking.createURL(`post/${post.id}`);
                const copyLink = () => {
                  Clipboard.setStringAsync(postUrl).then(() => Alert.alert("Link copied", "Post link copied to clipboard."));
                };
                if (isOwnPost) {
                  Alert.alert("Post", undefined, [
                    { text: "Edit", onPress: () => router.push({ pathname: "/edit-post/[id]", params: { id: post.id } }) },
                    ...(onDeletePost
                      ? [
                          {
                            text: "Delete",
                            style: "destructive" as const,
                            onPress: () =>
                              Alert.alert("Delete post?", "This cannot be undone.", [
                                { text: "Cancel", style: "cancel" },
                                { text: "Delete", style: "destructive" as const, onPress: () => onDeletePost(post.id) },
                              ]),
                          },
                        ]
                      : []),
                    { text: "Copy link", onPress: copyLink },
                    { text: "Share", onPress: () => onShare?.() },
                    { text: "Cancel", style: "cancel" },
                  ]);
                } else {
                  Alert.alert("Post", undefined, [
                    ...(onReportUser && creator ? [{ text: "Report", onPress: () => onReportUser(creator.id) }] : []),
                    ...(onBlockUser && creator ? [{ text: "Block user", onPress: () => onBlockUser(creator.id) }] : []),
                    { text: "Copy link", onPress: copyLink },
                    ...(onHidePost ? [{ text: "Not interested", onPress: () => onHidePost(post.id) }] : []),
                    { text: "Share", onPress: () => onShare?.() },
                    { text: "Cancel", style: "cancel" },
                  ]);
                }
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <FullscreenVideoModal
          visible={!!fullscreenVideoUri}
          videoUri={fullscreenVideoUri}
          onClose={() => {
            const secs = (Date.now() - fullscreenOpenedAtRef.current) / 1000;
            if (secs >= 1) reportPostWatch(post.id, user?.id ?? null, secs).catch(() => {});
            setFullscreenVideoUri(null);
          }}
        />
        <Modal
          visible={commentModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCommentModalVisible(false)}
        >
          <Pressable
            className="flex-1 bg-black/60 justify-center items-center"
            onPress={() => setCommentModalVisible(false)}
          >
            <View
              pointerEvents="box-none"
              style={{
                width: Dimensions.get("window").width * 0.85,
                height: Dimensions.get("window").height * 0.85,
                maxWidth: Dimensions.get("window").width * 0.85,
                maxHeight: Dimensions.get("window").height * 0.85,
              }}
              className="bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden"
            >
              <View className="flex-row items-center justify-between border-b border-zinc-700 px-4 py-3">
                <Text className="text-base font-semibold text-zinc-100">Comments</Text>
                <Pressable onPress={() => setCommentModalVisible(false)} className="p-2">
                  <Ionicons name="close" size={22} color="#71717a" />
                </Pressable>
              </View>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1, minHeight: 0 }}
              >
                {commentsLoading ? (
                  <View className="flex-1 py-10 items-center justify-center">
                    <ActivityIndicator size="small" color="#a78bfa" />
                  </View>
                ) : (
                  <View
                    style={{
                      flex: 1,
                      minHeight: 0,
                      maxHeight: Dimensions.get("window").height * 0.85 - 110,
                    }}
                  >
                    <ScrollView
                      style={{ flex: 1, minHeight: 0 }}
                      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 8 }}
                      keyboardShouldPersistTaps="always"
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={Platform.OS === "android"}
                    >
                      {comments.length === 0 ? (
                        <Text className="text-sm text-zinc-500 py-6 text-center">
                          No comments yet. Be the first.
                        </Text>
                      ) : (
                        topLevelComments.map((c) => (
                          <View key={c.id} className="border-b border-zinc-800/80">
                            <View className="flex-row gap-3 py-3">
                              <Avatar
                                uri={c.author?.avatar_url ?? null}
                                size={COMMENT_AVATAR_SIZE}
                              />
                              <View className="flex-1 min-w-0">
                                <Text className="text-sm text-zinc-100">
                                  <Text className="font-semibold">
                                    {c.author?.display_name ?? "User"}
                                  </Text>
                                  {c.author?.username ? (
                                    <Text className="text-zinc-500 font-normal">
                                      {" "}
                                      @{c.author.username}
                                    </Text>
                                  ) : null}
                                </Text>
                                <Text className="text-sm text-zinc-300 mt-0.5">
                                  {c.body}
                                </Text>
                                <View className="flex-row items-center gap-4 mt-1.5">
                                  {c.created_at ? (
                                    <Text className="text-xs text-zinc-500">
                                      {formatExactTimestamp(c.created_at)}
                                    </Text>
                                  ) : null}
                                  <Pressable
                                    onPress={() => toggleCommentLike(c.id)}
                                    className="flex-row items-center gap-1"
                                  >
                                    <Ionicons
                                      name={c.is_liked ? "heart" : "heart-outline"}
                                      size={14}
                                      color={c.is_liked ? "#f43f5e" : "#71717a"}
                                    />
                                    {c.like_count > 0 && (
                                      <Text className="text-xs text-zinc-500">{c.like_count}</Text>
                                    )}
                                  </Pressable>
                                  <Pressable
                                    onPress={() => toggleCommentDislike(c.id)}
                                    className="flex-row items-center gap-1"
                                  >
                                    <Ionicons
                                      name={c.is_disliked ? "thumbs-down" : "thumbs-down-outline"}
                                      size={14}
                                      color={c.is_disliked ? "#94a3b8" : "#71717a"}
                                    />
                                    {c.dislike_count > 0 && (
                                      <Text className="text-xs text-zinc-500">{c.dislike_count}</Text>
                                    )}
                                  </Pressable>
                                  {user?.id ? (
                                    <Pressable
                                      onPress={() => {
                                        setReplyingToCommentId(c.id);
                                        const username = c.author?.username;
                                        setCommentBody(username ? `@${username} ` : "");
                                      }}
                                      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                                    >
                                      <Text className="text-xs text-zinc-500">Reply</Text>
                                    </Pressable>
                                  ) : null}
                                </View>
                              </View>
                            </View>
                            {(repliesByParentId[c.id] ?? []).map((reply) => (
                              <View key={reply.id} className="flex-row gap-3 pl-10 pb-3">
                                <Avatar
                                  uri={reply.author?.avatar_url ?? null}
                                  size={COMMENT_AVATAR_SIZE}
                                />
                                <View className="flex-1 min-w-0">
                                  <Text className="text-sm text-zinc-100">
                                    <Text className="font-semibold">
                                      {reply.author?.display_name ?? "User"}
                                    </Text>
                                    {reply.author?.username ? (
                                      <Text className="text-zinc-500 font-normal">
                                        {" "}
                                        @{reply.author.username}
                                      </Text>
                                    ) : null}
                                  </Text>
                                  <Text className="text-sm text-zinc-300 mt-0.5">
                                    {reply.body}
                                  </Text>
                                  <View className="flex-row items-center gap-4 mt-1.5">
                                    {reply.created_at ? (
                                      <Text className="text-xs text-zinc-500">
                                        {formatExactTimestamp(reply.created_at)}
                                      </Text>
                                    ) : null}
                                    <Pressable
                                      onPress={() => toggleCommentLike(reply.id)}
                                      className="flex-row items-center gap-1"
                                    >
                                      <Ionicons
                                        name={reply.is_liked ? "heart" : "heart-outline"}
                                        size={14}
                                        color={reply.is_liked ? "#f43f5e" : "#71717a"}
                                      />
                                      {reply.like_count > 0 && (
                                        <Text className="text-xs text-zinc-500">{reply.like_count}</Text>
                                      )}
                                    </Pressable>
                                    <Pressable
                                      onPress={() => toggleCommentDislike(reply.id)}
                                      className="flex-row items-center gap-1"
                                    >
                                      <Ionicons
                                        name={reply.is_disliked ? "thumbs-down" : "thumbs-down-outline"}
                                        size={14}
                                        color={reply.is_disliked ? "#94a3b8" : "#71717a"}
                                      />
                                      {reply.dislike_count > 0 && (
                                        <Text className="text-xs text-zinc-500">{reply.dislike_count}</Text>
                                      )}
                                    </Pressable>
                                    {user?.id ? (
                                      <Pressable
                                        onPress={() => {
                                          setReplyingToCommentId(reply.id);
                                          const username = reply.author?.username;
                                          setCommentBody(username ? `@${username} ` : "");
                                        }}
                                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                                      >
                                        <Text className="text-xs text-zinc-500">Reply</Text>
                                      </Pressable>
                                    ) : null}
                                  </View>
                                </View>
                              </View>
                            ))}
                          </View>
                        ))
                      )}
                    </ScrollView>
                  </View>
                )}
                {replyingToCommentId ? (() => {
                  const replyingTo = comments.find((x) => x.id === replyingToCommentId);
                  const replyingToUsername = replyingTo?.author?.username;
                  return (
                    <View className="flex-row items-center justify-between border-t border-zinc-700 px-4 py-2 bg-zinc-800/50">
                      <Text className="text-xs text-zinc-400">
                        Replying to @{replyingToUsername ?? "user"}
                      </Text>
                      <Pressable
                        onPress={() => {
                          setReplyingToCommentId(null);
                          setCommentBody("");
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={20} color="#71717a" />
                      </Pressable>
                    </View>
                  );
                })() : null}
                <View className="border-t border-zinc-700 px-4 py-2">
                  {user?.id ? (
                    <View className="flex-row items-center gap-2">
                      <TextInput
                        value={commentBody}
                        onChangeText={setCommentBody}
                        placeholder="Add a comment..."
                        placeholderTextColor="#71717a"
                        className="flex-1 rounded-full bg-zinc-800 px-4 py-2.5 text-zinc-100"
                        onSubmitEditing={submitComment}
                        returnKeyType="send"
                      />
                      <TouchableOpacity
                        onPress={submitComment}
                        disabled={commentSubmitting || !commentBody.trim()}
                        className="rounded-full bg-violet-600 px-4 py-2.5"
                      >
                        <Text className="text-white font-medium">Post</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text className="text-sm text-zinc-500 text-center">
                      Sign in to add a comment.
                    </Text>
                  )}
                </View>
              </KeyboardAvoidingView>
            </View>
          </Pressable>
        </Modal>
        <Modal
          visible={repostModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRepostModalVisible(false)}
        >
          <Pressable
            className="flex-1 bg-black/60 justify-center items-center px-6"
            onPress={() => setRepostModalVisible(false)}
          >
            <View
              pointerEvents="box-none"
              onStartShouldSetResponder={() => true}
              className="w-full max-w-sm bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden"
            >
              <View className="px-4 pt-4 pb-2">
                <Text className="text-lg font-semibold text-zinc-100">Repost?</Text>
                <Text className="text-sm text-zinc-500 mt-0.5">
                  Share this post to your followers.
                </Text>
              </View>
              <TextInput
                value={repostQuote}
                onChangeText={setRepostQuote}
                placeholder="Add a comment (optional)"
                placeholderTextColor="#71717a"
                className="mx-4 mt-2 bg-zinc-800 text-zinc-100 rounded-lg px-4 py-3 text-sm min-h-[44px]"
                multiline
                maxLength={280}
                editable={true}
              />
              <View className="flex-row gap-3 px-4 py-4">
                <Pressable
                  onPress={() => setRepostModalVisible(false)}
                  className="flex-1 py-3 rounded-xl border border-zinc-600 items-center"
                >
                  <Text className="text-base font-semibold text-zinc-300">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleRepostConfirm}
                  className="flex-1 py-3 rounded-xl bg-violet-600 items-center"
                >
                  <Text className="text-base font-semibold text-white">Repost</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      </Card>
    );
  }

  return (
    <Card className={fillContainer ? "flex-1" : ""}>
      {repostedByMe && (
        <View className="flex-row items-center gap-1.5 border-b border-zinc-700/80 px-3 py-1.5 bg-zinc-800/50">
          <Ionicons name="repeat" size={14} color="#a78bfa" />
          <Text className="text-xs text-zinc-400">You reposted</Text>
        </View>
      )}
      {headerContent}
      {fillContainer ? (
        <View className="flex-1 min-h-0">
          {bodyContent}
        </View>
      ) : (
        bodyContent
      )}
      <FullscreenVideoModal
        visible={!!fullscreenVideoUri}
        videoUri={fullscreenVideoUri}
        onClose={() => {
          const secs = (Date.now() - fullscreenOpenedAtRef.current) / 1000;
          if (secs >= 1) reportPostWatch(post.id, user?.id ?? null, secs).catch(() => {});
          setFullscreenVideoUri(null);
        }}
      />
      <Modal
        visible={commentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-center items-center"
          onPress={() => setCommentModalVisible(false)}
        >
          <View
            pointerEvents="box-none"
            style={{
              width: Dimensions.get("window").width * 0.85,
              height: Dimensions.get("window").height * 0.85,
              maxWidth: Dimensions.get("window").width * 0.85,
              maxHeight: Dimensions.get("window").height * 0.85,
            }}
            className="bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden"
          >
            <View className="flex-row items-center justify-between border-b border-zinc-700 px-4 py-3">
              <Text className="text-base font-semibold text-zinc-100">Comments</Text>
              <Pressable onPress={() => setCommentModalVisible(false)} className="p-2">
                <Ionicons name="close" size={22} color="#71717a" />
              </Pressable>
            </View>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1, minHeight: 0 }}
            >
              {commentsLoading ? (
                <View className="flex-1 py-10 items-center justify-center">
                  <ActivityIndicator size="small" color="#a78bfa" />
                </View>
              ) : (
                <View
                  style={{
                    flex: 1,
                    minHeight: 0,
                    maxHeight: Dimensions.get("window").height * 0.85 - 110,
                  }}
                >
                  <ScrollView
                    style={{ flex: 1, minHeight: 0 }}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 8 }}
                    keyboardShouldPersistTaps="always"
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={Platform.OS === "android"}
                  >
                  {comments.length === 0 ? (
                    <Text className="text-sm text-zinc-500 py-6 text-center">
                      No comments yet. Be the first.
                    </Text>
                  ) : (
                    topLevelComments.map((c) => (
                      <View key={c.id} className="border-b border-zinc-800/80">
                        <View className="flex-row gap-3 py-3">
                          <Avatar
                            uri={c.author?.avatar_url ?? null}
                            size={COMMENT_AVATAR_SIZE}
                          />
                          <View className="flex-1 min-w-0">
                            <Text className="text-sm text-zinc-100">
                              <Text className="font-semibold">
                                {c.author?.display_name ?? "User"}
                              </Text>
                              {c.author?.username ? (
                                <Text className="text-zinc-500 font-normal">
                                  {" "}
                                  @{c.author.username}
                                </Text>
                              ) : null}
                            </Text>
                            <Text className="text-sm text-zinc-300 mt-0.5">
                              {c.body}
                            </Text>
                            <View className="flex-row items-center gap-4 mt-1.5">
                              {c.created_at ? (
                                <Text className="text-xs text-zinc-500">
                                  {formatExactTimestamp(c.created_at)}
                                </Text>
                              ) : null}
                              <Pressable
                                onPress={() => toggleCommentLike(c.id)}
                                className="flex-row items-center gap-1"
                              >
                                <Ionicons
                                  name={c.is_liked ? "heart" : "heart-outline"}
                                  size={14}
                                  color={c.is_liked ? "#f43f5e" : "#71717a"}
                                />
                                {c.like_count > 0 && (
                                  <Text className="text-xs text-zinc-500">
                                    {c.like_count}
                                  </Text>
                                )}
                              </Pressable>
                              <Pressable
                                onPress={() => toggleCommentDislike(c.id)}
                                className="flex-row items-center gap-1"
                              >
                                <Ionicons
                                  name={c.is_disliked ? "thumbs-down" : "thumbs-down-outline"}
                                  size={14}
                                  color={c.is_disliked ? "#94a3b8" : "#71717a"}
                                />
                                {c.dislike_count > 0 && (
                                  <Text className="text-xs text-zinc-500">
                                    {c.dislike_count}
                                  </Text>
                                )}
                              </Pressable>
                              {user ? (
                                <Pressable
                                  onPress={() => {
                                    setReplyingToCommentId(c.id);
                                    const username = c.author?.username;
                                    setCommentBody(
                                      username ? `@${username} ` : ""
                                    );
                                  }}
                                  hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                                >
                                  <Text className="text-xs text-zinc-500">
                                    Reply
                                  </Text>
                                </Pressable>
                              ) : null}
                            </View>
                          </View>
                        </View>
                        {(repliesByParentId[c.id] ?? []).map((reply) => (
                          <View
                            key={reply.id}
                            className="flex-row gap-3 pl-10 pb-3"
                          >
                            <Avatar
                              uri={reply.author?.avatar_url ?? null}
                              size={COMMENT_AVATAR_SIZE}
                            />
                            <View className="flex-1 min-w-0">
                              <Text className="text-sm text-zinc-100">
                                <Text className="font-semibold">
                                  {reply.author?.display_name ?? "User"}
                                </Text>
                                {reply.author?.username ? (
                                  <Text className="text-zinc-500 font-normal">
                                    {" "}
                                    @{reply.author.username}
                                  </Text>
                                ) : null}
                              </Text>
                              <Text className="text-sm text-zinc-300 mt-0.5">
                                {reply.body}
                              </Text>
                              <View className="flex-row items-center gap-4 mt-1.5">
                                {reply.created_at ? (
                                  <Text className="text-xs text-zinc-500">
                                    {formatExactTimestamp(reply.created_at)}
                                  </Text>
                                ) : null}
                                <Pressable
                                  onPress={() =>
                                    toggleCommentLike(reply.id)
                                  }
                                  className="flex-row items-center gap-1"
                                >
                                  <Ionicons
                                    name={
                                      reply.is_liked
                                        ? "heart"
                                        : "heart-outline"
                                    }
                                    size={14}
                                    color={
                                      reply.is_liked ? "#f43f5e" : "#71717a"
                                    }
                                  />
                                  {reply.like_count > 0 && (
                                    <Text className="text-xs text-zinc-500">
                                      {reply.like_count}
                                    </Text>
                                  )}
                                </Pressable>
                                <Pressable
                                  onPress={() =>
                                    toggleCommentDislike(reply.id)
                                  }
                                  className="flex-row items-center gap-1"
                                >
                                  <Ionicons
                                    name={
                                      reply.is_disliked
                                        ? "thumbs-down"
                                        : "thumbs-down-outline"
                                    }
                                    size={14}
                                    color={
                                      reply.is_disliked ? "#94a3b8" : "#71717a"
                                    }
                                  />
                                  {reply.dislike_count > 0 && (
                                    <Text className="text-xs text-zinc-500">
                                      {reply.dislike_count}
                                    </Text>
                                  )}
                                </Pressable>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    ))
                  )}
                  </ScrollView>
                </View>
              )}
              {replyingToCommentId ? (() => {
                const replyingTo = comments.find((x) => x.id === replyingToCommentId);
                const replyingToUsername = replyingTo?.author?.username;
                return (
                  <View className="flex-row items-center justify-between border-t border-zinc-700 px-4 py-2 bg-zinc-800/50">
                    <Text className="text-xs text-zinc-400">
                      Replying to @{replyingToUsername ?? "user"}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setReplyingToCommentId(null);
                        setCommentBody("");
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={20} color="#71717a" />
                    </Pressable>
                  </View>
                );
              })() : null}
              {user ? (
                <View className="flex-row items-center gap-2 px-4 py-3 border-t border-zinc-700 bg-zinc-900">
                  <Avatar uri={profile?.avatarUri ?? null} size={COMMENT_AVATAR_SIZE} />
                  <TextInput
                    value={commentBody}
                    onChangeText={setCommentBody}
                    placeholder="Add a comment..."
                    placeholderTextColor="#71717a"
                    className="flex-1 bg-zinc-800 text-zinc-100 rounded-full px-4 py-2.5 text-sm"
                    multiline
                    maxLength={500}
                    editable={!commentSubmitting}
                  />
                  <Pressable
                    onPress={submitComment}
                    disabled={!commentBody.trim() || commentSubmitting}
                    className="bg-violet-600 rounded-full px-4 py-2.5 disabled:opacity-50"
                  >
                    <Text className="text-sm font-semibold text-white">
                      {commentSubmitting ? "…" : "Post"}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View className="px-4 py-3 border-t border-zinc-700">
                  <Text className="text-sm text-zinc-500 text-center">
                    Sign in to add a comment.
                  </Text>
                </View>
              )}
            </KeyboardAvoidingView>
          </View>
        </Pressable>
      </Modal>
      <Modal
        visible={repostModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRepostModalVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-center items-center px-6"
          onPress={() => setRepostModalVisible(false)}
        >
          <View
            pointerEvents="box-none"
            className="w-full max-w-sm bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden"
          >
            <View className="px-4 pt-4 pb-2">
              <Text className="text-lg font-semibold text-zinc-100">Repost?</Text>
              <Text className="text-sm text-zinc-500 mt-0.5">
                Share this post to your followers.
              </Text>
            </View>
            <TextInput
              value={repostQuote}
              onChangeText={setRepostQuote}
              placeholder="Add a comment (optional)"
              placeholderTextColor="#71717a"
              className="mx-4 mt-2 bg-zinc-800 text-zinc-100 rounded-lg px-4 py-3 text-sm min-h-[44px]"
              multiline
              maxLength={280}
              editable={true}
            />
            <View className="flex-row gap-3 px-4 py-4">
              <Pressable
                onPress={() => setRepostModalVisible(false)}
                className="flex-1 py-3 rounded-xl border border-zinc-600 items-center"
              >
                <Text className="text-base font-semibold text-zinc-300">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleRepostConfirm}
                className="flex-1 py-3 rounded-xl bg-violet-600 items-center"
              >
                <Text className="text-base font-semibold text-white">Repost</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
      <PostActionBar
        onLike={onLike}
        onDislike={onDislike}
        onComment={() => {
          setCommentModalVisible(true);
          onComment?.();
        }}
        onShare={onShare}
        onRepost={handleRepostPress}
        onSave={onSave}
        onTip={onTip}
        isLiked={isLiked}
        isDisliked={isDisliked}
        isReposted={isReposted}
        isSaved={isSaved}
        likeCount={likeCount}
        dislikeCount={dislikeCount}
        repostCount={repostCount}
        commentCount={commentCount}
        showSave={showSave}
        showTip={showTip}
        rightLabel={hideRightLabel ? undefined : creator == null ? "Public" : undefined}
      />
    </Card>
  );
}
