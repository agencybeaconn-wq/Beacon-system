-- Adiciona coluna archived_at em crm_leads pra suportar "Leads Arquivados"
-- exibidos em /settings (aba nova entre "Arquivados" de clientes e "Demandas
-- Concluidas"). Quando archived_at != null, o lead some do kanban /comercial
-- mas continua no banco como historico. Restaurar = archived_at = null.

ALTER TABLE public.crm_leads
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Indice parcial otimiza tanto a query do kanban (archived_at IS NULL)
-- quanto a query da aba de arquivados (archived_at IS NOT NULL).
CREATE INDEX IF NOT EXISTS idx_crm_leads_archived_at
ON public.crm_leads (archived_at)
WHERE archived_at IS NOT NULL;
