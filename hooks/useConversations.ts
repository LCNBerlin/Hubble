import { useCallback, useEffect, useState } from "react";
import type { ConversationWithMeta } from "../lib/conversations";
import { fetchConversations, updateParticipant } from "../lib/conversations";

export type ConversationCategory = "all" | "priority" | "main" | "groups" | "escrow" | "bookings";

export function useConversations(userId: string | undefined) {
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ConversationCategory>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await fetchConversations(userId);
    setConversations(list);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const pin = useCallback(
    async (conversationId: string) => {
      if (!userId) return false;
      const ok = await updateParticipant(conversationId, userId, { pinned: true });
      if (ok) load();
      return ok;
    },
    [userId, load]
  );

  const unpin = useCallback(
    async (conversationId: string) => {
      if (!userId) return false;
      const ok = await updateParticipant(conversationId, userId, { pinned: false });
      if (ok) load();
      return ok;
    },
    [userId, load]
  );

  const archive = useCallback(
    async (conversationId: string) => {
      if (!userId) return false;
      const ok = await updateParticipant(conversationId, userId, { archived: true });
      if (ok) load();
      return ok;
    },
    [userId, load]
  );

  const mute = useCallback(
    async (conversationId: string, muted: boolean) => {
      if (!userId) return false;
      const ok = await updateParticipant(conversationId, userId, { muted });
      if (ok) load();
      return ok;
    },
    [userId, load]
  );

  const filtered = conversations.filter((c) => {
    if (category !== "all") {
      const tags = (c as unknown as { contact_meta?: { tags?: string[]; pipeline_stage?: string } }).contact_meta?.tags ?? [];
      const stage = (c as unknown as { contact_meta?: { pipeline_stage?: string } }).contact_meta?.pipeline_stage;
      if (category === "priority" && !tags.includes("priority") && stage !== "priority") return false;
      if (category === "main" && (tags.includes("priority") || stage === "priority")) return false;
      if (category === "groups" && c.type !== "group") return false;
      if (category === "escrow" && !(c as unknown as { has_escrow?: boolean }).has_escrow) return false;
      if (category === "bookings" && !(c as unknown as { has_booking?: boolean }).has_booking) return false;
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      const match = c.participants?.some(
        (p) =>
          (p.profile as { display_name?: string; username?: string })?.display_name?.toLowerCase().includes(term) ||
          (p.profile as { username?: string })?.username?.toLowerCase().includes(term)
      );
      if (!match) return false;
    }
    return !c.my_participant?.archived;
  });

  return {
    conversations: filtered,
    loading,
    category,
    setCategory,
    search,
    setSearch,
    refresh: load,
    pin,
    unpin,
    archive,
    mute,
  };
}
