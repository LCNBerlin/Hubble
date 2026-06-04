# Hubble

Social commerce platform built with React Native + Expo (mobile) and NestJS (API). Creators sell products, share posts and stories, message fans, and collect revenue — all in one app. Fully migrated off Supabase to a self-hosted stack as of June 2026.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native 0.81.5, Expo 54, Expo Router (file-based), TypeScript |
| Styling | NativeWind 4 (Tailwind for RN) |
| State | Zustand 5, TanStack React Query 5 |
| Payments (mobile) | @stripe/stripe-react-native 0.58 |
| API | NestJS 10, TypeORM 0.3, Passport JWT |
| Database | Postgres (Railway), ~36 tables |
| Cache | Redis via @keyv/redis (optional — degrades to in-memory if `REDIS_URL` absent) |
| Storage | AWS S3 (3 buckets: profiles / posts / stories) |
| Payments (server) | Stripe (payment intents + Connect) |
| Deployment | Railway (Nixpacks, root dir `server/nestjs`) |

---

## Repository Structure

```
hubble/
├── app/                        # Expo Router screens (file-based routing)
│   ├── (auth)/                 # Login / register / onboarding
│   ├── (tabs)/                 # Bottom tab navigation
│   ├── creator/                # Creator dashboard & tools
│   ├── edit-post/              # Post editing flow
│   ├── edit-product/           # Product editing flow
│   ├── insights/               # Analytics / insights
│   ├── orders.tsx
│   ├── product/                # Product detail view
│   ├── revenue-splits.tsx
│   ├── storage/                # Storage management
│   └── story-viewer/           # Story playback
├── components/                 # Shared React Native components
├── context/                    # React contexts
├── hooks/                      # Custom hooks
├── lib/                        # API client, utilities
├── store/                      # Zustand stores
├── server/
│   └── nestjs/                 # NestJS backend (Railway service root)
│       ├── src/
│       │   ├── app.module.ts
│       │   ├── main.ts
│       │   ├── auth/           # JWT auth, refresh tokens, bcrypt
│       │   ├── analytics/      # View and engagement tracking
│       │   ├── commerce/       # Cart, wishlist, promo codes
│       │   ├── common/
│       │   │   ├── database/   # TypeORM config, schema.sql, functions.sql
│       │   │   └── redis/      # Cache module (global, optional)
│       │   ├── cron/           # Scheduled background jobs
│       │   ├── events/         # IRL events / appointments
│       │   ├── feed/           # Algorithmic and following feed
│       │   ├── messaging/      # DMs, conversations, reactions
│       │   ├── notifications/  # Push tokens, notification dispatch
│       │   ├── orders/         # Order lifecycle management
│       │   ├── payments/       # Stripe intents, coupons, payouts
│       │   ├── posts/          # Posts, likes, comments, reposts
│       │   ├── products/       # Listings, reviews, saved products
│       │   ├── profiles/       # User profiles, follows, blocks
│       │   ├── reports/        # Content reports
│       │   ├── revenue-splits/ # Creator revenue split configuration
│       │   ├── storage/        # S3 presigned URL generation
│       │   └── stories/        # Story creation and retrieval
│       ├── railway.json
│       └── package.json
├── package.json                # Expo / RN root
├── app.json                    # Expo config
└── .env.example                # Frontend env template
```

---

## Prerequisites

- Node.js 20+
- npm 10+
- Postgres 15+
- Redis (optional — app runs without it, caching disabled)
- AWS S3 buckets (3)
- Stripe account
- Expo CLI: `npm install -g expo`

---

## Frontend Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create a `.env` file at the repo root:

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | NestJS API base URL. Use machine LAN IP (e.g. `http://192.168.1.x:4243`) for physical device; `http://localhost:4243` for simulator. |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_test_...` or `pk_live_...`) |
| `EXPO_PUBLIC_SUPABASE_URL` | Legacy — not used at runtime. Can be omitted. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Legacy — not used at runtime. Can be omitted. |

### 3. Run dev build

```bash
npx expo start
# Press i for iOS simulator, a for Android emulator, or scan QR with Expo Go
```

> **lightningcss binary fix**: if Expo crashes on start with a native binary error, run `node node_modules/lightningcss/scripts/install.js` then restart.

---

## Backend Setup

### 1. Install dependencies

```bash
cd server/nestjs
npm install
```

### 2. Environment variables

Create a `.env` file inside `server/nestjs/`:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string, e.g. `postgresql://user:pass@host:5432/hubble` |
| `JWT_SECRET` | yes | Random string for signing JWT access tokens (tokens expire in 15m) |
| `REDIS_URL` | no | Redis connection string. Omit to use in-memory cache fallback. |
| `STRIPE_SECRET_KEY` | yes (payments) | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `CONNECT_RETURN_URL` | yes (payouts) | Stripe Connect onboarding return URL |
| `CONNECT_REFRESH_URL` | yes (payouts) | Stripe Connect onboarding refresh URL |
| `AWS_ACCESS_KEY_ID` | yes (storage) | IAM access key for S3 uploads |
| `AWS_SECRET_ACCESS_KEY` | yes (storage) | IAM secret key for S3 uploads |
| `AWS_REGION` | no | S3 region (default: `us-east-1`) |
| `S3_BUCKET_PROFILES` | no | Bucket for profile images (default: `hubble-profiles`) |
| `S3_BUCKET_POSTS` | no | Bucket for post media (default: `hubble-posts`) |
| `S3_BUCKET_STORIES` | no | Bucket for stories (default: `hubble-stories`) |
| `NODE_ENV` | no | `production` enables SSL on DB connection and disables TypeORM auto-sync |
| `PORT` | no | Server port (default: `4243`) |

### 3. Run locally

```bash
npm run start:dev     # hot reload via @nestjs/cli
npm run build && npm start   # compiled output
```

The API starts on `http://0.0.0.0:4243` with global prefix `/api`.

### 4. Health check

```
GET /api/health  →  { "status": "ok" }
```

Rate limit: 60 requests / 60 seconds per IP (global, applied in all environments).

---

## Railway Deployment (Backend)

The backend deploys from `server/nestjs` as the Railway service root. Set **Root Directory** to `server/nestjs` in Railway service settings.

**`server/nestjs/railway.json`:**
```json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "node dist/main",
    "healthcheckPath": "/api/health"
  }
}
```

Build flow: Railway detects Nixpacks → installs deps → runs `npm run build` (`nest build`) → starts with `node dist/main`.

**Minimum required Railway env vars**: `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `NODE_ENV=production`.

Railway injects `PORT` automatically — do not override it.

---

## Database

Postgres managed on Railway. Schema defined in:

```
server/nestjs/src/common/database/schema.sql    # table definitions
server/nestjs/src/common/database/functions.sql # stored functions / RPC helpers
```

**Schema domains:**

| Domain | Tables |
|---|---|
| Social | `profiles`, `follows`, `blocked_users`, `reports` |
| Posts & Content | `posts`, `post_likes`, `post_comments`, `reposts`, `saved_posts`, `hashtags`, `post_hashtags`, `comment_likes`, `comment_dislikes`, `post_watch_events` |
| Stories | `stories` |
| Marketplace | `products`, `product_reviews`, `saved_products`, `cart_items`, `wishlist`, `promo_codes` |
| Orders & Payments | `orders`, `order_items`, `abandoned_carts`, `shipments`, `creator_payouts`, `revenue_splits` |
| Messaging | `conversations`, `conversation_participants`, `messages`, `message_reactions`, `dm_access_grants` |
| Notifications | `notifications`, `push_tokens` |
| Events | `events`, `appointments` |
| Growth | `referral_events` |
| Auth | `refresh_tokens` |

**Migrations**: TypeORM `synchronize` is on in development (entity changes auto-applied). In production (`NODE_ENV=production`), synchronize is off — run `schema.sql` against the database for initial setup, then manage changes manually.

---

## API Modules

| Module | Base Path | Description |
|---|---|---|
| Auth | `/api/auth` | Signup, login, JWT refresh, bcrypt |
| Profiles | `/api/profiles` | User profiles, follow/unfollow, blocks |
| Posts | `/api/posts` | CRUD, likes, threaded comments, reposts, saves, hashtags |
| Feed | `/api/feed` | Algorithmic feed, trending posts, trending hashtags |
| Products | `/api/products` | Product listings, reviews |
| Orders | `/api/orders` | Order lifecycle |
| Commerce | `/api/commerce` | Cart, wishlist, promo codes |
| Payments | `/api/payments` | Stripe payment intents, coupon validation, creator payouts |
| Messaging | `/api/messaging` | Conversations, messages, reactions |
| Notifications | `/api/notifications` | Push token registration, notification list |
| Events | `/api/events` | Event listings |
| Stories | `/api/stories` | Story creation and retrieval |
| Storage | `/api/storage` | S3 presigned upload URLs (clients upload directly) |
| Analytics | `/api/analytics` | Engagement and view tracking |
| Reports | `/api/reports` | User and content reports |
| Revenue Splits | `/api/revenue-splits` | Per-product creator revenue split config |
| Health | `/api/health` | Server health check (public) |

All routes are protected by a global JWT guard. Routes opt out with the `@Public()` decorator (used on `POST /auth/login`, `POST /auth/signup`, `POST /payments/validate-coupon`, and `/api/health`).

---

## Key Features

- **Feed** — Algorithmic + following feed; NestJS endpoints replace all former Supabase RPCs (migrated June 2026)
- **Social** — Posts, stories (24h ephemeral), comments, likes, reposts, follows, blocks, hashtags, polls, scheduled posts, geo-tagged posts
- **Marketplace** — Product listings, reviews, cart, wishlist, promo codes; NestJS endpoints replace all former Supabase RPCs (migrated June 2026)
- **Orders** — Full lifecycle: create → pay (Stripe) → ship → confirm delivery → escrow release (7-day hold)
- **Payments** — Stripe payment intents, coupon validation, Stripe Connect for creator payouts, revenue splits
- **Messaging** — DMs, group conversations, reactions, gated DM access grants
- **Notifications** — Push token registration, Expo push dispatch
- **Events** — Creator-hosted events and fan appointments
- **Storage** — Presigned S3 URLs; clients upload directly (no server relay)
- **Background Jobs** — Scheduled tasks via `@nestjs/schedule`

---

## Migration Notes (June 2026)

Hubble is fully migrated from Supabase to a self-hosted NestJS + Postgres stack:

- Zero Supabase runtime calls in the frontend. `feed.tsx` and `marketplace.tsx` previously called Supabase RPCs directly — all calls now go to NestJS endpoints under `/api/feed` and `/api/products`.
- `@supabase/supabase-js` remains in `package.json` but is not invoked at runtime. `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are no longer required.
- All auth, data access, file storage, and background jobs run through NestJS + Railway Postgres.
- Previous Supabase schema SQL and RPC function definitions are preserved in `server/nestjs/src/common/database/` for reference.

---

## Local Development Tips

- Use [TablePlus](https://tableplus.com) or `psql` to inspect the database.
- Redis: `redis-server` locally or `docker run -p 6379:6379 redis`. Skip entirely to run without caching.
- For S3 locally, use [LocalStack](https://localstack.cloud) or point to a real bucket.
- Physical device testing: set `EXPO_PUBLIC_API_URL` to your machine's LAN IP, not `localhost`.
