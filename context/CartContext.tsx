import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { Product } from "./ContentContext";
import { useAuth } from "./AuthContext";
import { rowToProduct } from "../lib/supabase-products";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";

const CART_STORAGE_KEY = "hubble_cart";

export type CartItem = {
  product: Product;
  quantity: number;
  selectedTierIndex?: number;
};

type CartContextType = {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number, selectedTierIndex?: number) => void;
  updateTier: (productId: string, selectedTierIndex: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
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
        const rows = await apiGet<Record<string, unknown>[]>("/cart");
        if (!Array.isArray(rows) || rows.length === 0) { setItems([]); return; }
        const cartItems: CartItem[] = rows
          .map((r) => {
            const product = rowToProduct(r as Parameters<typeof rowToProduct>[0]);
            if (!product?.id) return null;
            return { product, quantity: (r.quantity as number) ?? 1, selectedTierIndex: (r.selected_tier_index as number) ?? 0 };
          })
          .filter((x): x is CartItem => x !== null);
        setItems(cartItems);
      } catch {}
    })();
  }, [user?.id, hydrated]);

  useEffect(() => {
    if (!hydrated || user?.id) return;
    AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items, hydrated, user?.id]);

  const addToCart = useCallback(async (product: Product, quantity = 1, selectedTierIndex = 0) => {
    const tier = product.priceTiers?.length ? Math.max(0, Math.min(selectedTierIndex, product.priceTiers.length - 1)) : 0;
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { product, quantity, selectedTierIndex: tier }];
    });
    if (user?.id) {
      apiPost("/cart/items", { productId: product.id, quantity, selectedTierIndex: tier }).catch(() => {});
    }
  }, [user?.id]);

  const updateTier = useCallback((productId: string, selectedTierIndex: number) => {
    setItems((prev) => prev.map((i) => i.product.id === productId ? { ...i, selectedTierIndex } : i));
    if (user?.id) {
      apiPatch(`/cart/items/${productId}`, { selectedTierIndex }).catch(() => {});
    }
  }, [user?.id]);

  const removeFromCart = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
    if (user?.id) {
      apiDelete(`/cart/items/${productId}`).catch(() => {});
    }
  }, [user?.id]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) {
      removeFromCart(productId);
      return;
    }
    setItems((prev) => prev.map((i) => i.product.id === productId ? { ...i, quantity } : i));
    if (user?.id) {
      apiPatch(`/cart/items/${productId}`, { quantity }).catch(() => {});
    }
  }, [user?.id, removeFromCart]);

  const clearCart = useCallback(() => {
    setItems([]);
    if (user?.id) {
      apiDelete("/cart").catch(() => {});
    }
  }, [user?.id]);

  return (
    <CartContext.Provider value={{ items, addToCart, updateTier, removeFromCart, updateQuantity, clearCart, cartCount: items.reduce((s, i) => s + i.quantity, 0) }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
