import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { Product } from "./ContentContext";
import { useAuth } from "./AuthContext";
import { rowToProduct } from "../lib/supabase-products";
import supabase from "../lib/supabase";

const WISHLIST_STORAGE_KEY = "hubble_wishlist";

/** Stored as product snapshots so we can display wishlist without refetching */
type WishlistItem = Product;

type WishlistContextType = {
  items: WishlistItem[];
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (product: Product) => void;
};

const WishlistContext = createContext<WishlistContextType | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(WISHLIST_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setItems(parsed);
        }
      } catch {
        // ignore
      }
      setHydrated(true);
    })();
  }, []);

  // When signed in, fetch wishlist from Supabase and resolve product details
  useEffect(() => {
    if (!supabase || !user?.id || !hydrated) return;
    (async () => {
      const { data: wishlistRows, error } = await supabase
        .from("wishlist")
        .select("product_id")
        .eq("user_id", user.id);
      if (error || !Array.isArray(wishlistRows) || wishlistRows.length === 0) {
        if (wishlistRows?.length === 0) setItems([]);
        return;
      }
      const ids = wishlistRows.map((r: { product_id: string }) => r.product_id);
      const { data: productRows } = await supabase.from("products").select("*").in("id", ids);
      if (productRows && productRows.length > 0) {
        setItems(productRows.map((row: unknown) => rowToProduct(row as Parameters<typeof rowToProduct>[0])));
      } else setItems([]);
    })();
  }, [user?.id, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user?.id) AsyncStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items, hydrated, user?.id]);

  const addToWishlist = useCallback(
    (product: Product) => {
      const snapshot: Product = {
        id: product.id,
        type: product.type,
        title: product.title,
        description: product.description,
        price: product.price,
        mediaUri: product.mediaUri,
        interval: product.interval,
        pinned: product.pinned,
        priceTiers: product.priceTiers,
        serviceSlots: product.serviceSlots,
        eventDate: product.eventDate,
        eventTime: product.eventTime,
        creatorId: product.creatorId,
        inventoryStatus: product.inventoryStatus,
        stockQuantity: product.stockQuantity,
        variants: product.variants,
      };
      setItems((prev) => {
        if (prev.some((i) => i.id === product.id)) return prev;
        return [...prev, snapshot];
      });
      if (supabase && user?.id) {
        supabase.from("wishlist").insert({ user_id: user.id, product_id: product.id }).then(() => {});
      }
    },
    [user?.id]
  );

  const removeFromWishlist = useCallback(
    (productId: string) => {
      setItems((prev) => prev.filter((i) => i.id !== productId));
      if (supabase && user?.id) {
        supabase.from("wishlist").delete().eq("user_id", user.id).eq("product_id", productId).then(() => {});
      }
    },
    [user?.id]
  );

  const isInWishlist = useCallback(
    (productId: string) => items.some((i) => i.id === productId),
    [items]
  );

  const toggleWishlist = useCallback(
    (product: Product) => {
      const inList = items.some((i) => i.id === product.id);
      if (inList) {
        removeFromWishlist(product.id);
      } else {
        addToWishlist(product);
      }
    },
    [items, addToWishlist, removeFromWishlist]
  );

  return (
    <WishlistContext.Provider
      value={{
        items,
        addToWishlist,
        removeFromWishlist,
        isInWishlist,
        toggleWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
