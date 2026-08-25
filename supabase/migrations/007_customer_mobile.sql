-- ============================================================
-- OpenPayUPI — Customer Mobile on Checkout
-- Migration: 007_customer_mobile.sql
--
-- The hosted checkout now collects the payer's mobile number
-- BEFORE revealing the QR code. Stored against the order for
-- reconciliation and customer support.
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_mobile TEXT NULL;

COMMENT ON COLUMN orders.customer_mobile IS
  'Payer mobile number captured on the hosted checkout before QR reveal (10-digit, India)';
