import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useCommunity } from "../context/CommunityContext";
import { useNotificationsContext } from "../context/NotificationsContext";
import { useMyCommunities } from "../hooks/useMyCommunities";
import { Avatar } from "./ui/Avatar";

const TOP_BAR_HEIGHT = 48;
const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const TILE_SIZE = 56;

function IconButton({
  onPress,
  icon,
  size = 22,
  active,
  badge,
}: {
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
  active?: boolean;
  badge?: boolean;
}) {
  const color = active ? "#a78bfa" : "#e4e4e7";
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      className="rounded-xl bg-zinc-700/80 p-2.5 items-center justify-center"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View>
        <Ionicons name={icon} size={size} color={color} />
        {badge && (
          <View
            className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-violet-500"
            style={{ minWidth: 8, minHeight: 8 }}
          />
        )}
      </View>
    </Pressable>
  );
}

export function HudTopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { unreadCount } = useNotificationsContext();
  const { selectedCommunityId, setSelectedCommunityId, setSelectedCommunity } = useCommunity();
  const { communities } = useMyCommunities(user?.id);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const topPadding = insets.top;

  const isActive = (path: string) => pathname.includes(path);
  const communityActive = selectedCommunityId !== null;

  const handleCommunityPress = () => {
    if (communities.length === 0) return;
    setDropdownOpen((prev) => !prev);
  };

  const selectAll = () => {
    setSelectedCommunityId(null);
    setDropdownOpen(false);
  };

  const selectCommunity = (id: string, displayName: string) => {
    setSelectedCommunity({ id, displayName });
    setDropdownOpen(false);
    router.push("/(tabs)/feed");
  };

  return (
    <>
      <View
        className="flex-row items-center justify-between border-b border-zinc-800 px-3 bg-zinc-900"
        style={{ paddingTop: topPadding, paddingBottom: 10, minHeight: TOP_BAR_HEIGHT + topPadding }}
      >
        <Pressable
          onPress={() => router.push("/(tabs)/create")}
          hitSlop={HIT_SLOP}
          className="rounded-xl bg-zinc-700/80 px-3 py-2.5 flex-row items-center"
          style={({ pressed }) => [{ maxWidth: 160 }, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="add-circle-outline" size={18} color="#e4e4e7" />
          <Text className="text-sm font-medium text-zinc-200 ml-1.5" numberOfLines={1}>
            Creator Studios
          </Text>
        </Pressable>
        <View className="flex-row items-center gap-1">
          <IconButton
            onPress={() => router.push("/(tabs)/messages")}
            icon="chatbubbles-outline"
            active={isActive("messages")}
          />
          <IconButton
            onPress={handleCommunityPress}
            icon="people-outline"
            active={communityActive || isActive("feed")}
          />
          <IconButton
            onPress={() => router.push("/(tabs)/notifications")}
            icon="notifications-outline"
            active={isActive("notifications")}
            badge={unreadCount > 0}
          />
          <IconButton
            onPress={() => router.push("/(tabs)/wallet")}
            icon="wallet-outline"
            active={isActive("wallet")}
          />
        </View>
      </View>

      <Modal visible={dropdownOpen} transparent animationType="fade">
        <Pressable className="flex-1 bg-black/40" onPress={() => setDropdownOpen(false)}>
          <View
            className="absolute right-3 top-0 mt-0 rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden"
            style={{ marginTop: topPadding + TOP_BAR_HEIGHT + 4, minWidth: 200, maxWidth: 320 }}
            onStartShouldSetResponder={() => true}
          >
            <ScrollView style={{ maxHeight: 320 }}>
              <Pressable
                onPress={selectAll}
                className="flex-row items-center gap-3 px-4 py-3 border-b border-zinc-800"
                style={{ minHeight: 44 }}
              >
                <View className="h-10 w-10 rounded-full bg-zinc-700 items-center justify-center">
                  <Ionicons name="apps" size={22} color="#a1a1aa" />
                </View>
                <Text className="text-base font-medium text-zinc-200">All</Text>
              </Pressable>
              {communities.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => selectCommunity(c.id, c.display_name || c.username)}
                  className="flex-row items-center gap-3 px-4 py-3"
                  style={{ minHeight: 44 }}
                >
                  <Avatar uri={c.avatar_url} size={TILE_SIZE - 8} />
                  <Text className="text-base font-medium text-zinc-200" numberOfLines={1}>
                    {c.display_name || c.username}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
