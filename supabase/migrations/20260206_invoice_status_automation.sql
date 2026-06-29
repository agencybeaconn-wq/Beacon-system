-- Migration: implement_invoice_status_automation
-- Purpose: Automatically mark invoices as 'overdue' if they are past their due date and still 'pending'.

-- 1. Create a function to update overdue invoices
CREATE OR REPLACE FUNCTION public.check_and_update_overdue_invoices()
RETURNS integer AS $$
DECLARE
    updated_count integer;
BEGIN
    UPDATE public.client_invoices
    SET status = 'overdue',
        updated_at = NOW()
    WHERE status = 'pending'
      AND due_date < CURRENT_DATE;
      
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a trigger function that runs on interaction
-- Since we can't easily schedule in all environments, we run it
-- whenever a new invoice is created or updated, or on some other high-frequency interaction.
CREATE OR REPLACE FUNCTION public.trigger_check_overdue_invoices()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.check_and_update_overdue_invoices();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach trigger to client_invoices
DROP TRIGGER IF EXISTS tr_check_overdue_on_invoice_change ON public.client_invoices;
CREATE TRIGGER tr_check_overdue_on_invoice_change
AFTER INSERT OR UPDATE ON public.client_invoices
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_check_overdue_invoices();

-- 4. Optionally, attach to agency_clients or other tables to ensure frequent checks
DROP TRIGGER IF EXISTS tr_check_overdue_on_client_change ON public.agency_clients;
CREATE TRIGGER tr_check_overdue_on_client_change
AFTER INSERT OR UPDATE ON public.agency_clients
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_check_overdue_invoices();
