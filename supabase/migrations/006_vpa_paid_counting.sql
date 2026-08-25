-- ============================================================
-- OpenPayUPI — VPA Daily Cap Rework
-- Migration: 006_vpa_paid_counting.sql
--
-- Changes the meaning of vpas.daily_tx_count from "orders allocated"
-- to "orders COMPLETED (PAID) today":
--
--   * claim_order_payment() now bumps the order's VPA counter in the
--     same transaction that marks it PAID. Failed/expired orders never
--     consume capacity.
--   * Order creation no longer touches the counter (capacity is still
--     checked at allocation time via selectVpa()).
--   * DB-level guard: max_daily_limit must be 1..500.
--
-- Run AFTER 003 (this file re-creates everything it needs, so it is
-- safe to run on a database where 003 was already applied).
-- ============================================================

-- ─────────────────────────────────────────
-- Capacity guard at allocation (re-asserted for idempotency)
-- ─────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_pending_dynamic_amount
  ON orders(dynamic_amount)
  WHERE status = 'PENDING';

-- ─────────────────────────────────────────
-- Limit bounds enforced by the database itself
-- ─────────────────────────────────────────

ALTER TABLE vpas DROP CONSTRAINT IF EXISTS chk_vpas_max_daily_limit;
ALTER TABLE vpas ADD CONSTRAINT chk_vpas_max_daily_limit
  CHECK (max_daily_limit BETWEEN 1 AND 500) NOT VALID;
-- Optional strict validation once legacy rows are fixed:
-- ALTER TABLE vpas VALIDATE CONSTRAINT chk_vpas_max_daily_limit;

-- ─────────────────────────────────────────
-- Atomic payment claim + paid-transaction counter
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION claim_order_payment(
  p_order_id  UUID,
  p_channel   verified_via_enum,
  p_utr       TEXT,
  p_utr_hash  TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows_updated INTEGER;
BEGIN
  -- Ledger insert first: UNIQUE(utr_hash) rejects replayed UTRs
  -- for any order and rolls the whole transaction back.
  INSERT INTO utr_ledger (utr_hash, order_id, verified_at)
  VALUES (p_utr_hash, p_order_id, NOW());

  UPDATE orders
     SET status       = 'PAID',
         verified_via = p_channel,
         upi_utr      = p_utr
   WHERE id     = p_order_id
     AND status = 'PENDING';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    -- Order was paid/expired concurrently. Compensate within the
    -- same transaction so no orphan ledger row survives.
    DELETE FROM utr_ledger WHERE utr_hash = p_utr_hash AND order_id = p_order_id;
    RETURN FALSE;
  END IF;

  -- Completed transaction: consume VPA daily capacity. Uncapped on
  -- purpose — a paid order is money already received; the limit only
  -- gates future allocations via selectVpa().
  UPDATE vpas
     SET daily_tx_count = daily_tx_count + 1
   WHERE id = (SELECT vpa_id FROM orders WHERE id = p_order_id);

  RETURN TRUE;
EXCEPTION
  WHEN unique_violation THEN
    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION claim_order_payment IS
  'Atomically claims a PENDING order as PAID, records the UTR ledger row, and increments the VPA completed-transactions counter';

COMMENT ON COLUMN vpas.daily_tx_count IS
  'Completed (PAID) transactions assigned to this VPA today; reset at midnight';
