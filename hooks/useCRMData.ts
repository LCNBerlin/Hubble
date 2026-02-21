import { useCallback, useEffect, useState } from "react";
import supabase from "../lib/supabase";

export type CRMProfile = {
  id: string;
  display_name: string | null;
  username: string;
  avatar_url: string | null;
  verified_tier: string;
  reputation_score: number;
  category_tags: string[] | null;
};

export type CRMOrder = {
  id: string;
  buyer_id: string;
  status: string;
  total_cents: number;
  escrow_release_at: string | null;
  created_at: string;
  order_items?: { id: string; product_id: string; title: string | null; line_total_cents: number; creator_id: string | null }[];
};

export type CRMData = {
  profile: CRMProfile | null;
  ordersAsBuyer: CRMOrder[];
  ordersAsCreator: CRMOrder[];
  totalRevenueFromUserCents: number;
  totalPaidCents: number;
  totalDueCents: number;
  activeDeals: number;
  inProgressDeals: number;
  disputeCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
};

export function useCRMData(peerUserId: string | null, currentUserId: string | undefined): CRMData {
  const [profile, setProfile] = useState<CRMProfile | null>(null);
  const [ordersAsBuyer, setOrdersAsBuyer] = useState<CRMOrder[]>([]);
  const [ordersAsCreator, setOrdersAsCreator] = useState<CRMOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!peerUserId || !currentUserId || !supabase) {
      setProfile(null);
      setOrdersAsBuyer([]);
      setOrdersAsCreator([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url, verified_tier, reputation_score, category_tags")
      .eq("id", peerUserId)
      .single();
    setProfile((profileData as CRMProfile) ?? null);

    const { data: myOrders } = await supabase
      .from("orders")
      .select("id, buyer_id, status, total_cents, escrow_release_at, created_at")
      .eq("buyer_id", currentUserId)
      .order("created_at", { ascending: false });
    const myOrderList = (myOrders ?? []) as CRMOrder[];
    const myOrderIds = myOrderList.map((o) => o.id);
    const { data: myItems } = myOrderIds.length
      ? await supabase.from("order_items").select("order_id, id, product_id, title, line_total_cents, creator_id").in("order_id", myOrderIds)
      : { data: [] };
    const itemsByOrder = new Map<string, CRMOrder["order_items"]>();
    (myItems ?? []).forEach((row: { order_id: string } & CRMOrder["order_items"][0]) => {
      const list = itemsByOrder.get(row.order_id) ?? [];
      list.push({ id: row.id, product_id: row.product_id, title: row.title, line_total_cents: row.line_total_cents, creator_id: row.creator_id });
      itemsByOrder.set(row.order_id, list);
    });
    const ordersWherePeerIsCreator = myOrderList.filter((o) =>
      (itemsByOrder.get(o.id) ?? []).some((i) => i.creator_id === peerUserId)
    );
    const withItems = ordersWherePeerIsCreator.map((o) => ({ ...o, order_items: itemsByOrder.get(o.id) ?? [] }));
    setOrdersAsBuyer(withItems);

    const { data: creatorOrders } = await supabase
      .from("orders")
      .select("id, buyer_id, status, total_cents, escrow_release_at, created_at")
      .eq("buyer_id", peerUserId)
      .order("created_at", { ascending: false });
    const creatorOrderList = (creatorOrders ?? []) as CRMOrder[];
    const creatorOrderIds = creatorOrderList.map((o) => o.id);
    const { data: creatorItems } =
      creatorOrderIds.length
        ? await supabase.from("order_items").select("order_id, id, product_id, title, line_total_cents, creator_id").in("order_id", creatorOrderIds)
        : { data: [] };
    const creatorItemsByOrder = new Map<string, CRMOrder["order_items"]>();
    (creatorItems ?? []).forEach((row: { order_id: string } & CRMOrder["order_items"][0]) => {
      const list = creatorItemsByOrder.get(row.order_id) ?? [];
      list.push({ id: row.id, product_id: row.product_id, title: row.title, line_total_cents: row.line_total_cents, creator_id: row.creator_id });
      creatorItemsByOrder.set(row.order_id, list);
    });
    const ordersWhereIAmCreator = creatorOrderList.filter((o) =>
      (creatorItemsByOrder.get(o.id) ?? []).some((i) => i.creator_id === currentUserId)
    );
    const withItemsCreator = ordersWhereIAmCreator.map((o) => ({ ...o, order_items: creatorItemsByOrder.get(o.id) ?? [] }));
    setOrdersAsCreator(withItemsCreator);

    setLoading(false);
  }, [peerUserId, currentUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalRevenueFromUserCents = ordersAsCreator.reduce((s, o) => s + (o.total_cents ?? 0), 0);
  const totalPaidCents = ordersAsCreator.filter((o) => o.status === "released" || o.status === "paid").reduce((s, o) => s + o.total_cents, 0);
  const totalDueCents = ordersAsCreator.filter((o) => o.status === "escrow_held").reduce((s, o) => s + o.total_cents, 0);
  const activeDeals = ordersAsCreator.filter((o) => o.status === "escrow_held" || o.status === "paid").length;
  const inProgressDeals = activeDeals;
  const disputeCount = ordersAsCreator.filter((o) => o.status === "disputed").length + ordersAsBuyer.filter((o) => o.status === "disputed").length;

  return {
    profile,
    ordersAsBuyer,
    ordersAsCreator,
    totalRevenueFromUserCents,
    totalPaidCents,
    totalDueCents,
    activeDeals,
    inProgressDeals,
    disputeCount,
    loading,
    refresh: load,
  };
}
