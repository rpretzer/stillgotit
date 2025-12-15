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

### 3. Initialize Database Schema

```bash
cd workers/merch-backend
wrangler d1 execute sgic-merch --file=schema.sql
```

### 4. Set Secrets

Via Cloudflare Dashboard (recommended):
- Go to your Worker → **Settings** → **Variables**
- Add:
  - `STRIPE_SECRET_KEY` (your live Stripe secret key)
  - `STRIPE_WEBHOOK_SECRET` (from Stripe webhook endpoint)
  - `PRINTFUL_TOKEN` (your Printful OAuth token)

Or via CLI:
```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put PRINTFUL_TOKEN
```

### 5. Deploy

```bash
npm install
wrangler deploy
```

## API Routes

- `POST /api/checkout` - Create Stripe PaymentIntent and order
- `POST /api/stripe/webhook` - Handle Stripe webhooks (payment_intent.succeeded)
- `GET /api/products` - Serve product catalog
- `GET /api/orders/:id` - Get order status and timeline

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

## Local Development

```bash
npm install
wrangler dev
```

Note: You'll need to set up local D1 or use remote D1 for testing.
