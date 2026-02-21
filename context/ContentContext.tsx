import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { productToRow } from "../lib/supabase-products";
import supabase from "../lib/supabase";

const STORAGE_KEY = "hubble_content";

export type PostType = "blog" | "picture" | "audio" | "video" | "polls";
export type ProductType =
  | "digital"
  | "physical"
  | "membership"
  | "services"
  | "nft"
  | "live"
  | "event";

/** Tiered pricing: e.g. Basic $10, Pro $25 */
export type PriceTier = { name: string; price: string; description?: string };

/** Service booking: time slot */
export type ServiceSlot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  available?: boolean;
};

/** Variant option for size, color, etc. */
export type ProductVariantOption = { id: string; value: string };
export type ProductVariant = {
  id: string;
  name: string;
  options: ProductVariantOption[];
};

/** Product review for reputation score */
export type ProductReview = {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  body?: string;
  createdAt: number;
};

export type Post = {
  id: string;
  type: PostType;
  title: string;
  body?: string;
  mediaUri?: string;
  /** Poll question in title or body; options for type "polls". */
  pollOptions?: string[];
  /** Optional thumbnail for video posts (creator studio grid). */
  thumbnailUri?: string;
};

export type Product = {
  id: string;
  type: ProductType;
  title: string;
  description?: string;
  price?: string;
  mediaUri?: string;
  interval?: string;
  pinned?: boolean;
  /** Discovery: featured in sponsored slots */
  isSponsored?: boolean;
  /** Discovery: B2B / wholesale marketplace */
  isWholesale?: boolean;
  /** Optional rating 0–5 for filter/sort (future) */
  rating?: number;
  /** Token-gated / gated access (future) */
  tokenGated?: boolean;
  /** Tiered pricing. If set, price can be "From X" or first tier. */
  priceTiers?: PriceTier[];
  /** Service bookings: calendar + time slots (type === "services"). */
  serviceSlots?: ServiceSlot[];
  /** Ticketed events: event date unix ms (type === "event"). */
  eventDate?: number;
  /** Event time label (e.g. "7:00 PM"). */
  eventTime?: string;
  /** Creator user id for badge and cross-sell. */
  creatorId?: string;
  /** Inventory: display status. */
  inventoryStatus?: "in_stock" | "low_stock" | "out_of_stock";
  /** Optional stock quantity; can derive inventoryStatus from it. */
  stockQuantity?: number;
  /** Variant selection (size, color, etc.). */
  variants?: ProductVariant[];
  /** Currency code (e.g. USD, EUR). If omitted, treat as USD for filtering. */
  currency?: string;
  /** Instant (digital/event) vs shipped (physical). If omitted, derive from type in filter logic. */
  deliveryType?: "instant" | "shipped";
  /** Whether purchase requires escrow. */
  escrowRequired?: boolean;
  /** Blockchain chain (e.g. ethereum, polygon) for Web3 filter. */
  chain?: string;
  /** Product category for discovery (legacy single). Prefer categories. */
  category?: string;
  /** Product categories for discovery (max 3). e.g. Art, Digital, Services. */
  categories?: string[];
  /** Tags for search and filter. */
  tags?: string[];
  /** Cover image URI / thumbnail (e.g. for digital products; for video, user-chosen thumbnail). */
  coverUri?: string;
  /** When to go live (Unix ms). If set, product is hidden until this time. */
  goLiveAt?: number;
  /** MIME type of media_uri (e.g. audio/mpeg, video/mp4) for digital products; used for preview. */
  mediaMimeType?: string;
  /** Created at (Unix ms). Used for "trending today" etc. */
  createdAt?: number;
};

export type Event = {
  id: string;
  title: string;
  description?: string;
  date: number;
  createdAt: number;
};

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
      } catch {
        // ignore parse errors
      }
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const save = async () => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ posts, products, events })
        );
      } catch {
        // ignore
      }
    };
    save();
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

  const updateProduct = useCallback(
    async (id: string, updates: Partial<Product>) => {
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
      if (supabase && user?.id) {
        const row = productToRow(updates, user.id);
        await supabase.from("products").update(row).eq("id", id).eq("creator_id", user.id);
      }
    },
    [user?.id]
  );

  const deletePost = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const deleteProduct = useCallback(
    async (id: string) => {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setProductReviews((prev) => prev.filter((r) => r.productId !== id));
      if (supabase && user?.id) {
        await supabase.from("products").delete().eq("id", id).eq("creator_id", user.id);
      }
    },
    [user?.id]
  );

  const addProductReview = useCallback(
    async (review: Omit<ProductReview, "id" | "createdAt">) => {
      const now = Date.now();
      if (supabase && user?.id) {
        const { data: row, error } = await supabase
          .from("product_reviews")
          .insert({
            product_id: review.productId,
            user_id: review.userId,
            rating: review.rating,
            body: review.body ?? null,
          })
          .select("id, created_at")
          .single();
        if (!error && row) {
          setProductReviews((prev) => [
            ...prev,
            {
              ...review,
              id: row.id,
              createdAt: new Date((row as { created_at: string }).created_at).getTime(),
            },
          ]);
          return;
        }
      }
      setProductReviews((prev) => [
        ...prev,
        { ...review, id: generateId(), createdAt: now },
      ]);
    },
    [user?.id]
  );

  const getReviewsForProduct = useCallback(
    (productId: string) => productReviews.filter((r) => r.productId === productId),
    [productReviews]
  );

  const loadReviewsForProduct = useCallback(async (productId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("product_reviews")
      .select("id, product_id, user_id, rating, body, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    if (error || !Array.isArray(data)) return;
    const loaded: ProductReview[] = data.map((r: { id: string; product_id: string; user_id: string; rating: number; body: string | null; created_at: string }) => ({
      id: r.id,
      productId: r.product_id,
      userId: r.user_id,
      rating: r.rating,
      body: r.body ?? undefined,
      createdAt: new Date(r.created_at).getTime(),
    }));
    setProductReviews((prev) => {
      const rest = prev.filter((r) => r.productId !== productId);
      return [...rest, ...loaded];
    });
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
