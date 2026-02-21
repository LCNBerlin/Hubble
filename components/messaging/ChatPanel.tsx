import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useMessaging } from "../../context/MessagingContext";
import { useMessages } from "../../hooks/useMessages";
import { fetchConversationPeer } from "../../lib/conversations";
import type { Message } from "../../lib/conversations";
import { useMessagingLayout } from "../../hooks/useMessagingLayout";
import { Avatar } from "../ui/Avatar";
import { MessageBubble } from "./MessageBubble";
import { MessageInputBar } from "./MessageInputBar";

export function ChatPanel() {
  const { user } = useAuth();
  const { selectedConversationId, view, backToList, openCRM, crmCollapsed } = useMessaging();
  const layout = useMessagingLayout(crmCollapsed);
  const { messages, loading, sendMessage } = useMessages(selectedConversationId, user?.id);
  const inputBarRef = useRef<{ submit: () => void } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [peer, setPeer] = useState<{
    display_name: string;
    username: string;
    avatar_url: string | null;
    verified_tier: string;
    reputation_score: number;
  } | null>(null);

  useEffect(() => {
    if (!selectedConversationId || !user?.id) {
      setPeer(null);
      return;
    }
    let cancelled = false;
    fetchConversationPeer(selectedConversationId, user.id).then((p) => {
      if (!cancelled) setPeer(p);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedConversationId, user?.id]);


  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleLongPressMessage = useCallback((messageId: string) => {
    setSelectMode(true);
    setSelectedIds((prev) => new Set(prev).add(messageId));
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble
        message={item}
        isOwn={item.sender_id === user?.id}
        onReply={() => {}}
        selectMode={selectMode}
        selected={selectedIds.has(item.id)}
        onToggleSelect={() => toggleSelect(item.id)}
        onEnterSelectMode={handleLongPressMessage}
      />
    ),
    [user?.id, selectMode, selectedIds, toggleSelect, handleLongPressMessage]
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  if (!selectedConversationId) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-950 p-8">
        <Ionicons name="chatbubbles-outline" size={64} color="#3f3f46" />
        <Text className="mt-4 text-center text-zinc-500">Select a conversation</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <View
        className="min-h-[44px] flex-row items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-2"
        style={{ minHeight: 44 }}
      >
        <View className="flex-row flex-1 items-center gap-2 min-w-0">
          {!layout.threePanel && view === "chat" && (
            <Pressable onPress={backToList} className="rounded-full p-2">
              <Ionicons name="arrow-back" size={24} color="#a1a1aa" />
            </Pressable>
          )}
          <Pressable onPress={openCRM} className="flex-row flex-1 items-center gap-2 min-w-0">
            <Avatar uri={peer?.avatar_url ?? null} size={36} />
            <View className="flex-1 min-w-0">
              <Text className="text-base font-semibold text-zinc-100" numberOfLines={1}>
                {peer?.display_name || peer?.username || "…"}
              </Text>
              {peer?.verified_tier && peer.verified_tier !== "none" && (
                <View className="flex-row items-center gap-1">
                  <Ionicons name="checkmark-circle" size={12} color="#a78bfa" />
                  {peer.reputation_score != null && (
                    <Text className="text-xs text-zinc-500">Risk: {peer.reputation_score}</Text>
                  )}
                </View>
              )}
            </View>
          </Pressable>
        </View>
        <View className="flex-row items-center gap-1">
          <Pressable accessibilityLabel="Call" className="rounded-full p-2">
            <Ionicons name="call-outline" size={22} color="#a1a1aa" />
          </Pressable>
          <Pressable accessibilityLabel="Video call" className="rounded-full p-2">
            <Ionicons name="videocam-outline" size={22} color="#a1a1aa" />
          </Pressable>
          <Pressable accessibilityLabel="Schedule" className="rounded-full p-2">
            <Ionicons name="calendar-outline" size={20} color="#a1a1aa" />
          </Pressable>
          <Pressable accessibilityLabel="Transaction" className="rounded-full p-2">
            <Ionicons name="card-outline" size={20} color="#a1a1aa" />
          </Pressable>
          <Pressable accessibilityLabel="More" className="rounded-full p-2">
            <Ionicons name="ellipsis-horizontal" size={20} color="#a1a1aa" />
          </Pressable>
        </View>
      </View>
      {selectMode && (
        <View className="flex-row items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-2">
          <Pressable onPress={exitSelectMode} className="rounded-lg px-3 py-2">
            <Text className="text-violet-400">Cancel</Text>
          </Pressable>
          <Text className="text-sm text-zinc-400">{selectedIds.size} selected</Text>
          <View className="flex-row gap-2">
            <Pressable className="rounded-lg bg-zinc-700 px-3 py-2">
              <Text className="text-sm text-zinc-200">Delete</Text>
            </Pressable>
            <Pressable className="rounded-lg bg-zinc-700 px-3 py-2">
              <Text className="text-sm text-zinc-200">Export</Text>
            </Pressable>
            <Pressable className="rounded-lg bg-zinc-700 px-3 py-2">
              <Text className="text-sm text-zinc-200">Forward</Text>
            </Pressable>
          </View>
        </View>
      )}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-zinc-500">Loading…</Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          inverted
          contentContainerStyle={{ paddingVertical: 8 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-12">
              <Text className="text-zinc-500">No messages yet. Say hi!</Text>
            </View>
          }
        />
      )}
      <MessageInputBar
        inputBarRef={inputBarRef}
        onSend={sendMessage}
        disabled={!selectedConversationId}
      />
    </View>
  );
}
