import { useCallback, useEffect, useState } from "react";
import supabase from "../lib/supabase";

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
    if (!creatorId || !supabase) {
      setPayouts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("creator_payouts")
      .select("*")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false });
    if (error) {
      setPayouts([]);
    } else {
      setPayouts((data ?? []) as CreatorPayoutRow[]);
    }
    setLoading(false);
  }, [creatorId]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  return { payouts, loading, refresh: fetchPayouts };
}
