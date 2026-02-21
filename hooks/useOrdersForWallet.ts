import { useCallback, useEffect, useState } from "react";
import supabase from "../lib/supabase";

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
    if (!userId || !supabase) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false });

    if (ordersError) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const orderList = (ordersData ?? []) as OrderRow[];
    if (orderList.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const orderIds = orderList.map((o) => o.id);
    const { data: itemsData } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds);

    const itemsByOrder = new Map<string, OrderItemRow[]>();
    (itemsData ?? []).forEach((row: OrderItemRow) => {
      const list = itemsByOrder.get(row.order_id) ?? [];
      list.push(row);
      itemsByOrder.set(row.order_id, list);
    });

    setOrders(
      orderList.map((o) => ({
        ...o,
        order_items: itemsByOrder.get(o.id) ?? [],
      }))
    );
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
