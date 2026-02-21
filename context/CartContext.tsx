import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { Product } from "./ContentContext";
import { useAuth } from "./AuthContext";
import { rowToProduct } from "../lib/supabase-products";
import supabase from "../lib/supabase";

const CART_STORAGE_KEY = "hubble_cart";

export type CartItem = {
  product: Product;
  quantity: number;
  /** For products with price tiers: which tier was selected (0-based). */
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
      } catch {
        // ignore
      }
      setHydrated(true);
    })();
  }, []);

  // When signed in, fetch cart from Supabase and resolve products
  useEffect(() => {
    if (!supabase || !user?.id || !hydrated) return;
    (async () => {
      const { data: rows, error } = await supabase
        .from("cart_items")
        .select("product_id, quantity, selected_tier_index")
        .eq("user_id", user.id);
      if (error || !Array.isArray(rows) || rows.length === 0) {
        if (rows?.length === 0) setItems([]);
        return;
      }
      const ids = [...new Set(rows.map((r: { product_id: string }) => r.product_id))];
      const { data: productRows } = await supabase.from("products").select("*").in("id", ids);
      if (!productRows || productRows.length === 0) {
        setItems([]);
        return;
      }
      const productMap: Record<string, Product> = {};
      productRows.forEach((row: unknown) => {
        const p = rowToProduct(row as Parameters<typeof rowToProduct>[0]);
        productMap[p.id] = p;
      });
      const cartItems: CartItem[] = rows
        .map((r: { product_id: string; quantity: number; selected_tier_index?: number | null }) => {
          const product = productMap[r.product_id];
          if (!product) return null;
          const selectedTierIndex = r.selected_tier_index ?? 0;
          return { product, quantity: r.quantity, selectedTierIndex };
        })
        .filter((x): x is CartItem => x !== null);
      setItems(cartItems);
    })();
  }, [user?.id, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user?.id) AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items, hydrated, user?.id]);

  const addToCart = useCallback(
    async (product: Product, quantity = 1, selectedTierIndex = 0) => {
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
      if (supabase && user?.id) {
        const { data: existingRow } = await supabase
          .from("cart_items")
          .select("quantity, selected_tier_index")
          .eq("user_id", user.id)
          .eq("product_id", product.id)
          .maybeSingle();
        const newQty = ((existingRow as { quantity: number } | null)?.quantity ?? 0) + quantity;
        const existingTier = (existingRow as { selected_tier_index?: number } | null)?.selected_tier_index ?? 0;
        const tierToStore = existingRow
          ? existingTier
          : product.priceTiers?.length
            ? Math.max(0, Math.min(selectedTierIndex, product.priceTiers.length - 1))
            : 0;
        await supabase.from("cart_items").upsert(
          { user_id: user.id, product_id: product.id, quantity: newQty, selected_tier_index: tierToStore },
          { onConflict: "user_id,product_id" }
        );
      }
      setItems((prev) => {
        const existing = prev.find((i) => i.product.id === product.id);
        const tier = product.priceTiers?.length ? Math.max(0, Math.min(selectedTierIndex, product.priceTiers.length - 1)) : 0;
        if (existing) {
          return prev.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: existing.quantity + quantity, selectedTierIndex: existing.selectedTierIndex ?? 0 }
              : i
          );
        }
        return [...prev, { product: snapshot, quantity, selectedTierIndex: tier }];
      });
    },
    [user?.id]
  );

  const updateTier = useCallback(
    (productId: string, selectedTierIndex: number) => {
      setItems((prev) =>
        prev.map((i) =>
          i.product.id === productId ? { ...i, selectedTierIndex } : i
        )
      );
      if (supabase && user?.id) {
        supabase
          .from("cart_items")
          .update({ selected_tier_index: selectedTierIndex, updated_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("product_id", productId)
          .then(() => {});
      }
    },
    [user?.id]
  );

  const removeFromCart = useCallback(
    (productId: string) => {
      setItems((prev) => prev.filter((i) => i.product.id !== productId));
      if (supabase && user?.id) {
        supabase.from("cart_items").delete().eq("user_id", user.id).eq("product_id", productId).then(() => {});
      }
    },
    [user?.id]
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity < 1) {
        setItems((prev) => prev.filter((i) => i.product.id !== productId));
        if (supabase && user?.id) {
          supabase.from("cart_items").delete().eq("user_id", user.id).eq("product_id", productId).then(() => {});
        }
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
      );
      if (supabase && user?.id) {
        supabase.from("cart_items").update({ quantity, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("product_id", productId).then(() => {});
      }
    },
    [user?.id]
  );

  const clearCart = useCallback(() => {
    setItems([]);
    if (supabase && user?.id) {
      supabase.from("cart_items").delete().eq("user_id", user.id).then(() => {});
    }
  }, [user?.id]);

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateTier,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
