-- Products table for synced Printful products
-- Run with: wrangler d1 execute sgic-merch --remote --file=schema-products.sql

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  price_cents INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT 1,
  fulfillment_type TEXT NOT NULL DEFAULT 'printful',
  printful_product_id INTEGER,
  printful_variant_id INTEGER,
  variant_label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_printful_variant ON products(printful_variant_id);
CREATE INDEX IF NOT EXISTS idx_products_printful_product ON products(printful_product_id);



