/**
 * Messaging: Supabase queries and Realtime for conversations and messages.
 */

import type { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "./supabase";

export type ConversationType = "direct" | "group";

export type Conversation = {
  id: string;
  type: ConversationType;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationParticipant = {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
  pinned: boolean;
  muted: boolean;
  archived: boolean;
};

export type MessageType = "text" | "voice" | "file" | "system";

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  parent_id: string | null;
  type: MessageType;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type MessageReaction = {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type ConversationWithMeta = Conversation & {
  participants?: { user_id: string; profile?: { display_name: string; username: string; avatar_url: string | null; verified_tier: string } }[];
  last_message?: { body: string; created_at: string; sender_id: string } | null;
  last_message_at?: string | null;
  unread_count?: number;
  my_participant?: ConversationParticipant;
};

/** Fetch conversations for the current user with last message and participant profiles. */
export async function fetchConversations(userId: string): Promise<ConversationWithMeta[]> {
  const { data: participants, error: epErr } = await supabase
    ?.from("conversation_participants")
    .select("conversation_id, last_read_at, pinned, muted, archived")
    .eq("user_id", userId) ?? { data: null, error: null };

  if (epErr || !participants?.length) return [];

  const convIds = participants.map((p) => p.conversation_id);

  const { data: convs, error: cErr } = await supabase
    ?.from("conversations")
    .select("id, type, title, created_at, updated_at")
    .in("id", convIds)
    .order("updated_at", { ascending: false }) ?? { data: null, error: null };

  if (cErr || !convs?.length) return [];

  const partMap = new Map(participants.map((p) => [p.conversation_id, p]));

  const lastMessages = await Promise.all(
    convIds.map(async (cid) => {
      const { data } = await supabase
        ?.from("messages")
        .select("body, created_at, sender_id")
        .eq("conversation_id", cid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle() ?? { data: null };
      return { conversation_id: cid, last: data };
    })
  );
  const lastMap = new Map(lastMessages.map((m) => [m.conversation_id, m.last]));

  const allPartForConvs = await supabase
    ?.from("conversation_participants")
    .select("conversation_id, user_id")
    .in("conversation_id", convIds) ?? { data: [] };
  const otherUserIds = new Set<string>();
  (allPartForConvs.data ?? []).forEach((p: { conversation_id: string; user_id: string }) => {
    if (p.user_id !== userId) otherUserIds.add(p.user_id);
  });

  const { data: profiles } = await supabase
    ?.from("profiles")
    .select("id, display_name, username, avatar_url, verified_tier")
    .in("id", Array.from(otherUserIds)) ?? { data: [] };
  const profileMap = new Map((profiles ?? []).map((p: { id: string }) => [p.id, p]));

  const convParticipants = (allPartForConvs.data ?? []) as { conversation_id: string; user_id: string }[];
  const participantsByConv = new Map<string, { user_id: string; profile?: unknown }[]>();
  convParticipants.forEach((p) => {
    const list = participantsByConv.get(p.conversation_id) ?? [];
    list.push({ user_id: p.user_id, profile: profileMap.get(p.user_id) });
    participantsByConv.set(p.conversation_id, list);
  });

  return convs.map((c) => {
    const myPart = partMap.get(c.id);
    const last = lastMap.get(c.id);
    const unread =
      myPart?.last_read_at && last
        ? new Date(last.created_at) > new Date(myPart.last_read_at)
          ? 1
          : 0
        : last
          ? 1
          : 0;
    return {
      ...c,
      participants: participantsByConv.get(c.id) ?? [],
      last_message: last ?? null,
      last_message_at: last?.created_at ?? null,
      unread_count: unread,
      my_participant: myPart
        ? {
            conversation_id: c.id,
            user_id: userId,
            joined_at: "",
            last_read_at: myPart.last_read_at,
            pinned: myPart.pinned,
            muted: myPart.muted,
            archived: myPart.archived,
          }
        : undefined,
    } as ConversationWithMeta;
  });
}

/** Get the other participant's user id in a DM. */
export async function getConversationPeerUserId(
  conversationId: string,
  currentUserId: string
): Promise<string | null> {
  const { data: participants } = await supabase
    ?.from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId) ?? { data: null };
  const other = (participants ?? []).find((p: { user_id: string }) => p.user_id !== currentUserId);
  return other?.user_id ?? null;
}

/** Fetch one conversation and the other participant's profile (for chat header). */
export async function fetchConversationPeer(
  conversationId: string,
  currentUserId: string
): Promise<{ display_name: string; username: string; avatar_url: string | null; verified_tier: string; reputation_score: number } | null> {
  const otherUserId = await getConversationPeerUserId(conversationId, currentUserId);
  if (!otherUserId) return null;
  const { data: profile } = await supabase
    ?.from("profiles")
    .select("display_name, username, avatar_url, verified_tier, reputation_score")
    .eq("id", otherUserId)
    .single() ?? { data: null };
  return profile as { display_name: string; username: string; avatar_url: string | null; verified_tier: string; reputation_score: number } | null;
}

/** Get or create a DM conversation between two users. */
export async function getOrCreateDM(userId: string, otherUserId: string): Promise<Conversation | null> {
  const { data: existing } = await supabase
    ?.from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId) ?? { data: null };

  if (!existing?.length) {
    const { data: conv, error: insertConv } = await supabase?.from("conversations").insert({ type: "direct" }).select("id, type, title, created_at, updated_at").single();
    if (insertConv || !conv) return null;
    await supabase?.from("conversation_participants").insert([
      { conversation_id: conv.id, user_id: userId },
      { conversation_id: conv.id, user_id: otherUserId },
    ]);
    return conv as Conversation;
  }

  const convIds = existing.map((r: { conversation_id: string }) => r.conversation_id);
  const { data: withOther } = await supabase
    ?.from("conversation_participants")
    .select("conversation_id")
    .in("conversation_id", convIds)
    .eq("user_id", otherUserId) ?? { data: null };

  if (withOther?.length) {
    const { data: conv } = await supabase?.from("conversations").select("id, type, title, created_at, updated_at").eq("id", withOther[0].conversation_id).single();
    return conv as Conversation | null;
  }

  const { data: conv, error: insertConv } = await supabase?.from("conversations").insert({ type: "direct" }).select("id, type, title, created_at, updated_at").single();
  if (insertConv || !conv) return null;
  await supabase?.from("conversation_participants").insert([
    { conversation_id: conv.id, user_id: userId },
    { conversation_id: conv.id, user_id: otherUserId },
  ]);
  return conv as Conversation;
}

/** Fetch messages for a conversation (paginated). */
export async function fetchMessages(
  conversationId: string,
  limit = 50,
  before?: string
): Promise<Message[]> {
  let q = supabase
    ?.from("messages")
    .select("id, conversation_id, sender_id, body, parent_id, type, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q?.lt("created_at", before);
  const { data, error } = await q ?? { data: null, error: null };
  if (error) return [];
  return (data ?? []).reverse() as Message[];
}

/** Subscribe to new/updated messages in a conversation. */
export function subscribeToMessages(
  conversationId: string,
  onInsert: (payload: { new: Message }) => void,
  onUpdate?: (payload: { new: Message }) => void
): RealtimeChannel | null {
  const channel = supabase
    ?.channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert({ new: payload.new as Message })
    );
  if (onUpdate) {
    channel?.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => onUpdate({ new: payload.new as Message })
    );
  }
  channel?.subscribe();
  return channel ?? null;
}

/** Send a text message. */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  options?: { parent_id?: string; type?: MessageType; metadata?: Record<string, unknown> }
): Promise<Message | null> {
  const { data, error } = await supabase
    ?.from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body,
      parent_id: options?.parent_id ?? null,
      type: options?.type ?? "text",
      metadata: options?.metadata ?? {},
    })
    .select("id, conversation_id, sender_id, body, parent_id, type, metadata, created_at")
    .single() ?? { data: null, error: null };
  if (error) return null;
  return data as Message;
}

/** Mark conversation as read for user. */
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  await supabase
    ?.from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
}

/** Update participant: pin, mute, or archive. */
export async function updateParticipant(
  conversationId: string,
  userId: string,
  updates: { pinned?: boolean; muted?: boolean; archived?: boolean }
): Promise<boolean> {
  const { error } = await supabase
    ?.from("conversation_participants")
    .update(updates)
    .eq("conversation_id", conversationId)
    .eq("user_id", userId) ?? { error: true };
  return !error;
}

/** Fetch reactions for a set of message ids. */
export async function fetchReactions(messageIds: string[]): Promise<MessageReaction[]> {
  if (!messageIds.length) return [];
  const { data } = await supabase
    ?.from("message_reactions")
    .select("message_id, user_id, emoji, created_at")
    .in("message_id", messageIds) ?? { data: [] };
  return (data ?? []) as MessageReaction[];
}

/** Add or remove reaction. */
export async function toggleReaction(messageId: string, userId: string, emoji: string): Promise<void> {
  const { data: existing } = await supabase
    ?.from("message_reactions")
    .select("message_id")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle() ?? { data: null };
  if (existing) {
    await supabase?.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", userId).eq("emoji", emoji);
  } else {
    await supabase?.from("message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
  }
}
