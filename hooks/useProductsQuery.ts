import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";
import { rowToProduct } from "../lib/supabase-products";
import type { Product, ProductReview } from "../lib/product-types";

function rowsToProducts(rows: Record<string, unknown>[]): Product[] {
  return rows
    .map((r) => rowToProduct(r as Parameters<typeof rowToProduct>[0]))
    .filter((p): p is Product => !!p?.id);
}

export function useProductQuery(productId: string | undefined) {
  return useQuery({
    queryKey: ["product", productId],
    queryFn: () => apiGet<Record<string, unknown>>(`/products/${productId}`).then((r) => rowToProduct(r as Parameters<typeof rowToProduct>[0])),
    enabled: !!productId,
    staleTime: 60_000,
  });
}

export function useProductsByUserQuery(userId: string | undefined) {
  return useQuery({
    queryKey: ["products", "user", userId],
    queryFn: () => apiGet<Record<string, unknown>[]>(`/products/by-creator/${userId}`).then(rowsToProducts),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useProductReviewsQuery(productId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const data = await apiGet<{ id: string; product_id: string; user_id: string; rating: number; body: string | null; created_at: string }[]>(`/products/${productId}/reviews`);
      if (!Array.isArray(data)) return [] as ProductReview[];
      return data.map((r) => ({
        id: r.id,
        productId: r.product_id,
        userId: r.user_id,
        rating: r.rating,
        body: r.body ?? undefined,
        createdAt: new Date(r.created_at).getTime(),
      } as ProductReview));
    },
    enabled: !!productId,
    staleTime: 60_000,
  });
}

export function useUpdateProductMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Product> }) =>
      apiPatch(`/products/${id}`, updates),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["product", id] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteProductMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => apiDelete(`/products/${productId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); },
  });
}

export function useAddProductReviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, rating, body }: { productId: string; rating: number; body?: string }) =>
      apiPost<{ id: string; created_at: string }>(`/products/${productId}/reviews`, { rating, body }),
    onSuccess: (_d, { productId }) => {
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
    },
  });
}
