-- Adicionar campos de comissão e chave PIX na tabela de sócios
ALTER TABLE public.partners_prolabore
  ADD COLUMN IF NOT EXISTS commission_percent DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pix_key TEXT DEFAULT NULL;

-- Adicionar chave PIX na tabela de funcionários
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS pix_key TEXT DEFAULT NULL;
