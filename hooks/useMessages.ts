import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "../lib/conversations";
import { fetchMessages, sendMessage as sendMessageApi, markConversationRead } from "../lib/conversations";

const POLL_INTERVAL_MS = 3000;

export function useMessages(conversationId: string | null, userId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const lastMessageAtRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await fetchMessages(conversationId);
    if (list.length > 0) lastMessageAtRef.current = list[list.length - 1].created_at;
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

  // Polling for new messages (replaces Supabase realtime channel)
  useEffect(() => {
    if (!conversationId || !userId) return;
    const interval = setInterval(async () => {
      const since = lastMessageAtRef.current;
      if (!since) return;
      try {
        const newMsgs = await fetchMessages(conversationId, 50, undefined);
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const fresh = newMsgs.filter((m) => !existingIds.has(m.id));
          if (!fresh.length) return prev;
          if (fresh.length > 0) lastMessageAtRef.current = fresh[fresh.length - 1].created_at;
          return [
            ...prev.filter((m) => !String(m.id).startsWith("temp-")),
            ...fresh,
          ];
        });
      } catch {}
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
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
        lastMessageAtRef.current = msg.created_at;
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
