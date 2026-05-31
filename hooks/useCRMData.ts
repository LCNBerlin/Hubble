import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../lib/api";

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

export function useCRMData(conversationId: string | null, _currentUserId: string | undefined): CRMData {
  const [profile, setProfile] = useState<CRMProfile | null>(null);
  const [ordersAsBuyer, setOrdersAsBuyer] = useState<CRMOrder[]>([]);
  const [ordersAsCreator, setOrdersAsCreator] = useState<CRMOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!conversationId) {
      setProfile(null);
      setOrdersAsBuyer([]);
      setOrdersAsCreator([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiGet<{ profile: CRMProfile; ordersAsBuyer: CRMOrder[]; ordersAsCreator: CRMOrder[] }>(
        `/messaging/conversations/${conversationId}/crm`
      );
      setProfile(data?.profile ?? null);
      setOrdersAsBuyer(data?.ordersAsBuyer ?? []);
      setOrdersAsCreator(data?.ordersAsCreator ?? []);
    } catch {
      setProfile(null);
      setOrdersAsBuyer([]);
      setOrdersAsCreator([]);
    }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalRevenueFromUserCents = ordersAsCreator.reduce((s, o) => s + (o.total_cents ?? 0), 0);
  const totalPaidCents = ordersAsCreator.filter((o) => o.status === "released" || o.status === "paid").reduce((s, o) => s + o.total_cents, 0);
  const totalDueCents = ordersAsCreator.filter((o) => o.status === "escrow_held").reduce((s, o) => s + o.total_cents, 0);
  const activeDeals = ordersAsCreator.filter((o) => o.status === "escrow_held" || o.status === "paid").length;
  const disputeCount = ordersAsCreator.filter((o) => o.status === "disputed").length + ordersAsBuyer.filter((o) => o.status === "disputed").length;

  return {
    profile,
    ordersAsBuyer,
    ordersAsCreator,
    totalRevenueFromUserCents,
    totalPaidCents,
    totalDueCents,
    activeDeals,
    inProgressDeals: activeDeals,
    disputeCount,
    loading,
    refresh: load,
  };
}
