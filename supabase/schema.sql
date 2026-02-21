-- Hubble: profiles, posts, follows. Run in Supabase SQL Editor.

-- Profiles (one row per auth user)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  username text UNIQUE NOT NULL,
  bio text,
  avatar_url text,
  banner_url text,
  followers_count int DEFAULT 0,
  following_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS links text[] DEFAULT '{}';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS category_tags text[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ens_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS on_chain_visible boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staking_badge boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS governance_badge boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brand_statement text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS niche_classification text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS value_proposition text;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS affiliate_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dm_access_enabled boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dm_access_price_cents int DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staking_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS governance_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equity_pool_label text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equity_pool_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified_tier text DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation_score int DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lng double precision;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_affiliate_code_key ON public.profiles(affiliate_code) WHERE affiliate_code IS NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Posts
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text,
  body text,
  media_uri text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_sponsored boolean DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS sponsor_campaign_id text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS place_name text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS poll_options jsonb;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS thumbnail_uri text;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
-- Show post if: not scheduled, or scheduled time has passed, or viewer is the author (so authors see their own scheduled posts)
CREATE POLICY "posts_select" ON public.posts FOR SELECT USING (
  scheduled_at IS NULL OR scheduled_at <= now() OR user_id = auth.uid()
);
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Follows
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_select" ON public.follows;
DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
CREATE POLICY "follows_select" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- Trigger: update profile counts on follow/unfollow
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
    UPDATE public.profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS follows_count_trigger ON public.follows;
CREATE TRIGGER follows_count_trigger
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();

-- Post likes
CREATE TABLE IF NOT EXISTS public.post_likes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_likes_select" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_insert_own" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_delete_own" ON public.post_likes;
CREATE POLICY "post_likes_select" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "post_likes_insert_own" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_likes_delete_own" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Post comments
CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_comments_select" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_insert_own" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_delete_own" ON public.post_comments;
CREATE POLICY "post_comments_select" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "post_comments_insert_own" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_comments_delete_own" ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Saved posts
CREATE TABLE IF NOT EXISTS public.saved_posts (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_posts_select_own" ON public.saved_posts;
DROP POLICY IF EXISTS "saved_posts_insert_own" ON public.saved_posts;
DROP POLICY IF EXISTS "saved_posts_delete_own" ON public.saved_posts;
CREATE POLICY "saved_posts_select_own" ON public.saved_posts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "saved_posts_insert_own" ON public.saved_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_posts_delete_own" ON public.saved_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Blocked users
CREATE TABLE IF NOT EXISTS public.blocked_users (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, blocked_id),
  CHECK (user_id != blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_users_select_own" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_users_insert_own" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_users_delete_own" ON public.blocked_users;
CREATE POLICY "blocked_users_select_own" ON public.blocked_users FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "blocked_users_insert_own" ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "blocked_users_delete_own" ON public.blocked_users FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Reports
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_select_own" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

-- Post dislikes
CREATE TABLE IF NOT EXISTS public.post_dislikes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE public.post_dislikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_dislikes_select" ON public.post_dislikes;
DROP POLICY IF EXISTS "post_dislikes_insert_own" ON public.post_dislikes;
DROP POLICY IF EXISTS "post_dislikes_delete_own" ON public.post_dislikes;
CREATE POLICY "post_dislikes_select" ON public.post_dislikes FOR SELECT USING (true);
CREATE POLICY "post_dislikes_insert_own" ON public.post_dislikes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_dislikes_delete_own" ON public.post_dislikes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Reposts
CREATE TABLE IF NOT EXISTS public.reposts (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reposts_select" ON public.reposts;
DROP POLICY IF EXISTS "reposts_insert_own" ON public.reposts;
DROP POLICY IF EXISTS "reposts_delete_own" ON public.reposts;
CREATE POLICY "reposts_select" ON public.reposts FOR SELECT USING (true);
CREATE POLICY "reposts_insert_own" ON public.reposts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reposts_delete_own" ON public.reposts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Replies: add parent_id to post_comments (run if not already applied)
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE;

-- Comment likes (for liking comments)
CREATE TABLE IF NOT EXISTS public.comment_likes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_likes_select" ON public.comment_likes;
DROP POLICY IF EXISTS "comment_likes_insert_own" ON public.comment_likes;
DROP POLICY IF EXISTS "comment_likes_delete_own" ON public.comment_likes;
CREATE POLICY "comment_likes_select" ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "comment_likes_insert_own" ON public.comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comment_likes_delete_own" ON public.comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Comment dislikes
CREATE TABLE IF NOT EXISTS public.comment_dislikes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);

ALTER TABLE public.comment_dislikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_dislikes_select" ON public.comment_dislikes;
DROP POLICY IF EXISTS "comment_dislikes_insert_own" ON public.comment_dislikes;
DROP POLICY IF EXISTS "comment_dislikes_delete_own" ON public.comment_dislikes;
CREATE POLICY "comment_dislikes_select" ON public.comment_dislikes FOR SELECT USING (true);
CREATE POLICY "comment_dislikes_insert_own" ON public.comment_dislikes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comment_dislikes_delete_own" ON public.comment_dislikes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Hashtags (normalized by name, lowercase)
CREATE TABLE IF NOT EXISTS public.hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hashtags_select" ON public.hashtags;
DROP POLICY IF EXISTS "hashtags_insert" ON public.hashtags;
CREATE POLICY "hashtags_select" ON public.hashtags FOR SELECT USING (true);
CREATE POLICY "hashtags_insert" ON public.hashtags FOR INSERT TO authenticated WITH CHECK (true);

-- Post–hashtag junction
CREATE TABLE IF NOT EXISTS public.post_hashtags (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id uuid NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, hashtag_id)
);

CREATE INDEX IF NOT EXISTS post_hashtags_hashtag_id_idx ON public.post_hashtags(hashtag_id);

ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_hashtags_select" ON public.post_hashtags;
DROP POLICY IF EXISTS "post_hashtags_insert_own" ON public.post_hashtags;
DROP POLICY IF EXISTS "post_hashtags_delete_own" ON public.post_hashtags;
CREATE POLICY "post_hashtags_select" ON public.post_hashtags FOR SELECT USING (true);
CREATE POLICY "post_hashtags_insert_own" ON public.post_hashtags FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = auth.uid())
);
CREATE POLICY "post_hashtags_delete_own" ON public.post_hashtags FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = auth.uid())
);

-- Referral events (clicks, signups, future: purchases)
CREATE TABLE IF NOT EXISTS public.referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('click', 'signup', 'purchase')),
  referree_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_events_referrer_id_idx ON public.referral_events(referrer_id);

ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referral_events_select_own" ON public.referral_events;
DROP POLICY IF EXISTS "referral_events_insert_own" ON public.referral_events;
CREATE POLICY "referral_events_select_own" ON public.referral_events FOR SELECT TO authenticated USING (referrer_id = auth.uid());
-- Allow insert for clicks (any auth user can record ref click) and signups (referree_id = auth.uid())
CREATE POLICY "referral_events_insert_own" ON public.referral_events FOR INSERT TO authenticated WITH CHECK (true);

-- Revenue splits (collabs: owner assigns share to partner per post/product)
CREATE TABLE IF NOT EXISTS public.revenue_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'product')),
  target_id uuid NOT NULL,
  split_percent int NOT NULL CHECK (split_percent >= 1 AND split_percent <= 99),
  created_at timestamptz DEFAULT now(),
  UNIQUE (owner_id, target_type, target_id, partner_id)
);

CREATE INDEX IF NOT EXISTS revenue_splits_owner_id_idx ON public.revenue_splits(owner_id);
CREATE INDEX IF NOT EXISTS revenue_splits_partner_id_idx ON public.revenue_splits(partner_id);

ALTER TABLE public.revenue_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "revenue_splits_select_own_or_partner" ON public.revenue_splits;
DROP POLICY IF EXISTS "revenue_splits_insert_own" ON public.revenue_splits;
DROP POLICY IF EXISTS "revenue_splits_update_own" ON public.revenue_splits;
DROP POLICY IF EXISTS "revenue_splits_delete_own" ON public.revenue_splits;
CREATE POLICY "revenue_splits_select_own_or_partner" ON public.revenue_splits FOR SELECT TO authenticated USING (owner_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "revenue_splits_insert_own" ON public.revenue_splits FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "revenue_splits_update_own" ON public.revenue_splits FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "revenue_splits_delete_own" ON public.revenue_splits FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Paid DM access grants (after payment, buyer can message creator)
CREATE TABLE IF NOT EXISTS public.dm_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (creator_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS dm_access_grants_creator_buyer_idx ON public.dm_access_grants(creator_id, buyer_id);

ALTER TABLE public.dm_access_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dm_access_grants_select_own" ON public.dm_access_grants;
DROP POLICY IF EXISTS "dm_access_grants_insert" ON public.dm_access_grants;
CREATE POLICY "dm_access_grants_select_own" ON public.dm_access_grants FOR SELECT TO authenticated USING (creator_id = auth.uid() OR buyer_id = auth.uid());
CREATE POLICY "dm_access_grants_insert" ON public.dm_access_grants FOR INSERT TO authenticated WITH CHECK (true);

-- Stories (ephemeral content, e.g. 24h)
CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_uri text NOT NULL,
  type text NOT NULL DEFAULT 'image' CHECK (type IN ('image', 'video')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS stories_user_id_idx ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS stories_expires_at_idx ON public.stories(expires_at);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories_select_active" ON public.stories;
DROP POLICY IF EXISTS "stories_insert_own" ON public.stories;
DROP POLICY IF EXISTS "stories_delete_own" ON public.stories;
CREATE POLICY "stories_select_active" ON public.stories FOR SELECT USING (expires_at > now());
CREATE POLICY "stories_insert_own" ON public.stories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories_delete_own" ON public.stories FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trending posts: engagement (likes + 2*comments) in last 48 hours
CREATE OR REPLACE FUNCTION public.get_trending_post_ids(hours_window int DEFAULT 48, max_count int DEFAULT 10)
RETURNS TABLE (post_id uuid, score bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH since AS (SELECT now() - (hours_window || ' hours')::interval AS t),
  likes_count AS (
    SELECT pl.post_id, COUNT(*)::bigint AS c
    FROM post_likes pl, since
    WHERE pl.created_at >= since.t
    GROUP BY pl.post_id
  ),
  comments_count AS (
    SELECT pc.post_id, COUNT(*)::bigint AS c
    FROM post_comments pc, since
    WHERE pc.created_at >= since.t
    GROUP BY pc.post_id
  ),
  combined AS (
    SELECT p.id AS post_id,
      COALESCE(l.c, 0) + COALESCE(c.c, 0) * 2 AS score
    FROM posts p
    LEFT JOIN likes_count l ON l.post_id = p.id
    LEFT JOIN comments_count c ON c.post_id = p.id
    WHERE COALESCE(l.c, 0) + COALESCE(c.c, 0) * 2 > 0
  )
  SELECT combined.post_id, combined.score
  FROM combined
  ORDER BY combined.score DESC
  LIMIT max_count;
$$;

-- Trending hashtags by post count in last 7 days
CREATE OR REPLACE FUNCTION public.get_trending_hashtags(days_window int DEFAULT 7, max_count int DEFAULT 10)
RETURNS TABLE (tag_name text, post_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH since AS (SELECT now() - (days_window || ' days')::interval AS t),
  tag_counts AS (
    SELECT h.name, COUNT(*)::bigint AS c
    FROM hashtags h
    JOIN post_hashtags ph ON ph.hashtag_id = h.id
    JOIN posts p ON p.id = ph.post_id, since
    WHERE p.created_at >= since.t
    GROUP BY h.name
    ORDER BY c DESC
    LIMIT max_count
  )
  SELECT tag_counts.name, tag_counts.c FROM tag_counts;
$$;

-- Nearby posts by lat/lng (Haversine approx, radius_km)
CREATE OR REPLACE FUNCTION public.get_nearby_post_ids(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision DEFAULT 50,
  max_count int DEFAULT 10
)
RETURNS TABLE (post_id uuid, distance_km double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id AS post_id,
    6371 * acos(least(1, greatest(-1,
      cos(radians(user_lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(user_lng))
      + sin(radians(user_lat)) * sin(radians(p.lat))
    ))) AS distance_km
  FROM posts p
  WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
    AND 6371 * acos(least(1, greatest(-1,
      cos(radians(user_lat)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(user_lng))
      + sin(radians(user_lat)) * sin(radians(p.lat))
    ))) <= radius_km
  ORDER BY distance_km
  LIMIT max_count;
$$;

-- Engagement velocity: likes + comments per post in last N hours (for feed ranking)
CREATE OR REPLACE FUNCTION public.get_post_engagement_velocity(
  post_ids uuid[],
  hours_window int DEFAULT 24
)
RETURNS TABLE (post_id uuid, velocity_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH since AS (SELECT now() - (hours_window || ' hours')::interval AS t),
  likes AS (
    SELECT pl.post_id, COUNT(*)::bigint AS c
    FROM post_likes pl, since
    WHERE pl.post_id = ANY(post_ids) AND pl.created_at >= since.t
    GROUP BY pl.post_id
  ),
  comments AS (
    SELECT pc.post_id, COUNT(*)::bigint AS c
    FROM post_comments pc, since
    WHERE pc.post_id = ANY(post_ids) AND pc.created_at >= since.t
    GROUP BY pc.post_id
  ),
  combined AS (
    SELECT p AS post_id, COALESCE(l.c, 0) + COALESCE(c.c, 0) AS velocity_count
    FROM unnest(post_ids) AS p
    LEFT JOIN likes l ON l.post_id = p
    LEFT JOIN comments c ON c.post_id = p
  )
  SELECT combined.post_id, combined.velocity_count FROM combined;
$$;

-- Watch time: record view duration per post (for feed ranking)
CREATE TABLE IF NOT EXISTS public.post_watch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  duration_seconds numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_watch_events_post_id_idx ON public.post_watch_events(post_id);
CREATE INDEX IF NOT EXISTS post_watch_events_created_at_idx ON public.post_watch_events(created_at);

ALTER TABLE public.post_watch_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_watch_events_insert_own" ON public.post_watch_events;
DROP POLICY IF EXISTS "post_watch_events_select" ON public.post_watch_events;
CREATE POLICY "post_watch_events_insert_own" ON public.post_watch_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "post_watch_events_select" ON public.post_watch_events FOR SELECT USING (true);

-- Watch aggregates per post (last 7 days) for feed ranking
CREATE OR REPLACE FUNCTION public.get_post_watch_aggregates(
  post_ids uuid[],
  days_window int DEFAULT 7
)
RETURNS TABLE (post_id uuid, total_seconds numeric, view_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH since AS (SELECT now() - (days_window || ' days')::interval AS t),
  agg AS (
    SELECT pwe.post_id,
      COALESCE(SUM(pwe.duration_seconds), 0)::numeric AS total_seconds,
      COUNT(*)::bigint AS view_count
    FROM post_watch_events pwe, since
    WHERE pwe.post_id = ANY(post_ids) AND pwe.created_at >= since.t
    GROUP BY pwe.post_id
  )
  SELECT p AS post_id, COALESCE(a.total_seconds, 0), COALESCE(a.view_count, 0)::bigint
  FROM unnest(post_ids) AS p
  LEFT JOIN agg a ON a.post_id = p;
$$;

-- Comment depth: total comments and reply count per post (for feed ranking)
CREATE OR REPLACE FUNCTION public.get_post_comment_depth(post_ids uuid[])
RETURNS TABLE (post_id uuid, total_comments bigint, reply_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH totals AS (
    SELECT pc.post_id, COUNT(*)::bigint AS total_comments,
      COUNT(*) FILTER (WHERE pc.parent_id IS NOT NULL)::bigint AS reply_count
    FROM post_comments pc
    WHERE pc.post_id = ANY(post_ids)
    GROUP BY pc.post_id
  )
  SELECT p AS post_id, COALESCE(t.total_comments, 0), COALESCE(t.reply_count, 0)
  FROM unnest(post_ids) AS p
  LEFT JOIN totals t ON t.post_id = p;
$$;

-- Checkout: promo codes
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('percent', 'fixed_cents')),
  value int NOT NULL,
  min_order_cents int DEFAULT 0,
  max_uses int,
  used_count int DEFAULT 0,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_key ON public.promo_codes(UPPER(TRIM(code)));

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promo_codes_select" ON public.promo_codes;
CREATE POLICY "promo_codes_select" ON public.promo_codes FOR SELECT USING (true);

-- Checkout: orders
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'escrow_held' CHECK (status IN ('paid', 'escrow_held', 'released', 'refunded', 'disputed')),
  subtotal_cents int NOT NULL,
  discount_cents int NOT NULL DEFAULT 0,
  total_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  stripe_payment_intent_id text UNIQUE,
  coupon_id uuid REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  escrow_release_at timestamptz,
  released_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_buyer_id_idx ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS orders_stripe_payment_intent_id_idx ON public.orders(stripe_payment_intent_id);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
CREATE POLICY "orders_select_own" ON public.orders FOR SELECT TO authenticated USING (buyer_id = auth.uid());
DROP POLICY IF EXISTS "orders_select_creator" ON public.orders;
CREATE POLICY "orders_select_creator" ON public.orders FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = orders.id AND oi.creator_id = auth.uid())
);
CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);

-- Checkout: order line items
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  creator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text,
  price_cents int NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  line_total_cents int NOT NULL
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items(order_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select_via_order" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_own_as_creator" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
CREATE POLICY "order_items_select_via_order" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND buyer_id = auth.uid())
);
CREATE POLICY "order_items_select_own_as_creator" ON public.order_items FOR SELECT TO authenticated USING (
  creator_id = auth.uid()
);
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT TO authenticated WITH CHECK (true);

-- Shipments (one per order; trigger notifies buyer on insert/update)
CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  carrier text,
  tracking_number text,
  tracking_url text,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'in_transit', 'out_for_delivery', 'delivered')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipments_order_id_idx ON public.shipments(order_id);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipments_select_buyer" ON public.shipments;
DROP POLICY IF EXISTS "shipments_insert" ON public.shipments;
CREATE POLICY "shipments_select_buyer" ON public.shipments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND buyer_id = auth.uid())
);
CREATE POLICY "shipments_insert" ON public.shipments FOR INSERT TO authenticated WITH CHECK (true);

-- Abandoned carts
CREATE TABLE IF NOT EXISTS public.abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  cart_snapshot jsonb NOT NULL DEFAULT '[]',
  subtotal_cents int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS abandoned_carts_user_id_key ON public.abandoned_carts(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.abandoned_carts ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "abandoned_carts_select_own" ON public.abandoned_carts;
DROP POLICY IF EXISTS "abandoned_carts_insert" ON public.abandoned_carts;
DROP POLICY IF EXISTS "abandoned_carts_update_own" ON public.abandoned_carts;
CREATE POLICY "abandoned_carts_select_own" ON public.abandoned_carts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "abandoned_carts_insert" ON public.abandoned_carts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "abandoned_carts_update_own" ON public.abandoned_carts FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Products (creator catalog)
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  price text,
  media_uri text,
  cover_uri text,
  interval text,
  pinned boolean DEFAULT false,
  is_sponsored boolean DEFAULT false,
  rating numeric,
  inventory_status text,
  currency text,
  delivery_type text,
  price_tiers jsonb,
  service_slots jsonb,
  event_date bigint,
  event_time text,
  stock_quantity int,
  variants jsonb,
  escrow_required boolean DEFAULT false,
  chain text,
  is_wholesale boolean DEFAULT false,
  token_gated boolean DEFAULT false,
  category text,
  categories text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS go_live_at timestamptz;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS media_mime_type text;

-- Ensure columns exist for DBs created before these were added
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS categories text[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cover_uri text;

CREATE INDEX IF NOT EXISTS products_creator_id_idx ON public.products(creator_id);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_insert_own" ON public.products;
DROP POLICY IF EXISTS "products_update_own" ON public.products;
DROP POLICY IF EXISTS "products_delete_own" ON public.products;
CREATE POLICY "products_select" ON public.products FOR SELECT USING (true);
CREATE POLICY "products_insert_own" ON public.products FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "products_update_own" ON public.products FOR UPDATE TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "products_delete_own" ON public.products FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- Saved products (user bookmarks)
CREATE TABLE IF NOT EXISTS public.saved_products (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
ALTER TABLE public.saved_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saved_products_select_own" ON public.saved_products;
DROP POLICY IF EXISTS "saved_products_insert_own" ON public.saved_products;
DROP POLICY IF EXISTS "saved_products_delete_own" ON public.saved_products;
CREATE POLICY "saved_products_select_own" ON public.saved_products FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "saved_products_insert_own" ON public.saved_products FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_products_delete_own" ON public.saved_products FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Wishlist
CREATE TABLE IF NOT EXISTS public.wishlist (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wishlist_select_own" ON public.wishlist;
DROP POLICY IF EXISTS "wishlist_insert_own" ON public.wishlist;
DROP POLICY IF EXISTS "wishlist_delete_own" ON public.wishlist;
CREATE POLICY "wishlist_select_own" ON public.wishlist FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wishlist_insert_own" ON public.wishlist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wishlist_delete_own" ON public.wishlist FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Cart items (current cart per user)
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1,
  selected_tier_index int DEFAULT 0,
  product_snapshot jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS cart_items_user_id_idx ON public.cart_items(user_id);
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cart_items_select_own" ON public.cart_items;
DROP POLICY IF EXISTS "cart_items_insert_own" ON public.cart_items;
DROP POLICY IF EXISTS "cart_items_update_own" ON public.cart_items;
DROP POLICY IF EXISTS "cart_items_delete_own" ON public.cart_items;
CREATE POLICY "cart_items_select_own" ON public.cart_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cart_items_insert_own" ON public.cart_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cart_items_update_own" ON public.cart_items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cart_items_delete_own" ON public.cart_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Product reviews
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_reviews_product_id_idx ON public.product_reviews(product_id);
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_reviews_select" ON public.product_reviews;
DROP POLICY IF EXISTS "product_reviews_insert_own" ON public.product_reviews;
CREATE POLICY "product_reviews_select" ON public.product_reviews FOR SELECT USING (true);
CREATE POLICY "product_reviews_insert_own" ON public.product_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Events (creator events)
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  date bigint NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_user_id_idx ON public.events(user_id);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events_select" ON public.events;
DROP POLICY IF EXISTS "events_insert_own" ON public.events;
DROP POLICY IF EXISTS "events_update_own" ON public.events;
DROP POLICY IF EXISTS "events_delete_own" ON public.events;
CREATE POLICY "events_select" ON public.events FOR SELECT USING (true);
CREATE POLICY "events_insert_own" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "events_update_own" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "events_delete_own" ON public.events FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Creator payouts (after escrow release)
CREATE TABLE IF NOT EXISTS public.creator_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents int NOT NULL,
  fee_cents int NOT NULL DEFAULT 0,
  stripe_transfer_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  instant boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_payouts_creator_id_idx ON public.creator_payouts(creator_id);

ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creator_payouts_select_own" ON public.creator_payouts;
CREATE POLICY "creator_payouts_select_own" ON public.creator_payouts FOR SELECT TO authenticated USING (creator_id = auth.uid());

-- Profiles: Stripe Connect for creator payouts
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;

-- Notifications (created by triggers and server: like, comment, follow, repost, commerce, tips, etc.)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type text NOT NULL,
  target_type text,
  target_id uuid,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx ON public.notifications(recipient_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "notifications_insert_own" ON public.notifications FOR INSERT TO authenticated WITH CHECK (recipient_id = auth.uid());

-- Push tokens (Expo) for device notifications when a notification row is inserted
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, expo_push_token)
);
CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens(user_id);
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_tokens_select_own" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_insert_own" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_delete_own" ON public.push_tokens;
CREATE POLICY "push_tokens_select_own" ON public.push_tokens FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "push_tokens_insert_own" ON public.push_tokens FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_tokens_delete_own" ON public.push_tokens FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Trigger: create notification when someone likes a post
CREATE OR REPLACE FUNCTION public.notify_on_post_like()
RETURNS trigger AS $$
DECLARE
  post_owner uuid;
BEGIN
  SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
  IF post_owner IS NOT NULL AND post_owner != NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id)
    VALUES (post_owner, NEW.user_id, 'like', 'post', NEW.post_id, post_owner);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS post_likes_notify_trigger ON public.post_likes;
CREATE TRIGGER post_likes_notify_trigger
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_like();

-- Trigger: create notification when someone comments on a post (reply -> comment_reply to parent author; top-level -> comment to post owner)
CREATE OR REPLACE FUNCTION public.notify_on_post_comment()
RETURNS trigger AS $$
DECLARE
  post_owner uuid;
  parent_author uuid;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_author FROM public.post_comments WHERE id = NEW.parent_id;
    IF parent_author IS NOT NULL AND parent_author != NEW.user_id THEN
      INSERT INTO public.notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id, metadata)
      VALUES (parent_author, NEW.user_id, 'comment_reply', 'comment', NEW.id, parent_author, jsonb_build_object('post_id', NEW.post_id));
    END IF;
  ELSE
    SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
    IF post_owner IS NOT NULL AND post_owner != NEW.user_id THEN
      INSERT INTO public.notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id)
      VALUES (post_owner, NEW.user_id, 'comment', 'post', NEW.post_id, post_owner);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS post_comments_notify_trigger ON public.post_comments;
CREATE TRIGGER post_comments_notify_trigger
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_comment();

-- Trigger: create notification when someone follows you
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', NULL, NULL, NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS follows_notify_trigger ON public.follows;
CREATE TRIGGER follows_notify_trigger
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- Trigger: create notification when someone reposts your post
CREATE OR REPLACE FUNCTION public.notify_on_repost()
RETURNS trigger AS $$
DECLARE
  post_owner uuid;
BEGIN
  SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
  IF post_owner IS NOT NULL AND post_owner != NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id)
    VALUES (post_owner, NEW.user_id, 'repost', 'post', NEW.post_id, post_owner);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS reposts_notify_trigger ON public.reposts;
CREATE TRIGGER reposts_notify_trigger
  AFTER INSERT ON public.reposts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_repost();

-- Trigger: comment like -> notify comment author
CREATE OR REPLACE FUNCTION public.notify_on_comment_like()
RETURNS trigger AS $$
DECLARE
  comment_author uuid;
  comment_post_id uuid;
BEGIN
  SELECT user_id, post_id INTO comment_author, comment_post_id
  FROM public.post_comments WHERE id = NEW.comment_id;
  IF comment_author IS NOT NULL AND comment_author != NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id, metadata)
    VALUES (comment_author, NEW.user_id, 'comment_like', 'comment', NEW.comment_id, comment_author, jsonb_build_object('post_id', comment_post_id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS comment_likes_notify_trigger ON public.comment_likes;
CREATE TRIGGER comment_likes_notify_trigger
  AFTER INSERT ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment_like();

-- Trigger: save post -> notify post author
CREATE OR REPLACE FUNCTION public.notify_on_save_post()
RETURNS trigger AS $$
DECLARE
  post_owner uuid;
BEGIN
  SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
  IF post_owner IS NOT NULL AND post_owner != NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id)
    VALUES (post_owner, NEW.user_id, 'save_post', 'post', NEW.post_id, post_owner);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS saved_posts_notify_trigger ON public.saved_posts;
CREATE TRIGGER saved_posts_notify_trigger
  AFTER INSERT ON public.saved_posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_save_post();

-- Trigger: product review -> notify product creator
CREATE OR REPLACE FUNCTION public.notify_on_product_review()
RETURNS trigger AS $$
DECLARE
  prod_creator uuid;
BEGIN
  SELECT creator_id INTO prod_creator FROM public.products WHERE id = NEW.product_id;
  IF prod_creator IS NOT NULL AND prod_creator != NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id)
    VALUES (prod_creator, NEW.user_id, 'product_review', 'product', NEW.product_id, prod_creator);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS product_reviews_notify_trigger ON public.product_reviews;
CREATE TRIGGER product_reviews_notify_trigger
  AFTER INSERT ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_product_review();

-- Trigger: order_items insert -> product_sale notification per creator
CREATE OR REPLACE FUNCTION public.notify_on_product_sale()
RETURNS trigger AS $$
DECLARE
  buyer uuid;
BEGIN
  IF NEW.creator_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT buyer_id INTO buyer FROM public.orders WHERE id = NEW.order_id;
  IF buyer IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id, metadata)
  VALUES (NEW.creator_id, buyer, 'product_sale', 'order', NEW.order_id, NEW.creator_id, jsonb_build_object('product_id', NEW.product_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS order_items_notify_trigger ON public.order_items;
CREATE TRIGGER order_items_notify_trigger
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_product_sale();

-- Trigger: orders UPDATE -> released: delivery_confirmed to each creator; refunded/disputed: order_refunded/order_disputed to buyer (and optionally creator)
CREATE OR REPLACE FUNCTION public.notify_on_order_status_change()
RETURNS trigger AS $$
DECLARE
  creator_rec RECORD;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'released' THEN
    FOR creator_rec IN SELECT DISTINCT creator_id FROM public.order_items WHERE order_id = NEW.id AND creator_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id)
      VALUES (creator_rec.creator_id, NEW.buyer_id, 'delivery_confirmed', 'order', NEW.id, creator_rec.creator_id);
    END LOOP;
  ELSIF NEW.status = 'refunded' OR NEW.status = 'disputed' THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id)
    VALUES (NEW.buyer_id, NULL, CASE WHEN NEW.status = 'refunded' THEN 'order_refunded' ELSE 'order_disputed' END, 'order', NEW.id, NULL);
    FOR creator_rec IN SELECT DISTINCT creator_id FROM public.order_items WHERE order_id = NEW.id AND creator_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id)
      VALUES (creator_rec.creator_id, NULL, CASE WHEN NEW.status = 'refunded' THEN 'order_refunded' ELSE 'order_disputed' END, 'order', NEW.id, creator_rec.creator_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS orders_notify_trigger ON public.orders;
CREATE TRIGGER orders_notify_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_order_status_change();

-- Trigger: shipments insert/update -> notify buyer (order_shipped or tracking_updated); if status = delivered, optional delivery_confirmed is handled by confirm-delivery flow
CREATE OR REPLACE FUNCTION public.notify_on_shipment()
RETURNS trigger AS $$
DECLARE
  buyer uuid;
  notif_type text;
BEGIN
  SELECT buyer_id INTO buyer FROM public.orders WHERE id = NEW.order_id;
  IF buyer IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    notif_type := 'order_shipped';
  ELSE
    notif_type := 'tracking_updated';
  END IF;
  INSERT INTO public.notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id, metadata)
  VALUES (buyer, NULL, notif_type, 'order', NEW.order_id, NULL, jsonb_build_object('tracking_url', NEW.tracking_url, 'carrier', NEW.carrier));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS shipments_notify_trigger ON public.shipments;
CREATE TRIGGER shipments_notify_trigger
  AFTER INSERT OR UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_shipment();

-- Appointments / bookings (creator events or product slots)
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  reminder_notification_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointments_creator_id_idx ON public.appointments(creator_id);
CREATE INDEX IF NOT EXISTS appointments_user_id_idx ON public.appointments(user_id);
CREATE INDEX IF NOT EXISTS appointments_scheduled_at_idx ON public.appointments(scheduled_at);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_select_own" ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert" ON public.appointments;
CREATE POLICY "appointments_select_own" ON public.appointments FOR SELECT TO authenticated USING (
  creator_id = auth.uid() OR user_id = auth.uid()
);
CREATE POLICY "appointments_insert" ON public.appointments FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger: new booking -> notify creator
CREATE OR REPLACE FUNCTION public.notify_on_booking()
RETURNS trigger AS $$
BEGIN
  IF NEW.creator_id != NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id, metadata)
    VALUES (NEW.creator_id, NEW.user_id, 'booking', 'appointment', NEW.id, NEW.creator_id, jsonb_build_object('scheduled_at', NEW.scheduled_at));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS appointments_notify_trigger ON public.appointments;
CREATE TRIGGER appointments_notify_trigger
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_booking();

-- Mention: extract @username from post or comment body and notify mentioned users
CREATE OR REPLACE FUNCTION public.notify_mentions(
  p_author_id uuid,
  p_body text,
  p_target_type text,
  p_target_id uuid,
  p_target_user_id uuid,
  p_metadata jsonb DEFAULT NULL
) RETURNS void AS $$
DECLARE
  mention_username text;
  mentioned_id uuid;
  seen_ids uuid[] := '{}';
BEGIN
  IF p_body IS NULL OR p_body = '' THEN
    RETURN;
  END IF;
  FOR mention_username IN SELECT DISTINCT (regexp_matches(p_body, '@([a-zA-Z0-9_]+)', 'g'))[1]
  LOOP
    SELECT id INTO mentioned_id FROM public.profiles WHERE LOWER(username) = LOWER(mention_username) AND id != p_author_id LIMIT 1;
    IF mentioned_id IS NOT NULL AND NOT (mentioned_id = ANY(seen_ids)) THEN
      seen_ids := seen_ids || mentioned_id;
      INSERT INTO public.notifications (recipient_id, actor_id, type, target_type, target_id, target_user_id, metadata)
      VALUES (mentioned_id, p_author_id, 'mention', p_target_type, p_target_id, p_target_user_id, p_metadata);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.notify_mentions_on_post()
RETURNS trigger AS $$
BEGIN
  PERFORM public.notify_mentions(
    NEW.user_id,
    COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.body, ''),
    'post',
    NEW.id,
    NEW.user_id,
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.notify_mentions_on_comment()
RETURNS trigger AS $$
BEGIN
  PERFORM public.notify_mentions(
    NEW.user_id,
    NEW.body,
    'comment',
    NEW.id,
    NEW.user_id,
    jsonb_build_object('post_id', NEW.post_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS posts_mention_trigger ON public.posts;
CREATE TRIGGER posts_mention_trigger
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_mentions_on_post();

DROP TRIGGER IF EXISTS post_comments_mention_trigger ON public.post_comments;
CREATE TRIGGER post_comments_mention_trigger
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_mentions_on_comment();

-- Messaging: conversations, participants, messages, reactions, CRM meta.
-- Realtime for messages/message_reactions: run migration 20250218000000_messaging.sql (ALTER PUBLICATION).

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON public.conversations(updated_at);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant" ON public.conversations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid())
);
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "conversations_update_participant" ON public.conversations FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  last_read_at timestamptz,
  pinned boolean DEFAULT false,
  muted boolean DEFAULT false,
  archived boolean DEFAULT false,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_participants_user_id_idx ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS conversation_participants_last_read_idx ON public.conversation_participants(conversation_id, last_read_at);

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_participants_select_own" ON public.conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_insert" ON public.conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_update_own" ON public.conversation_participants;
CREATE POLICY "conversation_participants_select_own" ON public.conversation_participants FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "conversation_participants_insert" ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR true);
CREATE POLICY "conversation_participants_update_own" ON public.conversation_participants FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  parent_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'voice', 'file', 'system')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_parent_id_idx ON public.messages(parent_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;
CREATE POLICY "messages_select_participant" ON public.messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid())
);
CREATE POLICY "messages_insert_participant" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid())
);
CREATE POLICY "messages_update_own" ON public.messages FOR UPDATE TO authenticated USING (sender_id = auth.uid());
CREATE POLICY "messages_delete_own" ON public.messages FOR DELETE TO authenticated USING (sender_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS message_reactions_message_id_idx ON public.message_reactions(message_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_reactions_select" ON public.message_reactions;
DROP POLICY IF EXISTS "message_reactions_insert_own" ON public.message_reactions;
DROP POLICY IF EXISTS "message_reactions_delete_own" ON public.message_reactions;
CREATE POLICY "message_reactions_select" ON public.message_reactions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.messages m JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id WHERE m.id = message_reactions.message_id AND cp.user_id = auth.uid())
);
CREATE POLICY "message_reactions_insert_own" ON public.message_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "message_reactions_delete_own" ON public.message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.conversation_contact_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pipeline_stage text,
  tags text[] DEFAULT '{}',
  notes text,
  follow_up_at timestamptz,
  lead_score int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_contact_meta_conversation_user_idx ON public.conversation_contact_meta(conversation_id, user_id);

ALTER TABLE public.conversation_contact_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_contact_meta_select_participant" ON public.conversation_contact_meta;
DROP POLICY IF EXISTS "conversation_contact_meta_insert" ON public.conversation_contact_meta;
DROP POLICY IF EXISTS "conversation_contact_meta_update_participant" ON public.conversation_contact_meta;
CREATE POLICY "conversation_contact_meta_select_participant" ON public.conversation_contact_meta FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_contact_meta.conversation_id AND cp.user_id = auth.uid())
);
CREATE POLICY "conversation_contact_meta_insert" ON public.conversation_contact_meta FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_contact_meta.conversation_id AND cp.user_id = auth.uid())
);
CREATE POLICY "conversation_contact_meta_update_participant" ON public.conversation_contact_meta FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_contact_meta.conversation_id AND cp.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.conversations_updated_at_on_message()
RETURNS trigger AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS messages_conversation_updated_at ON public.messages;
CREATE TRIGGER messages_conversation_updated_at
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.conversations_updated_at_on_message();
