import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import supabase from "../lib/supabase";

export type RepostState = { isReposted: boolean; repostCount: number };

export function usePostReposts(postIds: string[]) {
  const { user } = useAuth();
  const [repostMap, setRepostMap] = useState<Record<string, RepostState>>({});
  const pendingRef = useRef<Map<string, RepostState>>(new Map());

  const fetchReposts = useCallback(async () => {
    if (!supabase || !user?.id || postIds.length === 0) {
      setRepostMap({});
      return;
    }
    const ids = [...new Set(postIds)];
    const [countsRes, myRepostsRes] = await Promise.all([
      supabase.from("reposts").select("post_id").in("post_id", ids),
      supabase.from("reposts").select("post_id").eq("user_id", user.id).in("post_id", ids),
    ]);
    const countByPost: Record<string, number> = {};
    ids.forEach((id) => (countByPost[id] = 0));
    (countsRes.data ?? []).forEach((r: { post_id: string }) => {
      countByPost[r.post_id] = (countByPost[r.post_id] ?? 0) + 1;
    });
    const repostedSet = new Set((myRepostsRes.data ?? []).map((r: { post_id: string }) => r.post_id));
    const serverState: Record<string, RepostState> = {};
    ids.forEach((id) => {
      serverState[id] = { isReposted: repostedSet.has(id), repostCount: countByPost[id] ?? 0 };
    });
    setRepostMap((prev) => {
      const merged = { ...serverState };
      pendingRef.current.forEach((state, id) => {
        merged[id] = state;
      });
      return merged;
    });
  }, [user?.id, postIds.join(",")]);

  useEffect(() => {
    fetchReposts();
  }, [fetchReposts]);

  const toggleRepost = useCallback(
    async (postId: string) => {
      if (!supabase || !user?.id) return;
      const current = repostMap[postId] ?? { isReposted: false, repostCount: 0 };
      const nextReposted = !current.isReposted;
      const optimisticState: RepostState = {
        isReposted: nextReposted,
        repostCount: Math.max(0, current.repostCount + (nextReposted ? 1 : -1)),
      };
      pendingRef.current.set(postId, optimisticState);
      setRepostMap((prev) => ({ ...prev, [postId]: optimisticState }));
      if (nextReposted) {
        const { error } = await supabase.from("reposts").insert({ user_id: user.id, post_id: postId });
        if (error) {
          setRepostMap((prev) => ({ ...prev, [postId]: current }));
          if (__DEV__) console.warn("[usePostReposts] insert failed:", error.message);
        }
        pendingRef.current.delete(postId);
      } else {
        const { error } = await supabase.from("reposts").delete().eq("user_id", user.id).eq("post_id", postId);
        if (error) {
          setRepostMap((prev) => ({ ...prev, [postId]: current }));
          if (__DEV__) console.warn("[usePostReposts] delete failed:", error.message);
        }
        pendingRef.current.delete(postId);
      }
    },
    [user?.id, repostMap]
  );

  const getState = useCallback(
    (postId: string): RepostState => repostMap[postId] ?? { isReposted: false, repostCount: 0 },
    [repostMap]
  );

  return { getState, toggleRepost, refresh: fetchReposts };
}
