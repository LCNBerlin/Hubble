import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
import {
  Animated,
  Alert,
  PanResponder,
  Pressable,
  Text,
  View,
} from "react-native";
import { Avatar } from "../ui/Avatar";
import type { ConversationWithMeta } from "../../lib/conversations";

const SWIPE_THRESHOLD = 80;
const ACTION_WIDTH = 72;

type ConversationCardProps = {
  conversation: ConversationWithMeta;
  currentUserId: string;
  onPress: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onArchive: () => void;
  onMute: (muted: boolean) => void;
};

export function ConversationCard({
  conversation,
  onPress,
  onPin,
  onArchive,
  onMute,
  currentUserId,
}: ConversationCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 15,
      onPanResponderMove: (_, g) => {
        const dx = g.dx;
        if (dx > 0) translateX.setValue(Math.min(dx, ACTION_WIDTH));
        else if (dx < 0) translateX.setValue(Math.max(dx, -ACTION_WIDTH));
      },
      onPanResponderRelease: (_, g) => {
        const dx = g.dx;
        if (dx > SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onPin());
        } else if (dx < -SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: -ACTION_WIDTH, duration: 200, useNativeDriver: true }).start();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const other = conversation.participants?.find((p) => p.user_id !== currentUserId);
  const profile = (other?.profile ?? {}) as { display_name?: string; username?: string; avatar_url?: string | null };
  const displayName = profile.display_name || profile.username || "Unknown";
  const verifiedTier = (profile as { verified_tier?: string }).verified_tier ?? "none";

  const handleLongPress = () => {
    Alert.alert(
      "Conversation",
      undefined,
      [
        { text: "Tag", onPress: () => {} },
        { text: "Mark important", onPress: () => {} },
        { text: "Move to pipeline stage", onPress: () => {} },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const resetAndArchive = () => {
    Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onArchive());
  };

  const resetAndMute = () => {
    Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onMute(true));
  };

  return (
    <View className="overflow-hidden border-b border-zinc-800">
      <View className="absolute left-0 top-0 bottom-0 w-20 flex-row items-center justify-start bg-violet-600/30 pl-2">
        <Ionicons name="pin" size={22} color="#a78bfa" />
      </View>
      <View className="absolute right-0 top-0 bottom-0 w-20 flex-row items-center justify-end gap-1 pr-2">
        <Pressable onPress={resetAndArchive} className="rounded bg-zinc-600 p-2">
          <Ionicons name="archive-outline" size={20} color="#fff" />
        </Pressable>
        <Pressable onPress={resetAndMute} className="rounded bg-zinc-600 p-2">
          <Ionicons name="notifications-off-outline" size={20} color="#fff" />
        </Pressable>
      </View>
      <Animated.View
        {...pan.panHandlers}
        style={{ transform: [{ translateX }] }}
        className="bg-zinc-900"
      >
        <Pressable
          onPress={onPress}
          onLongPress={handleLongPress}
          className="min-h-[44px] flex-row items-center gap-3 px-4 py-3"
          style={{ minHeight: 44 }}
        >
          <Avatar uri={profile.avatar_url ?? null} size={44} />
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-base font-semibold text-zinc-100" numberOfLines={1}>
                {displayName}
              </Text>
              {verifiedTier !== "none" && (
                <Ionicons name="checkmark-circle" size={14} color="#a78bfa" />
              )}
              {conversation.my_participant?.pinned && (
                <Ionicons name="pin" size={12} color="#71717a" />
              )}
            </View>
            <Text className="text-sm text-zinc-500" numberOfLines={1}>
              {conversation.last_message?.body ?? "No messages yet"}
            </Text>
          </View>
          <View className="items-end gap-0.5">
            {conversation.last_message_at && (
              <Text className="text-xs text-zinc-500">
                {formatTime(conversation.last_message_at)}
              </Text>
            )}
            {conversation.unread_count ? (
              <View className="rounded-full bg-violet-500 px-1.5 py-0.5">
                <Text className="text-xs font-medium text-white">{conversation.unread_count}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 86400000 * 2) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
