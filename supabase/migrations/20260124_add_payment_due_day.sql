-- Add payment_due_day to agency_clients
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agency_clients' AND column_name = 'payment_due_day') THEN
        ALTER TABLE public.agency_clients ADD COLUMN payment_due_day INTEGER DEFAULT 5;
    END IF;
END $$;
