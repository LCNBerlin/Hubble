import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { Product } from "./ContentContext";
import { useAuth } from "./AuthContext";
import { rowToProduct } from "../lib/supabase-products";
import { apiGet, apiPost, apiDelete } from "../lib/api";

const WISHLIST_STORAGE_KEY = "hubble_wishlist";

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
      } catch {}
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!user?.id || !hydrated) return;
    (async () => {
      try {
        const rows = await apiGet<Record<string, unknown>[]>("/wishlist");
        if (!Array.isArray(rows) || rows.length === 0) { setItems([]); return; }
        setItems(rows.map((r) => rowToProduct(r as Parameters<typeof rowToProduct>[0])).filter((p) => !!p?.id));
      } catch {}
    })();
  }, [user?.id, hydrated]);

  useEffect(() => {
    if (!hydrated || user?.id) return;
    AsyncStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items, hydrated, user?.id]);

  const addToWishlist = useCallback((product: Product) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === product.id)) return prev;
      return [...prev, product];
    });
    if (user?.id) {
      apiPost(`/wishlist/${product.id}`).catch(() => {});
    }
  }, [user?.id]);

  const removeFromWishlist = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== productId));
    if (user?.id) {
      apiDelete(`/wishlist/${productId}`).catch(() => {});
    }
  }, [user?.id]);

  const isInWishlist = useCallback((productId: string) => items.some((i) => i.id === productId), [items]);

  const toggleWishlist = useCallback((product: Product) => {
    if (items.some((i) => i.id === product.id)) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  }, [items, addToWishlist, removeFromWishlist]);

  return (
    <WishlistContext.Provider value={{ items, addToWishlist, removeFromWishlist, isInWishlist, toggleWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
