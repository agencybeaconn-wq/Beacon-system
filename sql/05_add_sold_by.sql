-- Migration: Add sold_by column to sales_records
-- Run this in Supabase SQL Editor

ALTER TABLE sales_records 
ADD COLUMN IF NOT EXISTS sold_by TEXT DEFAULT NULL;

-- Optional: Add a check constraint to enforce valid values
ALTER TABLE sales_records
ADD CONSTRAINT sales_records_sold_by_check 
CHECK (sold_by IS NULL OR sold_by IN ('joao', 'matheus'));
