import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "../lib/api";
import { rowToProduct } from "../lib/supabase-products";
import { useAuth } from "../context/AuthContext";
import type { Product } from "../lib/product-types";

export function useWishlistQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const rows = await apiGet<Record<string, unknown>[]>("/wishlist");
      if (!Array.isArray(rows) || rows.length === 0) return [] as Product[];
      return rows
        .map((r) => rowToProduct(r as Parameters<typeof rowToProduct>[0]))
        .filter((p): p is Product => !!p?.id);
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}

export function useToggleWishlistMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (product: Product) => {
      const items = qc.getQueryData<Product[]>(["wishlist"]) ?? [];
      if (items.some((p) => p.id === product.id)) {
        return apiDelete(`/wishlist/${product.id}`);
      }
      return apiPost(`/wishlist/${product.id}`);
    },
    onMutate: async (product) => {
      await qc.cancelQueries({ queryKey: ["wishlist"] });
      const prev = qc.getQueryData<Product[]>(["wishlist"]) ?? [];
      const isIn = prev.some((p) => p.id === product.id);
      const next = isIn ? prev.filter((p) => p.id !== product.id) : [...prev, product];
      qc.setQueryData(["wishlist"], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["wishlist"], ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["wishlist"] }); },
  });
}
