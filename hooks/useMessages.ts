import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "../lib/conversations";
import {
  fetchMessages,
  sendMessage as sendMessageApi,
  subscribeToMessages,
  markConversationRead,
} from "../lib/conversations";

export function useMessages(conversationId: string | null, userId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof subscribeToMessages>>(null);

  const load = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await fetchMessages(conversationId);
    setMessages(list);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!conversationId || !userId) return;
    markConversationRead(conversationId, userId);
  }, [conversationId, userId]);

  useEffect(() => {
    if (!conversationId || !userId) return;
    const channel = subscribeToMessages(
      conversationId,
      (payload) => {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === payload.new.id);
          if (exists) return prev;
          const fromUs = payload.new.sender_id === userId;
          const withTemp = prev.filter((m) => String(m.id).startsWith("temp-"));
          if (fromUs && withTemp.length > 0)
            return prev.filter((m) => !String(m.id).startsWith("temp-")).concat(payload.new);
          return [...prev, payload.new];
        });
      },
      (payload) => {
        setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
      }
    );
    channelRef.current = channel;
    return () => {
      channel?.unsubscribe();
      channelRef.current = null;
    };
  }, [conversationId, userId]);

  const sendMessage = useCallback(
    async (body: string, options?: { parent_id?: string }) => {
      if (!conversationId || !userId) return null;
      const tempId = `temp-${Date.now()}`;
      const optimistic: Message = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: userId,
        body,
        parent_id: options?.parent_id ?? null,
        type: "text",
        metadata: {},
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      const msg = await sendMessageApi(conversationId, userId, body, options);
      if (msg) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? msg : m)));
        return msg;
      }
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return null;
    },
    [conversationId, userId]
  );

  const loadMore = useCallback(async () => {
    if (!conversationId || messages.length === 0) return;
    const before = messages[0]?.created_at;
    const older = await fetchMessages(conversationId, 50, before);
    if (older.length) setMessages((prev) => [...older, ...prev]);
  }, [conversationId, messages]);

  return { messages, loading, sendMessage, loadMore, refresh: load };
}
