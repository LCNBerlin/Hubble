import { useCallback, useEffect, useState } from "react";
import supabase from "../lib/supabase";

export function usePostCommentCounts(postIds: string[]) {
  const [countMap, setCountMap] = useState<Record<string, number>>({});

  const fetchCounts = useCallback(async () => {
    if (!supabase || postIds.length === 0) {
      setCountMap({});
      return;
    }
    const ids = [...new Set(postIds)];
    const { data, error } = await supabase
      .from("post_comments")
      .select("post_id")
      .in("post_id", ids);
    if (error) {
      setCountMap({});
      return;
    }
    const countByPost: Record<string, number> = {};
    ids.forEach((id) => (countByPost[id] = 0));
    (data ?? []).forEach((r: { post_id: string }) => {
      countByPost[r.post_id] = (countByPost[r.post_id] ?? 0) + 1;
    });
    setCountMap(countByPost);
  }, [postIds.join(",")]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const getCommentCount = useCallback(
    (postId: string): number => countMap[postId] ?? 0,
    [countMap]
  );

  return { getCommentCount, refresh: fetchCounts };
}
