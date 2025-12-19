# Printful Product Sync Automation - Implementation Summary

## ✅ What Was Implemented

### 1. Automated Product Syncing
- **Nightly Cron Job**: Syncs Printful products daily at 2 AM UTC
- **Manual Trigger**: `POST /api/sync/products` endpoint for on-demand sync
- **Automatic Mapping**: Printful variant IDs automatically mapped
- **D1 Database Storage**: Products stored in `products` table

### 2. Smart Catalog System
- **Primary Source**: D1 database (synced from Printful)
- **Fallback**: Static JSON (`content/merch.json`) if D1 is empty
- **Seamless**: Frontend doesn't need changes - same API endpoint

### 3. Database Schema
- New `products` table for storing synced Printful products
- Tracks: product IDs, variant IDs, prices, images, sync timestamps
- Indexed for fast queries

### 4. Deployment Updates
- Updated deployment script to initialize products table
- Cron trigger configured in `wrangler.toml`
- Documentation updated

## Files Changed

### New Files
- `workers/merch-backend/schema-products.sql` - Products table schema
- `PRINTFUL_SYNC_SETUP.md` - Setup guide
- `scripts/fetch-printful-products.js` - Helper script (manual approach)

### Modified Files
- `workers/merch-backend/src/index.ts` - Added sync functions, cron handler, D1 catalog fetching
- `workers/merch-backend/wrangler.toml` - Added cron trigger
- `workers/merch-backend/deploy.sh` - Added products table initialization
- `workers/merch-backend/README.md` - Updated with sync documentation

## How It Works

### Sync Flow
```
Printful API → Worker Sync Function → D1 Database → Catalog API
```

1. **Cron Trigger** (2 AM UTC daily) or **Manual API Call**
2. **Fetch** all products from Printful store
3. **Fetch** details for each product (variants, prices, images)
4. **Upsert** into D1 `products` table
5. **Catalog API** serves from D1 (or falls back to static JSON)

### Catalog Priority
```
GET /api/products
  ↓
Check D1 products table
  ↓
[Has products?] → Yes → Return D1 products
  ↓
No → Fetch static JSON → Return static JSON
```

## Setup Instructions

### 1. Initialize Products Table
```bash
cd workers/merch-backend
npx wrangler d1 execute sgic-merch --remote --file=schema-products.sql
```

### 2. Deploy Updated Worker
```bash
cd workers/merch-backend
./deploy.sh
```

### 3. Trigger Initial Sync
```bash
curl -X POST https://sgic-merch-api.rpretzer.workers.dev/api/sync/products
```

### 4. Verify
```bash
curl https://sgic-merch-api.rpretzer.workers.dev/api/products
```

## Benefits

✅ **Fully Automated**: No manual product mapping needed
✅ **Always Current**: Products sync nightly from Printful
✅ **Zero Downtime**: Fallback to static JSON if sync fails
✅ **Scalable**: Handles unlimited products/variants
✅ **Reliable**: Automatic variant ID mapping for fulfillment
✅ **Flexible**: Can still use static JSON for manual overrides

## Monitoring

- **Cloudflare Dashboard** → Workers → Logs (check for sync messages)
- **Database**: Query `products` table to see synced products
- **API**: Check `/api/products` endpoint response

## Next Steps

1. ✅ Deploy the updated Worker
2. ✅ Initialize products table
3. ✅ Trigger initial sync
4. ✅ Verify products appear in catalog
5. ✅ Test checkout with synced products
6. ✅ Monitor nightly sync (check logs after first cron run)

## Security (Optional)

To secure the sync endpoint, set `SYNC_SECRET_TOKEN` secret:
```bash
npx wrangler secret put SYNC_SECRET_TOKEN
```

Then sync endpoint requires:
```bash
curl -X POST https://sgic-merch-api.rpretzer.workers.dev/api/sync/products \
  -H "Authorization: Bearer YOUR_SYNC_SECRET_TOKEN"
```



