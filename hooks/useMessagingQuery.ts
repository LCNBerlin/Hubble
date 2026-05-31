import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "../lib/api";
import type { ConversationWithMeta, Message } from "../lib/conversations";

export function useConversationsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["conversations", userId],
    queryFn: () => apiGet<ConversationWithMeta[]>("/messaging/conversations"),
    enabled: !!userId,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
}

export function useMessagesQuery(conversationId: string | null, userId: string | undefined) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => apiGet<Message[]>(`/messaging/conversations/${conversationId}/messages`),
    enabled: !!conversationId && !!userId,
    staleTime: 0,
    refetchInterval: 3_000,
  });
}

export function useSendMessageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      apiPost<Message>(`/messaging/conversations/${conversationId}/messages`, { body }),
    onSuccess: (_msg, { conversationId }) => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useMarkReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => apiPatch(`/messaging/conversations/${conversationId}/read`),
    onSuccess: (_data, conversationId) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
    },
  });
}
