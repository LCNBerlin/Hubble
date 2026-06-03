// Type definitions for DB rows — kept for type-checking across the app.
// The upsertProfileForUser function is now handled server-side by NestJS on register.

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
  level?: number | null;
  verified_tier?: string | null;
  email?: string | null;
  password_hash?: string | null;
};

export type PostRow = {
  id: string;
  user_id: string;
  type: string;
  post_type?: string;
  title: string | null;
  body: string | null;
  media_uri: string | null;
  media_type?: string | null;
  created_at: string;
  updated_at?: string;
  is_sponsored?: boolean;
  poll_options?: string[] | null;
  thumbnail_uri?: string | null;
  scheduled_at?: string | null;
  place_name?: string | null;
  hashtags?: string[];
};
