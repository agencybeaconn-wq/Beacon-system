-- Add description column to agency_product_features
ALTER TABLE public.agency_product_features
ADD COLUMN IF NOT EXISTS description TEXT;
