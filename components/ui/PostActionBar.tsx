import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

export type PostActionBarProps = {
  onLike?: () => void;
  onDislike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onRepost?: () => void;
  onTip?: () => void;
  onSave?: () => void;
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
  rightLabel?: string;
};

export function PostActionBar({
  onLike,
  onDislike,
  onComment,
  onShare,
  onRepost,
  onTip,
  onSave,
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
  rightLabel,
}: PostActionBarProps) {
  const noop = () => {};
  const hitSlop = { top: 12, bottom: 12, left: 12, right: 12 };

  return (
    <View className="flex-row items-center justify-between border-t border-zinc-800/80 px-3 py-2">
      <View className="flex-row items-center gap-2 flex-wrap">
        <TouchableOpacity hitSlop={hitSlop} activeOpacity={0.7} className="flex-row items-center gap-0.5" onPress={onLike ?? noop}>
          <Ionicons name={isLiked ? "heart" : "heart-outline"} size={18} color={isLiked ? "#f43f5e" : "#71717a"} />
          {likeCount != null && likeCount > 0 && <Text className="text-xs text-zinc-500">{likeCount}</Text>}
        </TouchableOpacity>
        <TouchableOpacity hitSlop={hitSlop} activeOpacity={0.7} className="flex-row items-center gap-0.5" onPress={onDislike ?? noop}>
          <Ionicons name={isDisliked ? "thumbs-down" : "thumbs-down-outline"} size={18} color="#71717a" />
          {dislikeCount != null && dislikeCount > 0 && <Text className="text-xs text-zinc-500">{dislikeCount}</Text>}
        </TouchableOpacity>
        <TouchableOpacity hitSlop={hitSlop} activeOpacity={0.7} className="flex-row items-center gap-0.5" onPress={onComment ?? noop}>
          <Ionicons name="chatbubble-outline" size={16} color="#71717a" />
          {commentCount != null && commentCount > 0 && <Text className="text-xs text-zinc-500">{commentCount}</Text>}
        </TouchableOpacity>
        <TouchableOpacity hitSlop={hitSlop} activeOpacity={0.7} onPress={onShare ?? noop}>
          <Ionicons name="share-outline" size={18} color="#71717a" />
        </TouchableOpacity>
        <TouchableOpacity hitSlop={hitSlop} activeOpacity={0.7} className="flex-row items-center gap-0.5" onPress={onRepost ?? noop}>
          <Ionicons name={isReposted ? "repeat" : "repeat-outline"} size={18} color={isReposted ? "#a78bfa" : "#71717a"} />
          {repostCount != null && repostCount > 0 && <Text className="text-xs text-zinc-500">{repostCount}</Text>}
        </TouchableOpacity>
        {showTip && (
          <TouchableOpacity hitSlop={hitSlop} activeOpacity={0.7} onPress={onTip ?? noop}>
            <Ionicons name="cash-outline" size={18} color="#71717a" />
          </TouchableOpacity>
        )}
        {showSave && (
          <TouchableOpacity hitSlop={hitSlop} activeOpacity={0.7} onPress={onSave ?? noop}>
            <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={18} color={isSaved ? "#a78bfa" : "#71717a"} />
          </TouchableOpacity>
        )}
      </View>
      {rightLabel ? <Text className="text-[10px] text-zinc-500">{rightLabel}</Text> : null}
    </View>
  );
}
