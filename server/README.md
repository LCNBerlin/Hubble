# Hubble Payments Server

Minimal Express server that creates Stripe PaymentIntents for tips and checkout in the Hubble app.

## Setup

1. Install dependencies:

   ```bash
   cd server && npm install
   ```

2. Copy `.env.example` to `.env` and set at least:

   ```bash
   cp .env.example .env
   ```

   - **STRIPE_SECRET_KEY** – Get test keys from [Stripe Dashboard → API keys](https://dashboard.stripe.com/apikeys). Use `sk_test_...` for development.
   - **SUPABASE_URL** and **SUPABASE_SERVICE_ROLE_KEY** – Required for orders, payouts, and the **push notification webhook**. In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Settings** → **API**: use **Project URL** and the **service_role** secret (not the anon key).

3. Start the server:

   ```bash
   npm start
   ```

   Or run with auto-reload: `npm run dev`

Server runs at `http://localhost:4242` by default.

## App configuration

In the project root, copy `.env.example` to `.env` and set:

- `EXPO_PUBLIC_API_URL` – Payments API URL. Use `http://localhost:4242` for simulator. For a physical device, use your machine’s LAN IP (e.g. `http://192.168.1.10:4242`).
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` – Stripe publishable key (`pk_test_...` for development).

Without these, the app still runs but tips and checkout use a mock flow (alert-only, no real payment).

## API

- **POST /create-payment-intent**

  Body:

  ```json
  {
    "amount": 500,
    "currency": "usd",
    "metadata": { "type": "tip", "postTitle": "Optional" }
  }
  ```

  `amount` is in the currency’s smallest unit (cents for USD, whole units for JPY).  
  Returns `{ clientSecret, paymentIntentId }` for use with Stripe’s Payment Sheet in the app.

## Push notifications (device / lock screen)

When a row is inserted into Supabase `notifications`, the server can send an Expo push to the recipient’s device(s) so they get an OS notification.

1. **Run migrations**  
   In Supabase, run the migration that creates the `push_tokens` table (see `supabase/migrations/20250218_push_tokens.sql`). The app registers each device’s Expo push token there after login.

2. **Configure Supabase Database Webhook**  
   In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Database** → **Webhooks** → **Create a new hook**, use:

   | Field | Value |
   |-------|--------|
   | **Name** | `notification-created-push` |
   | **Table** | `public.notifications` (or `notifications`) |
   | **Events** | ✅ **Insert** only (leave Update and Delete unchecked) |
   | **Type of webhook** | **HTTP Request** |
   | **Method** | **POST** |
   | **URL** | `https://YOUR_SERVER_URL/webhooks/notification-created` |
   | **Timeout** | `5000` |
   | **HTTP Headers** | Keep **Content-type** = **application/json** |
   | **HTTP Parameters** | Leave empty |

   **Replace `YOUR_SERVER_URL`** using one of the options below.

3. **Deploy**  
   The server must be reachable from the internet so Supabase can call the webhook. For local dev use ngrok (see below).

---

### Get your webhook URL — step by step

#### Option A: Local testing with ngrok

1. **Start your server** (in one terminal):
   ```bash
   cd server && npm start
   ```
   Leave it running. You should see: `Hubble payments server running at http://localhost:4242`.

2. **Install and authenticate ngrok** (one-time):
   - Sign up (free): [dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup). Verify your account.
   - Install: [ngrok.com/download](https://ngrok.com/download) or `brew install ngrok`.
   - Get your authtoken: [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken), then run:
     ```bash
     ngrok config add-authtoken YOUR_TOKEN
     ```
     (Paste your token in place of `YOUR_TOKEN`. Without this step you’ll get `ERR_NGROK_4018`.)

3. **Start ngrok** (in a second terminal):
   ```bash
   ngrok http 4242
   ```

4. **Copy the HTTPS URL** from the ngrok terminal. It looks like:
   ```
   Forwarding   https://a1b2c3d4.ngrok-free.app -> http://localhost:4242
   ```
   Your base URL is the `https://...` part (e.g. `https://a1b2c3d4.ngrok-free.app`).

5. **Build the webhook URL:**  
   Take that base URL and add `/webhooks/notification-created` with no trailing slash.  
   Example: `https://a1b2c3d4.ngrok-free.app/webhooks/notification-created`

6. **Paste that full URL** into the Supabase webhook form in the **URL** field, then click **Create webhook**.

   **Note:** The free ngrok URL changes every time you restart ngrok. If you restart, update the webhook URL in Supabase to the new ngrok URL.

#### Option B: Production (deployed server)

1. Deploy your `server` folder to a host (e.g. Railway, Render, Fly.io, your own VPS) so it’s reachable at a public HTTPS URL.

2. Your base URL is whatever you use to call the API (e.g. `https://hubble-api.up.railway.app`).

3. **Webhook URL** = base URL + `/webhooks/notification-created`  
   Example: `https://hubble-api.up.railway.app/webhooks/notification-created`

4. Paste that URL into the Supabase webhook form and create the webhook.

---

Supabase will POST the new row as `{ type: 'INSERT', table: 'notifications', record: { id, recipient_id, type, ... } }`. The server looks up `push_tokens` for `recipient_id` and sends an Expo push for each token.

**Push not showing on iPhone/iPad?**

1. **Check server logs** when a notification is created. You should see either:
   - `[push] No push tokens for recipient ...` → The app hasn’t saved a token. Use a **physical device** (not simulator), grant **notification permission** when prompted, and open the app while logged in so it can register the token. Restart the app and trigger another notification.
   - `[push] recipient ... tokens: 1 sent: 1` → The server sent the push. If it still doesn’t appear: force-quit the app and trigger again (to test when app is in background), or build with **EAS Build** so the app has proper push credentials (Expo Go has limitations).

2. **Ensure the app registered a token:** In Supabase → Table Editor → `push_tokens`, confirm there is a row with your `user_id` and an `expo_push_token`. If the table is empty for your user, fix permission/device and reopen the app.

3. **iOS:** For production or reliable delivery, use a **development build** or **EAS Build** (not Expo Go). Add your EAS `projectId` to `app.json` under `expo.extra.eas.projectId` if you use EAS.
