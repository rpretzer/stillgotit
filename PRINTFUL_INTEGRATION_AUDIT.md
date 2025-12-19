# Printful Integration Audit & Next Steps

## Current State

### ✅ What's Working

1. **Cloudflare Worker Backend** (`workers/merch-backend/`)
   - ✅ Stripe checkout integration (`POST /api/checkout`)
   - ✅ Stripe webhook handler (`POST /api/stripe/webhook`)
   - ✅ Printful order creation logic (`createPrintfulOrder()`)
   - ✅ Product catalog fetching from `content/merch.json`
   - ✅ Order status tracking (`GET /api/orders/:id`)
   - ✅ D1 database schema initialized
   - ✅ Abandoned cart tracking

2. **Frontend Integration** (`assets/js/merch.js`)
   - ✅ Cart management
   - ✅ Stripe Elements integration
   - ✅ Checkout flow
   - ✅ Order status polling

3. **Catalog Structure** (`content/merch.json`)
   - ✅ Product definitions with variants
   - ✅ Fulfillment type configuration
   - ⚠️ **MISSING: Printful variant IDs**

### ❌ What's Missing

1. **Printful Variant ID Mapping**
   - Products in `content/merch.json` have `fulfillment.type: "printful"` but no `printfulVariantId` values
   - Variants don't have `printfulVariantId` in their objects
   - Without these IDs, orders will fail at fulfillment stage

2. **Printful API Token Verification**
   - Need to verify `PRINTFUL_TOKEN` is set in Cloudflare Worker secrets
   - Need to test Printful API connectivity

3. **Product Sync Tool**
   - The `merch-platform` folder has a sync endpoint (`POST /admin/sync-products`) but it's for a different backend (Node.js/Prisma)
   - Need a way to map Printful products to the static catalog

## Architecture Overview

```
Customer → Frontend (merch/index.html)
    ↓
POST /api/checkout → Cloudflare Worker
    ↓
Creates Stripe PaymentIntent + Order in D1
    ↓
Customer pays via Stripe Elements
    ↓
Stripe Webhook → Worker marks order PAID
    ↓
Worker creates Printful order (requires printfulVariantId)
    ↓
Printful fulfills order
```

## ✅ Automated Sync Solution (NEW)

**Good news!** Automated Printful product syncing has been implemented:

- ✅ **Nightly Sync**: Automatically syncs products daily at 2 AM UTC
- ✅ **Manual Trigger**: `POST /api/sync/products` endpoint for immediate sync
- ✅ **Auto-Mapping**: Automatically maps Printful variant IDs
- ✅ **D1 Storage**: Products stored in D1 database
- ✅ **Fallback**: Falls back to static JSON if D1 is empty

See `PRINTFUL_SYNC_SETUP.md` for setup instructions.

---

## Next Steps (If Using Manual Approach)

### Step 1: Get Printful Store Product & Variant IDs

**Option A: Manual (Recommended for initial setup)**
1. Log into Printful Dashboard: https://www.printful.com/dashboard
2. Navigate to **Store** → **Products**
3. For each product you want to sell:
   - Click on the product
   - Note the **Product ID** (sync_product.id)
   - For each size/variant, note the **Variant ID** (sync_variant_id)
   - Example: "Still Got It Tee" might have:
     - Small: Variant ID `12345`
     - Medium: Variant ID `12346`
     - Large: Variant ID `12347`
     - XL: Variant ID `12348`

**Option B: API Script (Automated)**
Create a temporary script to fetch Printful products and output the mapping:

```bash
# Create a script to list Printful products
# This would use the PRINTFUL_TOKEN to call:
# GET https://api.printful.com/store/products
# GET https://api.printful.com/store/products/{id}
```

### Step 2: Update Catalog with Printful Variant IDs

Update `content/merch.json` to include `printfulVariantId` for each variant:

```json
{
  "id": "tee-classic",
  "name": "Still Got It Tee (Classic)",
  "variants": [
    { "id": "tee-classic-s", "label": "Small", "printfulVariantId": 12345 },
    { "id": "tee-classic-m", "label": "Medium", "printfulVariantId": 12346 },
    { "id": "tee-classic-l", "label": "Large", "printfulVariantId": 12347 },
    { "id": "tee-classic-xl", "label": "XL", "printfulVariantId": 12348 }
  ],
  "fulfillment": {
    "type": "printful"
  }
}
```

**OR** use the product-level mapping if all variants share the same Printful product:

```json
{
  "id": "tee-classic",
  "fulfillment": {
    "type": "printful",
    "printfulVariantId": 12345  // Fallback if variant doesn't have one
  }
}
```

The Worker code checks both:
- `variant.printfulVariantId` (preferred)
- `product.fulfillment.printfulVariantId` (fallback)

### Step 3: Verify Cloudflare Worker Secrets

Check that all required secrets are set:

```bash
cd workers/merch-backend
npx wrangler secret list
```

Required secrets:
- ✅ `STRIPE_SECRET_KEY`
- ✅ `STRIPE_WEBHOOK_SECRET`
- ⚠️ `PRINTFUL_TOKEN` (verify this is set)

If missing, set it:
```bash
npx wrangler secret put PRINTFUL_TOKEN
# Paste your Printful OAuth token
```

### Step 4: Test Printful API Connection

Create a test script or use curl to verify the token works:

```bash
curl -X GET "https://api.printful.com/store/products" \
  -H "Authorization: Bearer YOUR_PRINTFUL_TOKEN"
```

Should return a list of your Printful store products.

### Step 5: Test End-to-End Flow

1. **Test Checkout** (without payment):
   - Add product to cart
   - Go to checkout
   - Verify catalog loads correctly
   - Verify variant IDs are present

2. **Test with Test Payment**:
   - Use Stripe test card: `4242 4242 4242 4242`
   - Complete checkout
   - Verify webhook fires
   - Check D1 database: order should be marked PAID
   - Check D1 database: `printful_order_id` should be populated
   - Check Printful dashboard: order should appear

3. **Monitor for Errors**:
   - Check Worker logs in Cloudflare Dashboard
   - Check for `MANUAL_REVIEW` status (indicates Printful failure)
   - Check `last_error` field in orders table

### Step 6: Handle Edge Cases

The Worker already handles:
- ✅ Missing Printful variant → Sets order to `MANUAL_REVIEW`
- ✅ Duplicate webhooks → Idempotency check
- ✅ Printful API errors → Catches and logs

**What to watch for:**
- Orders stuck in `MANUAL_REVIEW` → Check `manual_review_reason` field
- Orders with `printful_order_id = null` after payment → Check Worker logs

## Files to Update

1. **`content/merch.json`** - Add `printfulVariantId` to variants
2. **Cloudflare Worker Secrets** - Verify `PRINTFUL_TOKEN` is set
3. **Test & Verify** - Run through checkout flow

## Reference: Worker Code Logic

The Worker looks for Printful variant IDs in this order:
1. `variant.printfulVariantId` (in variants array)
2. `product.fulfillment.printfulVariantId` (product-level fallback)

If neither exists, the order will be marked `MANUAL_REVIEW` with error:
```
"Missing Printful mapping for product {productId}"
```

## Quick Start Checklist

- [ ] Get Printful variant IDs from Printful Dashboard
- [ ] Update `content/merch.json` with `printfulVariantId` values
- [ ] Verify `PRINTFUL_TOKEN` secret is set in Cloudflare Worker
- [ ] Test Printful API connection
- [ ] Test checkout with test card
- [ ] Verify order appears in Printful dashboard
- [ ] Monitor first few real orders for issues

## Support Resources

- **Printful API Docs**: https://developers.printful.com/
- **Printful Dashboard**: https://www.printful.com/dashboard
- **Cloudflare Worker Logs**: Cloudflare Dashboard → Workers → sgic-merch-api → Logs
- **Stripe Webhook Logs**: Stripe Dashboard → Developers → Webhooks

