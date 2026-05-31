import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "../lib/api";
import type { ProfileRow } from "../lib/supabase-profiles";

export function useProfileQuery(profileId: string | undefined) {
  return useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => apiGet<ProfileRow>(`/profiles/${profileId}`),
    enabled: !!profileId,
    staleTime: 60_000,
  });
}

export function useMyProfileQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", "me", userId],
    queryFn: () => apiGet<ProfileRow>("/profiles/me"),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useUpdateProfileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ProfileRow>) => apiPatch<ProfileRow>("/profiles/me", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
    },
  });
}
