import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../lib/api";

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
    if (!userId) {
      setCommunities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const followingIds = await apiGet<string[]>(`/profiles/me/following-ids`);
      if (!followingIds?.length) { setCommunities([]); setLoading(false); return; }
      const profiles = await apiGet<CommunityProfile[]>(`/profiles/by-ids?ids=${followingIds.join(",")}`);
      setCommunities(profiles ?? []);
    } catch {
      setCommunities([]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { communities, loading, refresh: load };
}
