-- Messaging: conversations, participants, messages, reactions, CRM meta.
-- Enables tablet 3-panel messaging with Realtime chat.

-- Conversations (DM or group)
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

-- Participants (per-user state: pin, mute, archive, last_read)
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

-- Messages
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

-- Message reactions
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

-- CRM/conversation contact meta (pipeline, tags, notes, follow-up, lead score)
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

-- Update conversation.updated_at when a message is inserted
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

-- Allow creators to read orders where they have order_items (for CRM "revenue from this user")
DROP POLICY IF EXISTS "orders_select_creator" ON public.orders;
CREATE POLICY "orders_select_creator" ON public.orders FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = orders.id AND oi.creator_id = auth.uid())
);

-- Realtime: broadcast new/updated messages for live chat
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END $$;
