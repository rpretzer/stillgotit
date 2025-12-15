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
    echo "✅ Database schema initialized successfully"
else
    echo "❌ Failed to initialize database schema"
    exit 1
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
    echo "   2. Test the API endpoints:"
    echo "      - GET https://sgic-merch-api.rpretzer.workers.dev/api/products"
    echo "   3. Verify Stripe webhook is configured:"
    echo "      - URL: https://sgic-merch-api.rpretzer.workers.dev/api/stripe/webhook"
else
    echo "❌ Deployment failed"
    exit 1
fi

