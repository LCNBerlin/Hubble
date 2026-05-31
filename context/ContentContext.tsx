import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";
export type { PostType, ProductType, PriceTier, ServiceSlot, ProductVariantOption, ProductVariant, ProductReview, Post, Product, Event } from "../lib/product-types";
import type { Post, Product, Event, ProductReview } from "../lib/product-types";

const STORAGE_KEY = "hubble_content";
const REVIEWS_STORAGE_KEY = "hubble_product_reviews";

type StoredContent = {
  posts: Post[];
  products: Product[];
  events: Event[];
};

type ContentContextType = {
  posts: Post[];
  products: Product[];
  events: Event[];
  productReviews: ProductReview[];
  addPost: (post: Omit<Post, "id">) => void;
  addProduct: (product: Omit<Product, "id">) => void;
  addProductFromServer: (product: Product) => void;
  addEvent: (event: Omit<Event, "id" | "createdAt">) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deletePost: (id: string) => void;
  deleteProduct: (id: string) => void;
  addProductReview: (review: Omit<ProductReview, "id" | "createdAt">) => void;
  getReviewsForProduct: (productId: string) => ProductReview[];
  loadReviewsForProduct: (productId: string) => Promise<void>;
};

const ContentContext = createContext<ContentContextType | null>(null);

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function ContentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [productReviews, setProductReviews] = useState<ProductReview[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [contentRaw, reviewsRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(REVIEWS_STORAGE_KEY),
        ]);
        if (contentRaw) {
          const data: StoredContent = JSON.parse(contentRaw);
          if (Array.isArray(data.posts)) setPosts(data.posts);
          if (Array.isArray(data.products)) setProducts(data.products);
          if (Array.isArray(data.events)) setEvents(data.events);
        }
        if (reviewsRaw) {
          const parsed = JSON.parse(reviewsRaw);
          if (Array.isArray(parsed)) setProductReviews(parsed);
        }
      } catch {}
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ posts, products, events })).catch(() => {});
  }, [hydrated, posts, products, events]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(productReviews)).catch(() => {});
  }, [hydrated, productReviews]);

  const addPost = useCallback((post: Omit<Post, "id">) => {
    setPosts((prev) => [{ id: generateId(), ...post }, ...prev]);
  }, []);

  const addProduct = useCallback((product: Omit<Product, "id">) => {
    setProducts((prev) => [{ id: generateId(), ...product }, ...prev]);
  }, []);

  const addProductFromServer = useCallback((product: Product) => {
    setProducts((prev) => {
      if (prev.some((p) => p.id === product.id)) return prev;
      return [product, ...prev];
    });
  }, []);

  const addEvent = useCallback((event: Omit<Event, "id" | "createdAt">) => {
    const now = Date.now();
    setEvents((prev) => [{ id: generateId(), ...event, createdAt: now }, ...prev]);
  }, []);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    if (user?.id) {
      apiPatch(`/products/${id}`, updates).catch(() => {});
    }
  }, [user?.id]);

  const deletePost = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setProductReviews((prev) => prev.filter((r) => r.productId !== id));
    if (user?.id) {
      apiDelete(`/products/${id}`).catch(() => {});
    }
  }, [user?.id]);

  const addProductReview = useCallback(async (review: Omit<ProductReview, "id" | "createdAt">) => {
    const now = Date.now();
    if (user?.id) {
      try {
        const row = await apiPost<{ id: string; created_at: string }>(`/products/${review.productId}/reviews`, {
          rating: review.rating,
          body: review.body,
        });
        setProductReviews((prev) => [...prev, { ...review, id: row.id, createdAt: new Date(row.created_at).getTime() }]);
        return;
      } catch {}
    }
    setProductReviews((prev) => [...prev, { ...review, id: generateId(), createdAt: now }]);
  }, [user?.id]);

  const getReviewsForProduct = useCallback(
    (productId: string) => productReviews.filter((r) => r.productId === productId),
    [productReviews]
  );

  const loadReviewsForProduct = useCallback(async (productId: string) => {
    try {
      const data = await apiGet<{ id: string; product_id: string; user_id: string; rating: number; body: string | null; created_at: string }[]>(`/products/${productId}/reviews`);
      if (!Array.isArray(data)) return;
      const loaded: ProductReview[] = data.map((r) => ({
        id: r.id,
        productId: r.product_id,
        userId: r.user_id,
        rating: r.rating,
        body: r.body ?? undefined,
        createdAt: new Date(r.created_at).getTime(),
      }));
      setProductReviews((prev) => [...prev.filter((r) => r.productId !== productId), ...loaded]);
    } catch {}
  }, []);

  return (
    <ContentContext.Provider
      value={{
        posts,
        products,
        events,
        productReviews,
        addPost,
        addProduct,
        addProductFromServer,
        addEvent,
        updateProduct,
        deletePost,
        deleteProduct,
        addProductReview,
        getReviewsForProduct,
        loadReviewsForProduct,
      }}
    >
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error("useContent must be used inside ContentProvider");
  return ctx;
}
