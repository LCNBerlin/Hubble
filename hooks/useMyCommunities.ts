import { useCallback, useEffect, useState } from "react";
import supabase from "../lib/supabase";

export type CommunityProfile = {
  id: string;
  display_name: string | null;
  username: string;
  avatar_url: string | null;
};

export function useMyCommunities(userId: string | undefined) {
  const [communities, setCommunities] = useState<CommunityProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId || !supabase) {
      setCommunities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: follows, error: followsErr } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);
    if (followsErr || !follows?.length) {
      setCommunities([]);
      setLoading(false);
      return;
    }
    const ids = (follows as { following_id: string }[]).map((r) => r.following_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", ids);
    setCommunities((profiles ?? []) as CommunityProfile[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { communities, loading, refresh: load };
}
