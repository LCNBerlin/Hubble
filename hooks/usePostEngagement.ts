import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiGet, apiPost } from "../lib/api";

export interface EngagementState {
  isLiked: boolean;
  likeCount: number;
  isDisliked: boolean;
  dislikeCount: number;
  isReposted: boolean;
  repostCount: number;
  commentCount: number;
}

const DEFAULT: EngagementState = {
  isLiked: false,
  likeCount: 0,
  isDisliked: false,
  dislikeCount: 0,
  isReposted: false,
  repostCount: 0,
  commentCount: 0,
};

export function usePostEngagement(postIds: string[]) {
  const { user } = useAuth();
  const [engagementMap, setEngagementMap] = useState<Record<string, EngagementState>>({});
  const pendingRef = useRef<Map<string, EngagementState>>(new Map());
  const idsKey = postIds.join(",");

  const fetchAll = useCallback(async () => {
    if (!user?.id || postIds.length === 0) {
      setEngagementMap({});
      return;
    }
    const ids = [...new Set(postIds)];
    try {
      const { counts, userState } = await apiGet<{
        counts: Record<string, { likes: number; comments: number; reposts: number }>;
        userState: Record<string, { liked: boolean; reposted: boolean; saved: boolean }>;
      }>(`/posts/engagement?ids=${ids.join(",")}`);

      const serverState: Record<string, EngagementState> = {};
      ids.forEach((id) => {
        serverState[id] = {
          isLiked: userState[id]?.liked ?? false,
          likeCount: counts[id]?.likes ?? 0,
          isDisliked: false,
          dislikeCount: 0,
          isReposted: userState[id]?.reposted ?? false,
          repostCount: counts[id]?.reposts ?? 0,
          commentCount: counts[id]?.comments ?? 0,
        };
      });

      setEngagementMap((prev) => {
        const merged = { ...serverState };
        pendingRef.current.forEach((state, id) => { merged[id] = state; });
        return merged;
      });
    } catch {}
  }, [user?.id, idsKey]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const toggleLike = useCallback(async (postId: string) => {
    if (!user?.id) return;
    const current = engagementMap[postId] ?? DEFAULT;
    const nextLiked = !current.isLiked;
    const optimistic: EngagementState = {
      ...current,
      isLiked: nextLiked,
      likeCount: Math.max(0, current.likeCount + (nextLiked ? 1 : -1)),
      ...(current.isDisliked && { isDisliked: false, dislikeCount: Math.max(0, current.dislikeCount - 1) }),
    };
    pendingRef.current.set(postId, optimistic);
    setEngagementMap((prev) => ({ ...prev, [postId]: optimistic }));
    try {
      const result = await apiPost<{ liked: boolean; count: number }>(`/posts/${postId}/like`);
      setEngagementMap((prev) => ({
        ...prev,
        [postId]: { ...(prev[postId] ?? DEFAULT), isLiked: result.liked, likeCount: result.count },
      }));
    } catch {
      setEngagementMap((prev) => ({ ...prev, [postId]: current }));
    }
    pendingRef.current.delete(postId);
  }, [user?.id, engagementMap]);

  const toggleDislike = useCallback(async (postId: string) => {
    if (!user?.id) return;
    const current = engagementMap[postId] ?? DEFAULT;
    const nextDisliked = !current.isDisliked;
    const optimistic: EngagementState = {
      ...current,
      isDisliked: nextDisliked,
      dislikeCount: Math.max(0, current.dislikeCount + (nextDisliked ? 1 : -1)),
      ...(current.isLiked && { isLiked: false, likeCount: Math.max(0, current.likeCount - 1) }),
    };
    pendingRef.current.set(postId, optimistic);
    setEngagementMap((prev) => ({ ...prev, [postId]: optimistic }));
    // Note: dislikes are client-only tracking; no server endpoint currently
    pendingRef.current.delete(postId);
  }, [user?.id, engagementMap]);

  const toggleRepost = useCallback(async (postId: string) => {
    if (!user?.id) return;
    const current = engagementMap[postId] ?? DEFAULT;
    const nextReposted = !current.isReposted;
    const optimistic: EngagementState = {
      ...current,
      isReposted: nextReposted,
      repostCount: Math.max(0, current.repostCount + (nextReposted ? 1 : -1)),
    };
    pendingRef.current.set(postId, optimistic);
    setEngagementMap((prev) => ({ ...prev, [postId]: optimistic }));
    try {
      const result = await apiPost<{ reposted: boolean; count: number }>(`/posts/${postId}/repost`);
      setEngagementMap((prev) => ({
        ...prev,
        [postId]: { ...(prev[postId] ?? DEFAULT), isReposted: result.reposted, repostCount: result.count },
      }));
    } catch {
      setEngagementMap((prev) => ({ ...prev, [postId]: current }));
    }
    pendingRef.current.delete(postId);
  }, [user?.id, engagementMap]);

  const getEngagement = useCallback(
    (postId: string): EngagementState => engagementMap[postId] ?? DEFAULT,
    [engagementMap]
  );

  return { getEngagement, toggleLike, toggleDislike, toggleRepost, refresh: fetchAll };
}
