import supabase from "./supabase";

export type RevenueSplitRow = {
  id: string;
  owner_id: string;
  partner_id: string;
  target_type: "post" | "product";
  target_id: string;
  split_percent: number;
  created_at?: string;
};

export type RevenueSplitWithPartner = RevenueSplitRow & {
  partner?: { id: string; display_name: string | null; username: string } | null;
};

/** Fetch all revenue splits for the current owner and target type, with partner profile. */
export async function getRevenueSplitsForOwner(
  ownerId: string,
  targetType: "post" | "product"
): Promise<RevenueSplitWithPartner[]> {
  const { data, error } = await supabase
    .from("revenue_splits")
    .select("*, partner:profiles!partner_id(id, display_name, username)")
    .eq("owner_id", ownerId)
    .eq("target_type", targetType)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data as RevenueSplitWithPartner[]) ?? [];
}

/** Look up profile id by username (for adding a partner). */
export async function getProfileIdByUsername(username: string): Promise<string | null> {
  const trimmed = username.trim().toLowerCase();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", trimmed)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/** Insert a new revenue split. RLS: owner_id must be auth.uid(). */
export async function createRevenueSplit(params: {
  ownerId: string;
  partnerId: string;
  targetType: "post" | "product";
  targetId: string;
  splitPercent: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (params.splitPercent < 1 || params.splitPercent > 99) {
    return { ok: false, error: "Split must be between 1 and 99%." };
  }
  const { error } = await supabase.from("revenue_splits").insert({
    owner_id: params.ownerId,
    partner_id: params.partnerId,
    target_type: params.targetType,
    target_id: params.targetId,
    split_percent: params.splitPercent,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Update split percent. */
export async function updateRevenueSplit(
  splitId: string,
  splitPercent: number,
  ownerId: string
): Promise<{ ok: boolean; error?: string }> {
  if (splitPercent < 1 || splitPercent > 99) {
    return { ok: false, error: "Split must be between 1 and 99%." };
  }
  const { error } = await supabase
    .from("revenue_splits")
    .update({ split_percent: splitPercent })
    .eq("id", splitId)
    .eq("owner_id", ownerId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Delete a revenue split. */
export async function deleteRevenueSplit(
  splitId: string,
  ownerId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("revenue_splits")
    .delete()
    .eq("id", splitId)
    .eq("owner_id", ownerId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
