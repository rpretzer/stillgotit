#!/bin/bash
# Deployment script for Merch Backend Worker
# Run this after authenticating with `wrangler login`

set -e

echo "🚀 Deploying Merch Backend Worker..."

# Check if wrangler is available
if ! command -v wrangler &> /dev/null && ! command -v npx &> /dev/null; then
    echo "❌ Error: wrangler not found. Run 'npm install' first."
    exit 1
fi

WRANGLER_CMD="npx wrangler"

# Step 1: Initialize D1 database schema (remote)
echo ""
echo "📦 Step 1: Initializing D1 database schema..."
$WRANGLER_CMD d1 execute sgic-merch --remote --file=schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Orders schema initialized successfully"
else
    echo "❌ Failed to initialize orders schema"
    exit 1
fi

# Step 1b: Initialize products table (for Printful sync)
echo ""
echo "📦 Step 1b: Initializing products table..."
if [ -f "schema-products.sql" ]; then
    $WRANGLER_CMD d1 execute sgic-merch --remote --file=schema-products.sql
    
    if [ $? -eq 0 ]; then
        echo "✅ Products schema initialized successfully"
    else
        echo "⚠️  Warning: Failed to initialize products schema (may already exist)"
    fi
else
    echo "⚠️  Warning: schema-products.sql not found, skipping products table init"
fi

# Step 2: Deploy Worker
echo ""
echo "🚀 Step 2: Deploying Worker..."
$WRANGLER_CMD deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Verify secrets are set in Cloudflare Dashboard:"
    echo "      - STRIPE_SECRET_KEY"
    echo "      - STRIPE_WEBHOOK_SECRET"
    echo "      - PRINTFUL_TOKEN"
    echo "      - SYNC_SECRET_TOKEN (optional, for securing sync endpoint)"
    echo "   2. Initialize products table and trigger initial sync:"
    echo "      - npx wrangler d1 execute sgic-merch --remote --file=schema-products.sql"
    echo "      - curl -X POST https://sgic-merch-api.rpretzer.workers.dev/api/sync/products"
    echo "   3. Test the API endpoints:"
    echo "      - GET https://sgic-merch-api.rpretzer.workers.dev/api/products"
    echo "   4. Verify Stripe webhook is configured:"
    echo "      - URL: https://sgic-merch-api.rpretzer.workers.dev/api/stripe/webhook"
    echo "   5. Verify cron trigger is active:"
    echo "      - Check Cloudflare Dashboard → Workers → Triggers → Cron Triggers"
    echo "      - Should show: 0 2 * * * (daily at 2 AM UTC)"
else
    echo "❌ Deployment failed"
    exit 1
fi

