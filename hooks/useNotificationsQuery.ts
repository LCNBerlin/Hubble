import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import type { NotificationWithActor } from "../lib/notifications";

export function useNotificationsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => apiGet<NotificationWithActor[]>("/notifications"),
    enabled: !!userId,
    staleTime: 10_000,
    refetchInterval: 3_000,
  });
}

export function useUnreadCountQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications", "unread-count", userId],
    queryFn: () => apiGet<{ count: number }>("/notifications/unread-count"),
    enabled: !!userId,
    staleTime: 5_000,
    refetchInterval: 3_000,
    select: (data) => data.count,
  });
}

export function useMarkAllReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPatch("/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
