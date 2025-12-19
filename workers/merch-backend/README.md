# Merch Backend Worker (Stripe + Printful)

Cloudflare Worker for handling Stripe payments and Printful fulfillment for The Still Got It Collective merch store.

## Setup

### 1. Create D1 Database

In Cloudflare Dashboard:
- Go to **Workers & Pages** → **D1**
- Click **Create Database**
- Name it `sgic-merch`
- Copy the **Database ID** (you'll need it for `wrangler.toml`)

### 2. Update `wrangler.toml`

Replace `YOUR_D1_DATABASE_ID` in `wrangler.toml` with your actual D1 database ID.

### 3. Authenticate with Cloudflare

```bash
cd workers/merch-backend
npx wrangler login
# This will open a browser to authenticate
```

### 4. Initialize Database Schema

**Option A: Use the deployment script (recommended)**
```bash
./deploy.sh
```

**Option B: Manual commands**
```bash
npm run db:init
# Then initialize abandoned carts table:
npx wrangler d1 execute sgic-merch --remote --file=schema-abandoned-carts.sql
```

### 5. Set Secrets

Via Cloudflare Dashboard (recommended):
- Go to your Worker → **Settings** → **Variables**
- Add:
  - `STRIPE_SECRET_KEY` (your live Stripe secret key)
  - `STRIPE_WEBHOOK_SECRET` (from Stripe webhook endpoint)
  - `PRINTFUL_TOKEN` (your Printful OAuth token)

Or via CLI:
```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put PRINTFUL_TOKEN
```

### 6. Deploy

**Option A: Use the deployment script (does both DB init + deploy)**
```bash
./deploy.sh
```

**Option B: Manual deploy**
```bash
npm run deploy
```

## API Routes

- `POST /api/checkout` - Create Stripe PaymentIntent and order
- `POST /api/stripe/webhook` - Handle Stripe webhooks (payment_intent.succeeded)
- `GET /api/products` - Serve product catalog (from D1 or static JSON fallback)
- `GET /api/orders/:id` - Get order status and timeline
- `POST /api/carts/abandoned` - Save abandoned cart (returns recovery token)
- `GET /api/carts/recover/:token` - Get cart by recovery token
- `POST /api/carts/recover/:token` - Mark cart as recovered
- `POST /api/sync/products` - Manually trigger Printful product sync (optional: requires `SYNC_SECRET_TOKEN` if set)

## Automated Product Syncing

The Worker automatically syncs products from Printful:

1. **Nightly Sync**: Runs daily at 2 AM UTC via Cloudflare Cron Trigger
2. **Manual Sync**: Trigger via `POST /api/sync/products`
3. **Fallback**: If D1 products table is empty, falls back to static `content/merch.json`

### Setup Automated Syncing

1. **Initialize Products Table**:
   ```bash
   npx wrangler d1 execute sgic-merch --remote --file=schema-products.sql
   ```

2. **Trigger Initial Sync** (optional):
   ```bash
   curl -X POST https://sgic-merch-api.rpretzer.workers.dev/api/sync/products \
     -H "Authorization: Bearer YOUR_SYNC_TOKEN"  # Only if SYNC_SECRET_TOKEN is set
   ```

3. **Verify Sync**:
   - Check Worker logs in Cloudflare Dashboard
   - Products should appear in D1 database
   - `GET /api/products` should return synced products

### Product Catalog Priority

1. **D1 Database** (synced from Printful) - Primary source
2. **Static JSON** (`content/merch.json`) - Fallback if D1 is empty

This ensures:
- New Printful products automatically appear after nightly sync
- Manual sync available for immediate updates
- Graceful fallback if sync fails

## Stripe Webhook Setup

1. In Stripe Dashboard → **Developers** → **Webhooks**
2. Add endpoint: `https://sgic-merch-api.rpretzer.workers.dev/api/stripe/webhook`
3. Select events: `payment_intent.succeeded`
4. Copy the **Signing secret** → set as `STRIPE_WEBHOOK_SECRET` in Worker

## Product Catalog

The Worker fetches products from `MERCH_CATALOG_URL` (default: `https://www.stillgotitcollective.com/content/merch.json`).

Products should include:
- `id`, `name`, `description`, `priceCents`, `image`
- `variants[]` with `id`, `label`, and optionally `printfulVariantId`
- `fulfillment.type` (`"printful"` or `"manual"`)
- `fulfillment.printfulVariantId` (for Printful products)

## Order Flow

1. Customer adds items to cart → `POST /api/checkout` with cart + shipping details
2. Worker creates Stripe PaymentIntent and order in D1 → returns `clientSecret` + `orderId`
3. Frontend confirms payment with Stripe Elements
4. Stripe webhook fires → Worker marks order PAID → creates Printful order
5. Customer can check status via `GET /api/orders/:id`

## Abandoned Cart Tracking

The system automatically tracks abandoned carts when users add items but don't complete checkout:

1. **Automatic Tracking**: When items are added to cart, the frontend saves the cart to the backend after a 2-second delay
2. **Recovery Token**: Each abandoned cart gets a unique recovery token
3. **Recovery URL**: Users can recover their cart via `/merch/recover.html?token=...`
4. **Email Integration** (optional): You can send recovery emails with the token link

To use abandoned carts:
1. Initialize the schema: `npx wrangler d1 execute sgic-merch --remote --file=schema-abandoned-carts.sql`
2. Carts are automatically tracked when users add items
3. Recovery links: `https://your-site.com/merch/recover.html?token=RECOVERY_TOKEN`

## Local Development

```bash
npm install
wrangler dev
```

Note: You'll need to set up local D1 or use remote D1 for testing.
