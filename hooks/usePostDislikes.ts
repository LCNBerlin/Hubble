import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import supabase from "../lib/supabase";

export type DislikeState = { isDisliked: boolean; dislikeCount: number };

export function usePostDislikes(postIds: string[]) {
  const { user } = useAuth();
  const [dislikeMap, setDislikeMap] = useState<Record<string, DislikeState>>({});
  const pendingRef = useRef<Map<string, DislikeState>>(new Map());

  const fetchDislikes = useCallback(async () => {
    if (!supabase || !user?.id || postIds.length === 0) {
      setDislikeMap({});
      return;
    }
    const ids = [...new Set(postIds)];
    const [countsRes, myDislikesRes] = await Promise.all([
      supabase.from("post_dislikes").select("post_id").in("post_id", ids),
      supabase.from("post_dislikes").select("post_id").eq("user_id", user.id).in("post_id", ids),
    ]);
    const countByPost: Record<string, number> = {};
    ids.forEach((id) => (countByPost[id] = 0));
    (countsRes.data ?? []).forEach((r: { post_id: string }) => {
      countByPost[r.post_id] = (countByPost[r.post_id] ?? 0) + 1;
    });
    const dislikedSet = new Set((myDislikesRes.data ?? []).map((r: { post_id: string }) => r.post_id));
    const serverState: Record<string, DislikeState> = {};
    ids.forEach((id) => {
      serverState[id] = { isDisliked: dislikedSet.has(id), dislikeCount: countByPost[id] ?? 0 };
    });
    setDislikeMap((prev) => {
      const merged = { ...serverState };
      pendingRef.current.forEach((state, id) => {
        merged[id] = state;
      });
      return merged;
    });
  }, [user?.id, postIds.join(",")]);

  useEffect(() => {
    fetchDislikes();
  }, [fetchDislikes]);

  const toggleDislike = useCallback(
    async (postId: string) => {
      if (!supabase || !user?.id) return;
      const current = dislikeMap[postId] ?? { isDisliked: false, dislikeCount: 0 };
      const nextDisliked = !current.isDisliked;
      const optimisticState: DislikeState = {
        isDisliked: nextDisliked,
        dislikeCount: Math.max(0, current.dislikeCount + (nextDisliked ? 1 : -1)),
      };
      pendingRef.current.set(postId, optimisticState);
      setDislikeMap((prev) => ({ ...prev, [postId]: optimisticState }));
      if (nextDisliked) {
        const { error } = await supabase.from("post_dislikes").insert({ user_id: user.id, post_id: postId });
        if (error) {
          setDislikeMap((prev) => ({ ...prev, [postId]: current }));
          if (__DEV__) console.warn("[usePostDislikes] insert failed:", error.message);
        }
        pendingRef.current.delete(postId);
      } else {
        const { error } = await supabase.from("post_dislikes").delete().eq("user_id", user.id).eq("post_id", postId);
        if (error) {
          setDislikeMap((prev) => ({ ...prev, [postId]: current }));
          if (__DEV__) console.warn("[usePostDislikes] delete failed:", error.message);
        }
        pendingRef.current.delete(postId);
      }
    },
    [user?.id, dislikeMap]
  );

  const getState = useCallback(
    (postId: string): DislikeState => dislikeMap[postId] ?? { isDisliked: false, dislikeCount: 0 },
    [dislikeMap]
  );

  return { getState, toggleDislike, refresh: fetchDislikes };
}
