-- ============================================================================
-- Migration: Comissionamento por indicação nas vendas (sales_records)
-- Contexto: vendas podem ter um indicador externo (ex.: "Lucas") que recebe
--           um % do valor total. NULL = venda sem comissão (default).
--           Valor da comissão é derivado (total_amount * commission_pct/100),
--           nunca armazenado.
-- ============================================================================

ALTER TABLE public.sales_records
    ADD COLUMN IF NOT EXISTS referral_name text,
    ADD COLUMN IF NOT EXISTS commission_pct numeric(5,2);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sales_records_commission_pct_range'
    ) THEN
        ALTER TABLE public.sales_records
            ADD CONSTRAINT sales_records_commission_pct_range
            CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 100));
    END IF;
END $$;

COMMENT ON COLUMN public.sales_records.referral_name IS 'Quem indicou a venda (comissionamento). NULL = sem comissão.';
COMMENT ON COLUMN public.sales_records.commission_pct IS '% de comissão sobre total_amount (0-100). NULL = sem comissão.';
