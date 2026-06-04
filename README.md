# Hubble

A social commerce mobile app built with React Native (Expo) and a NestJS backend.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile Frontend | React Native 0.81.5, Expo 54, TypeScript |
| State Management | Zustand + TanStack Query |
| Backend API | NestJS 10, TypeScript |
| Database | PostgreSQL (36 tables) |
| Cache | Redis (via ioredis / Keyv) |
| File Storage | AWS S3 |
| Payments | Stripe |
| Deployment | Railway (backend), EAS (frontend builds) |

---

## Repository Structure

```
hubble/
├── app/                    # Expo Router screens (file-based routing)
│   ├── (tabs)/             # Main tab screens: feed, marketplace, create, profile
│   ├── (auth)/             # Login, signup, onboarding
│   └── ...                 # Detail screens (product, creator, post, etc.)
├── components/             # Shared React Native components
├── context/                # Legacy (all migrated to Zustand/TanStack Query)
├── hooks/                  # TanStack Query hooks (useCartQuery, useProfileMutations, etc.)
├── lib/                    # Shared utilities: api.ts (HTTP client), supabase.ts (auth only)
├── stores/                 # Zustand stores (community, messaging)
├── server/
│   └── nestjs/             # NestJS backend
│       ├── src/
│       │   ├── auth/
│       │   ├── feed/
│       │   ├── posts/
│       │   ├── profiles/
│       │   ├── products/
│       │   ├── orders/
│       │   ├── commerce/
│       │   ├── payments/
│       │   ├── messaging/
│       │   ├── notifications/
│       │   ├── events/
│       │   ├── stories/
│       │   ├── analytics/
│       │   ├── reports/
│       │   ├── revenue-splits/
│       │   ├── storage/
│       │   ├── cron/
│       │   └── common/     # database + redis modules
│       ├── railway.json
│       └── package.json
└── README.md
```

---

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 15+
- Redis 7+
- AWS S3 bucket
- Stripe account
- Expo CLI (`npm install -g expo-cli`)

---

## Frontend Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create a `.env` file at the repo root:

```env
EXPO_PUBLIC_API_URL=http://<your-machine-ip>:4243
```

> For local dev against a local NestJS server, use your machine's LAN IP (not `localhost` — the simulator/device can't reach it).  
> For production or staging, use the Railway URL: `https://hubble-production-6215.up.railway.app`

### 3. Run the dev build

```bash
npx expo start
```

Then press `i` for iOS simulator or `a` for Android emulator, or scan the QR code with the Expo Go app.

---

## Backend Setup

### 1. Install dependencies

```bash
cd server/nestjs
npm install
```

### 2. Environment variables

Create a `.env` file inside `server/nestjs/`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hubble

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRATION=7d

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_bucket_name

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App
PORT=4243
NODE_ENV=development
```

### 3. Run locally

```bash
npm run start:dev
```

The API will be available at `http://localhost:4243/api`.

### 4. Health check

```
GET /api/health
→ { "status": "ok" }
```

---

## Railway Deployment (Backend)

The backend is deployed on Railway. Configuration is in `server/nestjs/railway.json`.

### Railway service settings

| Setting | Value |
|---|---|
| Root Directory | `server/nestjs` |
| Build Command | `npm run build` |
| Start Command | `node dist/main` |
| Health Check | `/api/health` |

### Required Railway environment variables

Set all variables from the `.env` section above in Railway → Service → Variables. The `PORT` variable is set automatically by Railway — do not override it.

### Deploying

Railway auto-deploys on every push to `main`. To manually trigger a deploy, push any commit or use the Railway dashboard.

---

## Database

PostgreSQL with 36 tables across 6 domains:

- **Users & Profiles** — users, profiles, follows, blocks, saved posts/products, tags
- **Content** — posts, post media, hashtags, post hashtags, likes, comments, watches, stories
- **Commerce** — products, product media, cart, cart items, wishlist, wishlists items, orders, order items, revenue splits
- **Community** — communities, community members, community posts
- **Messaging** — conversations, messages
- **Platform** — notifications, reports, events, analytics events, referrals, wallets, transactions, engagement events

The schema is defined in `server/nestjs/schema.sql`.

---

## API Modules

| Module | Base Path | Description |
|---|---|---|
| Auth | `/api/auth` | Signup, login, JWT refresh |
| Profiles | `/api/profiles` | User profiles, follow/unfollow, saved content |
| Posts | `/api/posts` | Create, read, update, delete posts; comments; likes |
| Feed | `/api/feed` | Algorithmic feed, trending posts, trending hashtags |
| Products | `/api/products` | Product listings, create/update/delete |
| Orders | `/api/orders` | Order management |
| Commerce | `/api/commerce` | Cart, wishlist |
| Payments | `/api/payments` | Stripe checkout, webhooks |
| Messaging | `/api/messaging` | Conversations, messages |
| Notifications | `/api/notifications` | Notification list, unread count |
| Events | `/api/events` | Event listings |
| Stories | `/api/stories` | Stories |
| Storage | `/api/storage` | S3 presigned upload URLs |
| Analytics | `/api/analytics` | Engagement events |
| Reports | `/api/reports` | User/content reports |
| Revenue Splits | `/api/revenue-splits` | Creator revenue splits |
| Health | `/api/health` | Server health check |

---

## Key Features

- **Algorithmic Feed** — 13-signal ranking (recency, follows, velocity, depth, watch time, geo, purchase history, reputation, sponsored)
- **Social** — posts, stories, comments, likes, follows, blocks, hashtags
- **Commerce** — product listings, cart, wishlist, Stripe checkout, orders, revenue splits
- **Messaging** — direct conversations
- **Creator Tools** — analytics, revenue splits, product management
- **Events** — event listings and discovery
- **Notifications** — real-time unread count (3s polling)

---

## Migration Notes

As of June 2026, Hubble is fully migrated from Supabase to NestJS + Postgres.

- Zero Supabase runtime calls in the frontend
- All Supabase RPCs (feed ranking, trending, geo, engagement) replaced with NestJS endpoints
- Supabase is no longer used for auth, storage, or data access
- All context providers removed — state managed via Zustand + TanStack Query

---

## Local Development Tips

- Use [TablePlus](https://tableplus.com) or psql to inspect the database
- Redis can be run locally with `redis-server` or via Docker: `docker run -p 6379:6379 redis`
- For S3, use [LocalStack](https://localstack.cloud) or point to a real bucket during development
- Rate limiting is set to 60 requests/minute per IP in production
