-- Adicionar suporte a pagamento parcial em recebíveis avulsos
ALTER TABLE public.one_off_receivables
ADD COLUMN IF NOT EXISTS entry_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance_due_date DATE;

-- Garantir que o status aceite 'parcial'
-- Se o status for um check constraint ou enum, precisamos atualizar. 
-- Olhando useOneOffReceivables, parece ser apenas um tipo em TS, mas vamos garantir no banco.
ALTER TABLE public.one_off_receivables 
DROP CONSTRAINT IF EXISTS one_off_receivables_status_check;

ALTER TABLE public.one_off_receivables
ADD CONSTRAINT one_off_receivables_status_check 
CHECK (status IN ('pending', 'paid', 'parcial'));
