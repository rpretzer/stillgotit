# Printful Automated Product Sync - Setup Guide

## Overview

The merch backend now includes **automated Printful product syncing** that:
- ✅ Syncs products from Printful API nightly (2 AM UTC)
- ✅ Stores products in D1 database
- ✅ Serves products from D1 (with fallback to static JSON)
- ✅ Can be manually triggered via API endpoint
- ✅ Automatically maps Printful variant IDs for fulfillment

## Quick Setup

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

Or manually:
```bash
npx wrangler deploy
```

### 3. Trigger Initial Sync

**Option A: Without authentication** (if `SYNC_SECRET_TOKEN` is not set):
```bash
curl -X POST https://sgic-merch-api.rpretzer.workers.dev/api/sync/products
```

**Option B: With authentication** (if `SYNC_SECRET_TOKEN` is set):
```bash
curl -X POST https://sgic-merch-api.rpretzer.workers.dev/api/sync/products \
  -H "Authorization: Bearer YOUR_SYNC_SECRET_TOKEN"
```

### 4. Verify Sync

Check that products are synced:
```bash
curl https://sgic-merch-api.rpretzer.workers.dev/api/products
```

Should return products with `printfulVariantId` values populated.

## How It Works

### Product Catalog Priority

1. **D1 Database** (synced from Printful) - Primary source
   - Products are fetched from Printful API
   - Stored in D1 `products` table
   - Automatically includes `printfulVariantId` mappings

2. **Static JSON** (`content/merch.json`) - Fallback
   - Used if D1 products table is empty
   - Manual override option
   - Good for testing or manual product definitions

### Sync Process

1. **Fetches** all store products from Printful API
2. **Fetches** details for each product (including variants)
3. **Upserts** each variant as a product row in D1
4. **Maps** Printful variant IDs automatically
5. **Groups** variants by product for catalog display

### Cron Schedule

- **Frequency**: Daily at 2 AM UTC
- **Trigger**: Cloudflare Cron Trigger (`0 2 * * *`)
- **Action**: Calls `syncPrintfulProducts()` function
- **Logs**: Available in Cloudflare Dashboard → Workers → Logs

## API Endpoints

### `POST /api/sync/products`

Manually trigger product sync.

**Authentication** (optional):
- If `SYNC_SECRET_TOKEN` is set in Worker secrets, requires:
  ```
  Authorization: Bearer YOUR_SYNC_SECRET_TOKEN
  ```
- If not set, endpoint is publicly accessible (not recommended for production)

**Response**:
```json
{
  "success": true,
  "synced": 12,
  "errors": [],
  "timestamp": "2025-01-15T02:00:00.000Z"
}
```

### `GET /api/products`

Returns product catalog (from D1 or static JSON fallback).

**Response**:
```json
{
  "currency": "USD",
  "products": [
    {
      "id": "pf-12345",
      "name": "Still Got It Tee",
      "variants": [
        {
          "id": "pf-12345-67890",
          "label": "Small",
          "printfulVariantId": 67890
        }
      ],
      "fulfillment": {
        "type": "printful"
      }
    }
  ]
}
```

## Configuration

### Worker Secrets

Required:
- `PRINTFUL_TOKEN` - Your Printful OAuth token

Optional:
- `SYNC_SECRET_TOKEN` - Secret token for securing sync endpoint

### Cron Trigger

Configured in `wrangler.toml`:
```toml
[triggers]
crons = ["0 2 * * *"]
```

To change schedule, update the cron expression:
- `0 2 * * *` - Daily at 2 AM UTC
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday at midnight

## Monitoring

### Check Sync Status

1. **Cloudflare Dashboard**:
   - Workers → `sgic-merch-api` → Logs
   - Look for `[Cron] Product sync completed` messages

2. **Database**:
   ```bash
   npx wrangler d1 execute sgic-merch --remote --command "SELECT COUNT(*) as count, MAX(last_synced_at) as last_sync FROM products"
   ```

3. **API**:
   ```bash
   curl https://sgic-merch-api.rpretzer.workers.dev/api/products | jq '.products | length'
   ```

### Troubleshooting

**No products syncing:**
- Check `PRINTFUL_TOKEN` is set correctly
- Verify Printful API access
- Check Worker logs for errors

**Products not appearing:**
- Verify products table is initialized
- Check that sync completed (check logs)
- Verify products are active in Printful store

**Sync errors:**
- Check Worker logs for specific error messages
- Verify Printful API rate limits
- Check network connectivity

## Manual Override

If you need to use static JSON instead of synced products:

1. Clear products table (optional):
   ```bash
   npx wrangler d1 execute sgic-merch --remote --command "DELETE FROM products"
   ```

2. Worker will automatically fall back to `content/merch.json`

## Next Steps

1. ✅ Initialize products table
2. ✅ Deploy updated Worker
3. ✅ Trigger initial sync
4. ✅ Verify products appear in catalog
5. ✅ Test checkout flow with synced products
6. ✅ Monitor nightly sync in Cloudflare Dashboard

## Benefits

- ✅ **Automated**: No manual mapping needed
- ✅ **Always Up-to-Date**: Nightly sync ensures latest products
- ✅ **Reliable**: Automatic variant ID mapping
- ✅ **Flexible**: Fallback to static JSON if needed
- ✅ **Scalable**: Handles unlimited products/variants



