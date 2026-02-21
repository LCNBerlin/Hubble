import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Text, TouchableOpacity, View } from "react-native";

const BLOG_PREVIEW_CHARS = 80;

export type PostPreviewPost = {
  id?: string;
  type: string;
  title?: string | null;
  body?: string | null;
  mediaUri?: string | null;
  /** Optional thumbnail for video/audio posts (creator studio / profile grid). */
  thumbnailUri?: string | null;
};

/** Uniform-size preview card for a post: photo shows image, video shows snapshot + play, blog shows text preview. */
export function PostPreviewCard({
  post,
  onPress,
  cardWidth,
  cardHeight,
}: {
  post: PostPreviewPost;
  onPress: () => void;
  cardWidth: number;
  cardHeight: number;
}) {
  const hasMedia = !!post.mediaUri;
  const isPicture = post.type === "picture" && hasMedia;
  const isVideo = post.type === "video" && hasMedia;
  const hasVideoThumbnail = isVideo && !!post.thumbnailUri;
  const isBlogLike = post.type === "blog" || post.type === "audio" || post.type === "polls";
  const videoPlayer = useVideoPlayer(
    isVideo && !hasVideoThumbnail && post.mediaUri ? post.mediaUri : null,
    () => {}
  );

  const cardStyle = { width: cardWidth, height: cardHeight };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={cardStyle}
      className="rounded-xl border border-zinc-700 bg-zinc-800/80 overflow-hidden"
    >
      {isPicture && post.mediaUri ? (
        <Image
          source={{ uri: post.mediaUri }}
          style={{ width: cardWidth, height: cardHeight }}
          contentFit="cover"
        />
      ) : isVideo && (hasVideoThumbnail ? post.thumbnailUri : post.mediaUri) ? (
        <View style={[{ width: cardWidth, height: cardHeight }, { backgroundColor: "#000" }]}>
          {hasVideoThumbnail && post.thumbnailUri ? (
            <Image
              source={{ uri: post.thumbnailUri }}
              style={{ width: cardWidth, height: cardHeight }}
              contentFit="cover"
            />
          ) : (
            <VideoView
              player={videoPlayer}
              style={{ width: cardWidth, height: cardHeight }}
              contentFit="cover"
              nativeControls={false}
            />
          )}
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <View className="rounded-full bg-black/50 p-2">
              <Ionicons name="play" size={28} color="#fff" />
            </View>
          </View>
        </View>
      ) : post.type === "audio" && post.thumbnailUri ? (
        <View style={{ width: cardWidth, height: cardHeight }}>
          <Image
            source={{ uri: post.thumbnailUri }}
            style={{ width: cardWidth, height: cardHeight }}
            contentFit="cover"
          />
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <View className="rounded-full bg-black/50 p-2">
              <Ionicons name="musical-notes" size={28} color="#fff" />
            </View>
          </View>
        </View>
      ) : (
        <View className="bg-zinc-700 p-3 justify-between flex-1" style={{ width: cardWidth, height: cardHeight }}>
          <View className="flex-row items-center gap-1.5">
            <Ionicons
              name={post.type === "blog" ? "document-text" : post.type === "audio" ? "musical-notes" : "stats-chart"}
              size={20}
              color="#71717a"
            />
            <Text className="text-[10px] font-medium text-zinc-400 uppercase" numberOfLines={1}>
              {post.type === "blog" ? "Blog" : post.type === "audio" ? "Audio" : "Polls"}
            </Text>
          </View>
          <Text className="text-xs text-zinc-200" numberOfLines={4}>
            {(() => {
              const raw = `${(post.title ?? "").trim()} ${(post.body ?? "").trim()}`.trim();
              if (!raw) return "No content";
              return raw.length > BLOG_PREVIEW_CHARS ? raw.slice(0, BLOG_PREVIEW_CHARS) + "…" : raw;
            })()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
