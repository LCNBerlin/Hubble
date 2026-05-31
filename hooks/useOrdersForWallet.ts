import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../lib/api";

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  creator_id: string | null;
  title: string | null;
  price_cents: number;
  quantity: number;
  line_total_cents: number;
};

export type OrderRow = {
  id: string;
  buyer_id: string;
  status: string;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  escrow_release_at: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderWithItems = OrderRow & { order_items?: OrderItemRow[] };

export function useOrdersForWallet(userId: string | undefined) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiGet<OrderWithItems[]>("/orders");
      setOrders(data ?? []);
    } catch {
      setOrders([]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { orders, loading, refresh: fetch };
}

export function useEscrowOrders(userId: string | undefined) {
  const { orders, loading, refresh } = useOrdersForWallet(userId);
  const active = orders.filter((o) => o.status === "escrow_held");
  const completed = orders.filter((o) => o.status === "released");
  const disputed = orders.filter((o) => o.status === "disputed");
  const pending = orders.filter((o) => o.status === "paid");
  return { active, completed, disputed, pending, loading, refresh };
}
