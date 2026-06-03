import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";
import { rowToProduct } from "../lib/supabase-products";
import { useAuth } from "../context/AuthContext";
import type { Product } from "../lib/product-types";

export type CartItem = { product: Product; quantity: number; selectedTierIndex?: number };

export function useCartQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      const rows = await apiGet<Record<string, unknown>[]>("/cart");
      if (!Array.isArray(rows) || rows.length === 0) return [] as CartItem[];
      return rows
        .map((r) => {
          const product = rowToProduct(r as Parameters<typeof rowToProduct>[0]);
          if (!product?.id) return null;
          return {
            product,
            quantity: (r.quantity as number) ?? 1,
            selectedTierIndex: (r.selected_tier_index as number) ?? 0,
          } as CartItem;
        })
        .filter((x): x is CartItem => x !== null);
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

export function useCartCount() {
  const { data = [] } = useCartQuery();
  return data.reduce((s, i) => s + i.quantity, 0);
}

export function useAddToCartMutation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ product, quantity = 1, selectedTierIndex = 0 }: { product: Product; quantity?: number; selectedTierIndex?: number }) => {
      if (!user?.id) return;
      await apiPost("/cart/items", { productId: product.id, quantity, selectedTierIndex });
    },
    onMutate: async ({ product, quantity = 1, selectedTierIndex = 0 }) => {
      await qc.cancelQueries({ queryKey: ["cart"] });
      const prev = qc.getQueryData<CartItem[]>(["cart"]) ?? [];
      const tier = product.priceTiers?.length ? Math.max(0, Math.min(selectedTierIndex, product.priceTiers.length - 1)) : 0;
      const existing = prev.find((i) => i.product.id === product.id);
      const next = existing
        ? prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i)
        : [...prev, { product, quantity, selectedTierIndex: tier }];
      qc.setQueryData(["cart"], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["cart"], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["cart"] }); },
  });
}

export function useUpdateCartTierMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, selectedTierIndex }: { productId: string; selectedTierIndex: number }) =>
      apiPatch(`/cart/items/${productId}`, { selectedTierIndex }),
    onMutate: async ({ productId, selectedTierIndex }) => {
      await qc.cancelQueries({ queryKey: ["cart"] });
      const prev = qc.getQueryData<CartItem[]>(["cart"]) ?? [];
      qc.setQueryData(["cart"], prev.map((i) => i.product.id === productId ? { ...i, selectedTierIndex } : i));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["cart"], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["cart"] }); },
  });
}

export function useRemoveFromCartMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => apiDelete(`/cart/items/${productId}`),
    onMutate: async (productId) => {
      await qc.cancelQueries({ queryKey: ["cart"] });
      const prev = qc.getQueryData<CartItem[]>(["cart"]) ?? [];
      qc.setQueryData(["cart"], prev.filter((i) => i.product.id !== productId));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["cart"], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["cart"] }); },
  });
}

export function useUpdateCartQuantityMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      if (quantity < 1) return apiDelete(`/cart/items/${productId}`);
      return apiPatch(`/cart/items/${productId}`, { quantity });
    },
    onMutate: async ({ productId, quantity }) => {
      await qc.cancelQueries({ queryKey: ["cart"] });
      const prev = qc.getQueryData<CartItem[]>(["cart"]) ?? [];
      const next = quantity < 1
        ? prev.filter((i) => i.product.id !== productId)
        : prev.map((i) => i.product.id === productId ? { ...i, quantity } : i);
      qc.setQueryData(["cart"], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["cart"], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["cart"] }); },
  });
}

export function useClearCartMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete("/cart"),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["cart"] });
      const prev = qc.getQueryData<CartItem[]>(["cart"]) ?? [];
      qc.setQueryData(["cart"], []);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["cart"], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["cart"] }); },
  });
}
