import type { User } from "@supabase/supabase-js";
import supabase from "./supabase";

/** Slug for username: alphanumeric + underscores only, lowercase */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "user";
}

/**
 * Ensure the current user has a row in profiles. Call after sign-in/sign-up.
 * Uses email prefix for display_name and a unique username (email prefix + short id).
 */
export async function upsertProfileForUser(user: User): Promise<void> {
  if (!supabase) return;
  const prefix = user.email ? slugify(user.email.split("@")[0]) : "user";
  const uniqueUsername = `${prefix}_${user.id.slice(0, 8)}`;
  const displayName = user.email?.split("@")[0] ?? uniqueUsername;
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: displayName,
      username: uniqueUsername,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
}

export type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  links?: string[];
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
  category_tags?: string[] | null;
  wallet_address?: string | null;
  ens_name?: string | null;
  on_chain_visible?: boolean | null;
  staking_badge?: boolean | null;
  governance_badge?: boolean | null;
  brand_statement?: string | null;
  niche_classification?: string | null;
  value_proposition?: string | null;
  affiliate_code?: string | null;
  dm_access_enabled?: boolean | null;
  dm_access_price_cents?: number | null;
  staking_url?: string | null;
  governance_url?: string | null;
  equity_pool_label?: string | null;
  equity_pool_url?: string | null;
  followers_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
  stripe_connect_account_id?: string | null;
  reputation_score?: number | null;
  verified_tier?: string | null;
};

export type PostRow = {
  id: string;
  user_id: string;
  type: string;
  title: string | null;
  body: string | null;
  media_uri: string | null;
  created_at: string;
  is_sponsored?: boolean;
  poll_options?: string[] | null;
  thumbnail_uri?: string | null;
};
