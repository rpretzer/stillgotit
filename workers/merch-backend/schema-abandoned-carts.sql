-- Abandoned Cart Tracking Schema
-- Run with: wrangler d1 execute sgic-merch --remote --file=schema-abandoned-carts.sql

CREATE TABLE IF NOT EXISTS abandoned_carts (
  id TEXT PRIMARY KEY,
  email TEXT,
  cart_data TEXT NOT NULL, -- JSON string of cart items
  subtotal_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  recovery_token TEXT UNIQUE, -- For email recovery links
  last_updated TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  recovered_at TEXT, -- When cart was recovered/converted to order
  email_sent_at TEXT -- When reminder email was sent
);

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_email ON abandoned_carts(email);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_recovery_token ON abandoned_carts(recovery_token);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_last_updated ON abandoned_carts(last_updated);

