#!/usr/bin/env node
/**
 * Helper script to fetch Printful store products and display variant IDs
 * 
 * Usage:
 *   PRINTFUL_TOKEN=your_token node scripts/fetch-printful-products.js
 * 
 * This will output a JSON structure showing:
 * - Product names
 * - Variant IDs for each size/option
 * - Ready to copy into content/merch.json
 */

const PRINTFUL_TOKEN = process.env.PRINTFUL_TOKEN;

if (!PRINTFUL_TOKEN) {
  console.error('❌ Error: PRINTFUL_TOKEN environment variable not set');
  console.error('Usage: PRINTFUL_TOKEN=your_token node scripts/fetch-printful-products.js');
  process.exit(1);
}

async function fetchPrintfulProducts() {
  try {
    console.log('🔍 Fetching Printful store products...\n');

    // List store products
    const listRes = await fetch('https://api.printful.com/store/products', {
      headers: {
        'Authorization': `Bearer ${PRINTFUL_TOKEN}`
      }
    });

    if (!listRes.ok) {
      const error = await listRes.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to fetch products: ${error.error?.message || error.error || listRes.statusText}`);
    }

    const listData = await listRes.json();
    const products = listData.result || [];

    if (products.length === 0) {
      console.log('⚠️  No products found in your Printful store.');
      console.log('   Make sure you have created products in the Printful dashboard.');
      return;
    }

    console.log(`✅ Found ${products.length} product(s)\n`);
    console.log('='.repeat(80));

    // Fetch details for each product
    const productDetails = [];
    for (const product of products) {
      const detailsRes = await fetch(`https://api.printful.com/store/products/${product.id}`, {
        headers: {
          'Authorization': `Bearer ${PRINTFUL_TOKEN}`
        }
      });

      if (!detailsRes.ok) {
        console.error(`⚠️  Failed to fetch details for product ${product.id}`);
        continue;
      }

      const detailsData = await detailsRes.json();
      const details = detailsData.result;

      productDetails.push({
        productId: product.id,
        productName: product.name || details.sync_product?.name || 'Unknown',
        thumbnail: product.thumbnail_url || details.sync_product?.thumbnail_url,
        variants: (details.sync_variants || []).map(v => ({
          variantId: v.id,
          name: v.name,
          retailPrice: v.retail_price,
          currency: v.currency
        }))
      });
    }

    // Display results
    for (const pd of productDetails) {
      console.log(`\n📦 Product: ${pd.productName}`);
      console.log(`   Product ID: ${pd.productId}`);
      if (pd.thumbnail) {
        console.log(`   Thumbnail: ${pd.thumbnail}`);
      }
      console.log(`   Variants (${pd.variants.length}):`);

      if (pd.variants.length === 0) {
        console.log('      ⚠️  No variants found');
      } else {
        for (const variant of pd.variants) {
          const sizeMatch = variant.name.match(/\b(S|M|L|XL|2XL|3XL|4XL|5XL|Small|Medium|Large|Extra Large|2X|3X|4X|5X)\b/i);
          const size = sizeMatch ? sizeMatch[1] : '?';
          console.log(`      - ${variant.name.padEnd(40)} | Variant ID: ${variant.variantId.toString().padStart(6)} | ${variant.retailPrice} ${variant.currency}`);
        }
      }
      console.log('');
    }

    // Generate JSON mapping example
    console.log('='.repeat(80));
    console.log('\n📋 Example JSON mapping for content/merch.json:\n');
    console.log(JSON.stringify({
      products: productDetails.map(pd => ({
        id: `printful-${pd.productId}`.toLowerCase().replace(/\s+/g, '-'),
        name: pd.productName,
        variants: pd.variants.map(v => ({
          id: `variant-${v.variantId}`,
          label: v.name,
          printfulVariantId: v.variantId
        })),
        fulfillment: {
          type: 'printful'
        }
      })), null, 2));

    console.log('\n💡 Next steps:');
    console.log('   1. Copy the variant IDs above');
    console.log('   2. Update content/merch.json with printfulVariantId values');
    console.log('   3. Match your existing product IDs to the Printful variants');
    console.log('   4. Test checkout flow\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('\n💡 Your PRINTFUL_TOKEN may be invalid or expired.');
      console.error('   Get a new token from: https://www.printful.com/dashboard/api');
    }
    process.exit(1);
  }
}

fetchPrintfulProducts();

