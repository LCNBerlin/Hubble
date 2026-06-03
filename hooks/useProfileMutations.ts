import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost, apiPatch, apiDelete, getStoredTokens } from "../lib/api";
import { uploadProfileImage } from "../lib/profileUpload";
import { useAuth } from "../context/AuthContext";

export function useFollowMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => apiPost(`/profiles/${targetId}/follow`),
    onMutate: async (targetId) => {
      await qc.cancelQueries({ queryKey: ["follow-status", targetId] });
      const prev = qc.getQueryData<{ isFollowing: boolean }>(["follow-status", targetId]);
      qc.setQueryData(["follow-status", targetId], { isFollowing: true });
      return { prev };
    },
    onError: (_e, targetId, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(["follow-status", targetId], ctx.prev);
    },
    onSettled: (_d, _e, targetId) => {
      qc.invalidateQueries({ queryKey: ["follow-status", targetId] });
      qc.invalidateQueries({ queryKey: ["profile", targetId] });
    },
  });
}

export function useUnfollowMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => apiDelete(`/profiles/${targetId}/follow`),
    onMutate: async (targetId) => {
      await qc.cancelQueries({ queryKey: ["follow-status", targetId] });
      const prev = qc.getQueryData<{ isFollowing: boolean }>(["follow-status", targetId]);
      qc.setQueryData(["follow-status", targetId], { isFollowing: false });
      return { prev };
    },
    onError: (_e, targetId, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(["follow-status", targetId], ctx.prev);
    },
    onSettled: (_d, _e, targetId) => {
      qc.invalidateQueries({ queryKey: ["follow-status", targetId] });
      qc.invalidateQueries({ queryKey: ["profile", targetId] });
    },
  });
}

export function useBlockMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => apiPost(`/profiles/${targetId}/block`),
    onMutate: async (targetId) => {
      await qc.cancelQueries({ queryKey: ["saved-data"] });
      const prev = qc.getQueryData<{ postIds: string[]; productIds: string[]; blockedIds: string[] }>(["saved-data"]);
      if (prev) {
        qc.setQueryData(["saved-data"], {
          ...prev,
          blockedIds: [...new Set([...prev.blockedIds, targetId])],
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["saved-data"], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["saved-data"] }); },
  });
}

export function useUnblockMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => apiDelete(`/profiles/${targetId}/block`),
    onMutate: async (targetId) => {
      await qc.cancelQueries({ queryKey: ["saved-data"] });
      const prev = qc.getQueryData<{ postIds: string[]; productIds: string[]; blockedIds: string[] }>(["saved-data"]);
      if (prev) {
        qc.setQueryData(["saved-data"], {
          ...prev,
          blockedIds: prev.blockedIds.filter((id) => id !== targetId),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["saved-data"], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["saved-data"] }); },
  });
}

export function useToggleSavePostMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => apiPost<{ saved: boolean }>(`/profiles/me/save-post/${postId}`),
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: ["saved-data"] });
      const prev = qc.getQueryData<{ postIds: string[]; productIds: string[]; blockedIds: string[] }>(["saved-data"]);
      if (prev) {
        const isSaved = prev.postIds.includes(postId);
        qc.setQueryData(["saved-data"], {
          ...prev,
          postIds: isSaved ? prev.postIds.filter((id) => id !== postId) : [...prev.postIds, postId],
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["saved-data"], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["saved-data"] }); },
  });
}

export function useToggleSaveProductMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => apiPost<{ saved: boolean }>(`/profiles/me/save-product/${productId}`),
    onMutate: async (productId) => {
      await qc.cancelQueries({ queryKey: ["saved-data"] });
      const prev = qc.getQueryData<{ postIds: string[]; productIds: string[]; blockedIds: string[] }>(["saved-data"]);
      if (prev) {
        const isSaved = prev.productIds.includes(productId);
        qc.setQueryData(["saved-data"], {
          ...prev,
          productIds: isSaved ? prev.productIds.filter((id) => id !== productId) : [...prev.productIds, productId],
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["saved-data"], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["saved-data"] }); },
  });
}

export function useSaveTagsMutation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (tags: string[]) => {
      if (!user?.id || !tags.length) return;
      const normalized = [...new Set(tags.map((t) => t.replace(/^#/, "").trim().toLowerCase()).filter(Boolean))];
      if (!normalized.length) return;
      const existing = qc.getQueryData<{ category_tags?: string[] | null }>(["profile", "me", user.id]);
      const merged = [...new Set([...(existing?.category_tags ?? []), ...normalized])];
      return apiPatch("/profiles/me", { categoryTags: merged });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile", "me"] }); },
  });
}

export function useUpdateAvatarMutation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ base64, mimeType }: { base64: string; mimeType?: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { accessToken } = await getStoredTokens();
      const url = await uploadProfileImage(user.id, "avatar", base64, mimeType, accessToken ?? undefined);
      await apiPatch("/profiles/me/avatar", { avatarUrl: url });
      return url;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile", "me"] }); },
  });
}
