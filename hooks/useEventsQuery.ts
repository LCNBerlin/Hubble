import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../lib/api";
import type { Event } from "../lib/product-types";

export function useEventsByUserQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["events", "user", userId],
    queryFn: async () => {
      const data = await apiGet<{ id: string; title: string; description: string | null; date: number; created_at: string }[]>(`/events/user/${userId}`);
      if (!Array.isArray(data)) return [] as Event[];
      return data.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description ?? undefined,
        date: row.date,
        createdAt: new Date(row.created_at).getTime(),
      } as Event));
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useCreateEventMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description?: string; date: number }) =>
      apiPost("/events", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); },
  });
}
