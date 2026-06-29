-- Migration: Add CartPanda + Meta derived columns to client_daily_metrics
-- Purpose: Store all data the system already pulls in real-time from Meta Ads and CartPanda,
--          so the Smart Data dashboard can read directly from the database.
--
-- DATA SOURCES:
--   Meta Ads (get-ad-insights): spend, impressions, clicks, reach, conversions, conversion_value
--   CartPanda (cartpanda-list-orders): cartpanda_revenue, cartpanda_orders, avg_order_value
--
-- Existing columns already in client_daily_metrics:
--   spend, impressions, clicks, revenue, sessions, orders, add_to_cart, checkouts_initiated,
--   approved_transactions, transaction_count, chargebacks, pix_approved, pix_total,
--   product_costs, total_tax_fees

-- =============================================
-- 1. ADD CARTPANDA-SPECIFIC COLUMNS
-- =============================================
ALTER TABLE public.client_daily_metrics
ADD COLUMN IF NOT EXISTS cartpanda_revenue NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cartpanda_orders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_order_value NUMERIC(15, 2) DEFAULT 0;

-- =============================================
-- 2. ADD META ADS DERIVED/MISSING COLUMNS
-- =============================================
ALTER TABLE public.client_daily_metrics
ADD COLUMN IF NOT EXISTS reach INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_value NUMERIC(15, 2) DEFAULT 0;

-- =============================================
-- 3. COMMENTS
-- =============================================
COMMENT ON COLUMN public.client_daily_metrics.cartpanda_revenue IS 'Total paid revenue from CartPanda orders (Pedidos Pagos)';
COMMENT ON COLUMN public.client_daily_metrics.cartpanda_orders IS 'Total paid orders from CartPanda';
COMMENT ON COLUMN public.client_daily_metrics.avg_order_value IS 'Average order value from CartPanda (cartpanda_revenue / cartpanda_orders)';
COMMENT ON COLUMN public.client_daily_metrics.reach IS 'Total reach from Meta Ads campaigns';
COMMENT ON COLUMN public.client_daily_metrics.conversions IS 'Total conversions from Meta Ads (purchases/leads)';
COMMENT ON COLUMN public.client_daily_metrics.conversion_value IS 'Total conversion value from Meta Ads pixel';
