-- Run this in Supabase SQL Editor if you're not getting any notifications.
-- It fixes the notifications table and ensures all triggers exist.

-- 1. Allow null actor_id (for system notifications) and add metadata
ALTER TABLE public.notifications ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 2. Ensure INSERT policy exists (for app-created notifications)
DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;
CREATE POLICY "notifications_insert_own" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (recipient_id = auth.uid());

-- 3. Re-create core notification triggers (like, comment, follow, repost)
CREATE OR REPLACE FUNCTION public.notify_on_post_like()
RETURNS trigger AS $$
DECLARE post_owner uuid;
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

CREATE OR REPLACE FUNCTION public.notify_on_post_comment()
RETURNS trigger AS $$
DECLARE post_owner uuid; parent_author uuid;
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

CREATE OR REPLACE FUNCTION public.notify_on_repost()
RETURNS trigger AS $$
DECLARE post_owner uuid;
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
