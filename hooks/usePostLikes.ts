import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import supabase from "../lib/supabase";

export type LikeState = { isLiked: boolean; likeCount: number };

export function usePostLikes(postIds: string[]) {
  const { user } = useAuth();
  const [likeMap, setLikeMap] = useState<Record<string, LikeState>>({});
  const pendingRef = useRef<Map<string, LikeState>>(new Map());

  const fetchLikes = useCallback(async () => {
    if (!supabase || !user?.id || postIds.length === 0) {
      setLikeMap({});
      return;
    }
    const ids = [...new Set(postIds)];
    const [countsRes, myLikesRes] = await Promise.all([
      supabase.from("post_likes").select("post_id").in("post_id", ids),
      supabase.from("post_likes").select("post_id").eq("user_id", user.id).in("post_id", ids),
    ]);
    const countByPost: Record<string, number> = {};
    ids.forEach((id) => (countByPost[id] = 0));
    (countsRes.data ?? []).forEach((r: { post_id: string }) => {
      countByPost[r.post_id] = (countByPost[r.post_id] ?? 0) + 1;
    });
    const likedSet = new Set((myLikesRes.data ?? []).map((r: { post_id: string }) => r.post_id));
    const serverState: Record<string, LikeState> = {};
    ids.forEach((id) => {
      serverState[id] = { isLiked: likedSet.has(id), likeCount: countByPost[id] ?? 0 };
    });
    setLikeMap((prev) => {
      const merged = { ...serverState };
      pendingRef.current.forEach((state, id) => {
        merged[id] = state;
      });
      return merged;
    });
  }, [user?.id, postIds.join(",")]);

  useEffect(() => {
    fetchLikes();
  }, [fetchLikes]);

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!supabase || !user?.id) return;
      const current = likeMap[postId] ?? { isLiked: false, likeCount: 0 };
      const nextLiked = !current.isLiked;
      const optimisticState: LikeState = {
        isLiked: nextLiked,
        likeCount: Math.max(0, current.likeCount + (nextLiked ? 1 : -1)),
      };
      pendingRef.current.set(postId, optimisticState);
      setLikeMap((prev) => ({ ...prev, [postId]: optimisticState }));
      if (nextLiked) {
        const { error } = await supabase.from("post_likes").insert({ user_id: user.id, post_id: postId });
        if (error) {
          setLikeMap((prev) => ({ ...prev, [postId]: current }));
          if (__DEV__) console.warn("[usePostLikes] insert failed:", error.message);
        }
        pendingRef.current.delete(postId);
      } else {
        const { error } = await supabase.from("post_likes").delete().eq("user_id", user.id).eq("post_id", postId);
        if (error) {
          setLikeMap((prev) => ({ ...prev, [postId]: current }));
          if (__DEV__) console.warn("[usePostLikes] delete failed:", error.message);
        }
        pendingRef.current.delete(postId);
      }
    },
    [user?.id, likeMap]
  );

  const getState = useCallback(
    (postId: string): LikeState => likeMap[postId] ?? { isLiked: false, likeCount: 0 },
    [likeMap]
  );

  return { getState, toggleLike, refresh: fetchLikes };
}
