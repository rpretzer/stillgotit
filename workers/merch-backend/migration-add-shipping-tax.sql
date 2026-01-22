-- Migration: Add shipping and tax columns to orders table
-- Run with: wrangler d1 execute sgic-merch --file=migration-add-shipping-tax.sql

-- Add shipping_cents column if it doesn't exist
ALTER TABLE orders ADD COLUMN shipping_cents INTEGER NOT NULL DEFAULT 0;

-- Add tax_cents column if it doesn't exist
ALTER TABLE orders ADD COLUMN tax_cents INTEGER NOT NULL DEFAULT 0;

-- Add total_cents column if it doesn't exist
ALTER TABLE orders ADD COLUMN total_cents INTEGER NOT NULL DEFAULT 0;

-- Update existing orders to calculate total_cents from subtotal_cents
-- (This is a one-time update for existing orders without shipping/tax)
UPDATE orders
SET total_cents = subtotal_cents
WHERE total_cents = 0 AND subtotal_cents > 0;
