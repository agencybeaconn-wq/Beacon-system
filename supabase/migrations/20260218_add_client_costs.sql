-- Migration to add cost columns for Smart Data profitability
ALTER TABLE public.agency_clients 
ADD COLUMN IF NOT EXISTS product_unit_cost NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gateway_fee_fixed NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gateway_fee_percent NUMERIC(5, 2) DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS tax_percent NUMERIC(5, 2) DEFAULT 6.0;

COMMENT ON COLUMN public.agency_clients.product_unit_cost IS 'Custo unitário do produto (usado no Smart Data)';
COMMENT ON COLUMN public.agency_clients.gateway_fee_fixed IS 'Taxa fixa do gateway por transação';
COMMENT ON COLUMN public.agency_clients.gateway_fee_percent IS 'Taxa percentual do gateway';
COMMENT ON COLUMN public.agency_clients.tax_percent IS 'Percentual de imposto sobre a venda';
