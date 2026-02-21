# Supabase setup for Hubble

## 1. Run the schema (required)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Go to **SQL Editor**.
3. Open `schema.sql` in this folder and copy its **entire** contents.
4. Paste into the SQL Editor and click **Run**.

This creates (if not already present):

- **Tables:** `profiles`, `posts`, `follows`, `post_likes`, `post_dislikes`, `reposts`, `post_comments`, `saved_posts`, `blocked_users`, `reports`
- **RLS policies** so users can only read/write their own data where required.
- **Trigger** to keep `followers_count` / `following_count` on `profiles` in sync with `follows`.

## 2. Confirm in the app

- **Auth:** Sign in (or sign up) once. The app will create a row in `profiles` for you.
- **Feed / profile:** After signing in, the feed and your profile load from Supabase.

## 3. Optional: check .env

From the project root:

```bash
node scripts/check-env.js
```

This checks that `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set. Get the anon key from **Project Settings → API → anon public** (it’s a long JWT starting with `eyJ`).

## 4. Profile pictures and banners (optional)

To allow users to upload a profile picture and banner on the profile tab:

1. In Supabase Dashboard go to **Storage** and create a bucket named **`profile`**.
2. Set the bucket to **Public** (so avatar and banner URLs can be loaded in the app).
3. Add a policy so authenticated users can upload and update their own files, for example:
   - **Policy name:** `Users can upload to own profile folder`
   - **Allowed operation:** INSERT, UPDATE
   - **Target roles:** authenticated
   - **Policy definition:** `(bucket_id = 'profile' AND (storage.foldername(name))[1] IN ('avatars', 'banners'))`
   - Or use the dashboard’s policy builder to allow authenticated users to upload to the `profile` bucket.
4. Add a policy for public read:
   - **Policy name:** `Profile bucket is public read`
   - **Allowed operation:** SELECT
   - **Policy definition:** `true` (or restrict to bucket_id = 'profile').

## 5. Post media (required for other creators’ images/videos to show)

The **profile** bucket is only for avatars and banners. Feed images and videos use a **separate** bucket named **posts**. Do this:

1. **Create the posts bucket (if you don’t have it)**  
   In Supabase: **Storage** → **New bucket**  
   - Name: **posts** (exactly)  
   - **Public bucket**: turn **ON**  
   - Create bucket  

2. **Apply policies**  
   Open **SQL Editor**, paste the full contents of **`storage-posts-public.sql`**, and **Run**.

3. **If “posts” already exists but others still can’t see media**  
   **Storage** → click **posts** → **⋮** (menu) → **Edit bucket** → set **Public bucket** to **ON** → Save.

After this, in Storage you should see both **profile** and **posts**. Post images/videos will then load for everyone.
