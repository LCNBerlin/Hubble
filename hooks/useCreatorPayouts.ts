import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../lib/api";

export type CreatorPayoutRow = {
  id: string;
  order_id: string;
  order_item_id: string;
  creator_id: string;
  amount_cents: number;
  fee_cents: number;
  stripe_transfer_id: string | null;
  status: string;
  instant: boolean;
  created_at: string;
};

export function useCreatorPayouts(creatorId: string | undefined) {
  const [payouts, setPayouts] = useState<CreatorPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayouts = useCallback(async () => {
    if (!creatorId) {
      setPayouts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiGet<CreatorPayoutRow[]>("/orders/payouts");
      setPayouts(data ?? []);
    } catch {
      setPayouts([]);
    }
    setLoading(false);
  }, [creatorId]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  return { payouts, loading, refresh: fetchPayouts };
}
