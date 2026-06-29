-- Migration: consolidate_fixed_costs_to_agency_expenses
-- Purpose: Merge the redundant fixed_costs table into agency_expenses to simplify the schema.

-- 1. Copy data from fixed_costs to agency_expenses
-- Mapping:
--   name -> description
--   amount -> amount
--   'monthly' -> recurrence_type: 'fixed'
--   payment_day -> (used to calculate due_date for current month)
--   category -> category (mapped or kept as 'other' if not in enum)
--   workspace_id -> workspace_id

INSERT INTO public.agency_expenses (
    workspace_id,
    description,
    amount,
    category,
    status,
    due_date,
    recurrence_type,
    created_at
)
SELECT 
    workspace_id,
    name as description,
    amount,
    'other'::public.agency_expenses_category as category, -- Defaulting to 'other' or mapping logic
    'pending'::public.agency_expenses_status as status,
    (CURRENT_DATE + (payment_day - EXTRACT(DAY FROM CURRENT_DATE))::integer * INTERVAL '1 day')::date as due_date,
    'fixed'::public.agency_expenses_recurrence_type as recurrence_type,
    created_at
FROM public.fixed_costs
WHERE is_active = true;

-- 2. Drop the redundant table
-- CAUTION: Only do this once data migration is verified.
-- DROP TABLE public.fixed_costs;
