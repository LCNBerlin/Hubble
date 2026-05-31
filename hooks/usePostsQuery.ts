import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "../lib/api";
import type { PostRow } from "../lib/supabase-profiles";

export function useFeedQuery(userId: string | undefined, limit = 50, offset = 0) {
  return useQuery({
    queryKey: ["feed", userId, offset],
    queryFn: () => apiGet<PostRow[]>(`/feed?limit=${limit}&offset=${offset}`),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function usePostsByUserQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["posts", "user", userId],
    queryFn: () => apiGet<PostRow[]>(`/posts/by-user/${userId}`),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function usePostEngagementQuery(postIds: string[], userId: string | undefined) {
  return useQuery({
    queryKey: ["engagement", postIds.join(","), userId],
    queryFn: () => apiGet<{ counts: Record<string, { likes: number; comments: number; reposts: number }>; userState: Record<string, { liked: boolean; reposted: boolean; saved: boolean }> }>(`/posts/engagement?ids=${postIds.join(",")}`),
    enabled: !!userId && postIds.length > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useToggleLikeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => apiPost<{ liked: boolean; count: number }>(`/posts/${postId}/like`),
    onSuccess: (_data, postId) => {
      qc.invalidateQueries({ queryKey: ["engagement"] });
    },
  });
}

export function useDeletePostMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => apiDelete(`/posts/${postId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}
