-- Enable Supabase Realtime for the notifications table so the app can
-- subscribe to postgres_changes (INSERT/UPDATE) for live badge and list updates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
