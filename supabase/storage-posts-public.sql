-- =============================================================================
-- POSTS BUCKET: required for feed images/videos from OTHER creators to be visible
-- =============================================================================
-- This is NOT the "profile" bucket (profile = avatars/banners only).
-- You need a SEPARATE bucket named "posts" for post pictures/videos/audio.
--
-- BEFORE RUNNING THIS SCRIPT:
--   1. In Supabase: Storage → click "New bucket"
--   2. Name:  posts   (exactly)
--   3. Turn ON: "Public bucket"
--   4. Create bucket
--
-- Then run this script in SQL Editor (it adds read/upload policies).
-- If "posts" already exists but media still doesn't load: Storage → posts → ⋮ → Edit → Public bucket ON.
-- =============================================================================

-- 1. Allow anyone to read (SELECT) objects in the posts bucket.
DROP POLICY IF EXISTS "posts_public_read" ON storage.objects;
CREATE POLICY "posts_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'posts');

-- 2. Allow authenticated users to upload (INSERT) to the posts bucket.
-- Path restriction removed so uploads are not blocked by RLS; app uses path userId/filename.
DROP POLICY IF EXISTS "posts_authenticated_upload" ON storage.objects;
CREATE POLICY "posts_authenticated_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'posts');

-- 3. Allow uploaders to update/delete their own objects (optional, for future use).
DROP POLICY IF EXISTS "posts_authenticated_update_own" ON storage.objects;
CREATE POLICY "posts_authenticated_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'posts' AND (owner_id = auth.uid()::text OR owner_id IS NULL))
WITH CHECK (bucket_id = 'posts');

DROP POLICY IF EXISTS "posts_authenticated_delete_own" ON storage.objects;
CREATE POLICY "posts_authenticated_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'posts' AND (owner_id = auth.uid()::text OR owner_id IS NULL));
