import { apiGet, apiPost, apiPatch, apiDelete } from "./api";

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

export async function getRevenueSplitsForOwner(ownerId: string, targetType: "post" | "product"): Promise<RevenueSplitWithPartner[]> {
  return apiGet(`/revenue-splits?ownerId=${ownerId}&targetType=${targetType}`);
}

export async function getProfileIdByUsername(username: string): Promise<string | null> {
  const trimmed = username.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const results = await apiGet<{ id: string; username: string }[]>(`/profiles/search?q=${encodeURIComponent(trimmed)}&limit=5`);
    return results.find((r) => r.username.toLowerCase() === trimmed)?.id ?? null;
  } catch {
    return null;
  }
}

export async function createRevenueSplit(params: { ownerId: string; partnerId: string; targetType: "post" | "product"; targetId: string; splitPercent: number }): Promise<{ ok: boolean; error?: string }> {
  if (params.splitPercent < 1 || params.splitPercent > 99) return { ok: false, error: "Split must be between 1 and 99%." };
  try {
    await apiPost("/revenue-splits", params);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateRevenueSplit(splitId: string, splitPercent: number, _ownerId: string): Promise<{ ok: boolean; error?: string }> {
  if (splitPercent < 1 || splitPercent > 99) return { ok: false, error: "Split must be between 1 and 99%." };
  try {
    await apiPatch(`/revenue-splits/${splitId}`, { splitPercent });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deleteRevenueSplit(splitId: string, _ownerId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiDelete(`/revenue-splits/${splitId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
