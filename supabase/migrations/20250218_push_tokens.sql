-- Store Expo push tokens per user so we can send device notifications when a notification row is inserted.
-- One user can have multiple devices (phone, tablet).
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
