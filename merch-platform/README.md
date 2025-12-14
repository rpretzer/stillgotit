## Merch Platform (Stripe + Printful) — Production-ready MVP

This folder contains a standalone merch platform that matches the **fixed stack**:

- **Merch purchases**: Custom storefront → **Stripe** payments → backend creates **Printful** order after payment success
- **Tickets**: TicketsCandy + Square (no integration needed)
- **IRL sales**: Square POS (no custom code needed)

### Architecture (text diagram)

```
Customer Browser (Next.js Web)
  ├─ GET /api/products  ───────────────────────────────┐
  │                                                    │
  ├─ POST /api/checkout (cart + shipping) ───────────┐ │
  │        │                                         │ │
  │        └─(API) create Order(PENDING) + Stripe PI  │ │
  │                 -> return client_secret + orderId │ │
  │                                                    │
  ├─ Stripe Elements confirmCardPayment(client_secret) │
  │        │                                           │
  │        └─ redirect to /orders/:id                   │
  │
  └─ GET /api/orders/:id  (poll status timeline) ──────┘

Stripe
  └─ webhook payment_intent.succeeded  →  API /api/stripe/webhook
        ├─ verify signature (raw body)
        ├─ idempotent transition: Order -> PAID
        ├─ create Printful order
        └─ update Order: printfulOrderId + status timeline

Printful
  ├─ API: create order
  └─ (optional) webhook OR polling cron
        └─ update statuses: FULFILLING → SHIPPED/DELIVERED/FAILED
             ├─ if FAILED post-creation: refund Stripe + email customer
             └─ admin dashboard: retry fulfillment / manual review
```

### Directory structure

```
merch-platform/
  apps/
    api/                # Node/TS Express + Prisma + Stripe + Printful orchestration
    web/                # Next.js storefront (catalog/cart/checkout/orders/admin)
  packages/
    shared/             # shared types (optional, minimal)
  docker-compose.yml    # Postgres for local dev
  .env.example          # env vars for both apps
```

### Local development

1) Start Postgres:

```bash
cd merch-platform
docker compose up -d
```

2) Configure env:

```bash
cp env.example .env
```

3) Install deps:

```bash
npm install
```

4) Prisma migrate + seed:

```bash
npm run db:migrate
npm run db:seed
```

5) Run API + Web:

```bash
npm run dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:4000`

### Deployment notes (recommended)

- **Frontend**: Vercel (Next.js)
- **Backend**: Render (Docker or Node service) + managed Postgres

See `MANUAL STEPS` at the end of this file once the implementation is complete.


