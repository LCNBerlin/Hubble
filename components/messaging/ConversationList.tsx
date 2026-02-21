import { Ionicons } from "@expo/vector-icons";
import { useCallback } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useCommunity } from "../../context/CommunityContext";
import { useMessaging } from "../../context/MessagingContext";
import { useConversations, type ConversationCategory } from "../../hooks/useConversations";
import type { ConversationWithMeta } from "../../lib/conversations";
import { ConversationCard } from "./ConversationCard";

const CATEGORIES: { key: ConversationCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "priority", label: "Priority" },
  { key: "main", label: "Main" },
  { key: "groups", label: "Groups" },
  { key: "escrow", label: "Escrow" },
  { key: "bookings", label: "Bookings" },
];

export function ConversationList() {
  const { user } = useAuth();
  const { selectedCommunityId } = useCommunity();
  const { openChat } = useMessaging();
  const {
    conversations,
    loading,
    category,
    setCategory,
    search,
    setSearch,
    refresh,
    pin,
    unpin,
    archive,
    mute,
  } = useConversations(user?.id);

  const filteredConversations =
    selectedCommunityId
      ? conversations.filter((c) =>
          c.participants?.some((p) => p.user_id === selectedCommunityId)
        )
      : conversations;

  const renderItem = useCallback(
    ({ item }: { item: ConversationWithMeta }) => (
      <ConversationCard
        conversation={item}
        currentUserId={user?.id ?? ""}
        onPress={() => openChat(item.id)}
        onPin={() => pin(item.id)}
        onUnpin={() => unpin(item.id)}
        onArchive={() => archive(item.id)}
        onMute={(muted) => mute(item.id, muted)}
      />
    ),
    [user?.id, openChat, pin, unpin, archive, mute]
  );

  const keyExtractor = useCallback((item: ConversationWithMeta) => item.id, []);

  return (
    <View className="flex-1 bg-zinc-900">
      <View className="border-b border-zinc-800 bg-zinc-900">
        <View className="min-h-[44px] flex-row flex-wrap items-center gap-2 px-3 py-2" style={{ minHeight: 44 }}>
          <View className="flex-1 min-w-[120px] flex-row items-center rounded-lg bg-zinc-800 px-3 py-2">
            <Ionicons name="search" size={18} color="#71717a" />
            <TextInput
              className="ml-2 flex-1 text-base text-zinc-100"
              placeholder="Search"
              placeholderTextColor="#71717a"
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <Pressable className="rounded-lg bg-violet-600 px-3 py-2" style={{ minHeight: 44 }}>
            <Text className="text-sm font-medium text-white">New</Text>
          </Pressable>
          <Pressable className="rounded-lg bg-zinc-800 px-3 py-2" style={{ minHeight: 44 }}>
            <Ionicons name="filter" size={20} color="#a1a1aa" />
          </Pressable>
        </View>
        <View className="flex-row flex-wrap gap-1 px-2 pb-2">
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.key}
              onPress={() => setCategory(c.key)}
              className={`rounded-full px-3 py-1.5 ${category === c.key ? "bg-violet-600" : "bg-zinc-800"}`}
            >
              <Text className={`text-xs font-medium ${category === c.key ? "text-white" : "text-zinc-400"}`}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-zinc-500">Loading…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center p-8">
              <Text className="text-center text-zinc-500">
                {selectedCommunityId
                  ? "No messages with this creator yet. Start a new message."
                  : "No conversations yet. Start a new message."}
              </Text>
            </View>
          }
          contentContainerStyle={filteredConversations.length === 0 ? { flex: 1 } : undefined}
        />
      )}
    </View>
  );
}
