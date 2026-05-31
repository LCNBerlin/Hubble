/**
 * Messaging: API wrappers for conversations and messages.
 * Supabase realtime subscriptions replaced with polling in Phase 5.
 */

import { apiGet, apiPost, apiPatch, apiDelete } from "./api";

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

export async function fetchConversations(_userId: string): Promise<ConversationWithMeta[]> {
  return apiGet<ConversationWithMeta[]>("/messaging/conversations");
}

export async function getConversationPeerUserId(conversationId: string, _currentUserId: string): Promise<string | null> {
  const peer = await apiGet<{ user_id: string } | null>(`/messaging/conversations/${conversationId}/peer`);
  return peer?.user_id ?? null;
}

export async function fetchConversationPeer(conversationId: string, _currentUserId: string): Promise<{ display_name: string; username: string; avatar_url: string | null; verified_tier: string; reputation_score: number } | null> {
  return apiGet(`/messaging/conversations/${conversationId}/peer`);
}

export async function getOrCreateDM(_userId: string, otherUserId: string): Promise<Conversation | null> {
  return apiPost<Conversation>("/messaging/conversations", { peerId: otherUserId });
}

export async function fetchMessages(conversationId: string, limit = 50, before?: string): Promise<Message[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set("before", before);
  return apiGet<Message[]>(`/messaging/conversations/${conversationId}/messages?${params}`);
}

/** Stub — replaced with polling in Phase 5. Returns a no-op cleanup function. */
export function subscribeToMessages(
  _conversationId: string,
  _onInsert: (payload: { new: Message }) => void,
  _onUpdate?: (payload: { new: Message }) => void
): { unsubscribe: () => void } | null {
  return null;
}

export async function sendMessage(conversationId: string, _senderId: string, body: string, options?: { parent_id?: string; type?: MessageType; metadata?: Record<string, unknown> }): Promise<Message | null> {
  return apiPost<Message>(`/messaging/conversations/${conversationId}/messages`, { body, ...options });
}

export async function markConversationRead(conversationId: string, _userId: string): Promise<void> {
  await apiPatch(`/messaging/conversations/${conversationId}/read`);
}

export async function updateParticipant(conversationId: string, _userId: string, updates: { pinned?: boolean; muted?: boolean; archived?: boolean }): Promise<boolean> {
  try {
    await apiPatch(`/messaging/conversations/${conversationId}/participant`, updates);
    return true;
  } catch {
    return false;
  }
}

export async function fetchReactions(messageIds: string[]): Promise<MessageReaction[]> {
  if (!messageIds.length) return [];
  return apiGet<MessageReaction[]>(`/messaging/reactions?ids=${messageIds.join(",")}`);
}

export async function toggleReaction(messageId: string, _userId: string, emoji: string): Promise<void> {
  await apiPost(`/messaging/messages/${messageId}/reactions`, { emoji });
}
