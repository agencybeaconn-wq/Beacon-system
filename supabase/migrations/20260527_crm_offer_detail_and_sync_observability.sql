-- 1) offer_detail column (oferta detalhada — qualificação manual no CRM após call)
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS offer_detail TEXT;

COMMENT ON COLUMN public.crm_leads.offer_detail IS
  'Oferta específica vendida ao lead (ex: Assessoria Starter, Tema Lever). Preenchido manualmente no CRM após qualificação.';

-- 2) sync errors table (observability pro trigger lp.sync_lead_to_crm)
CREATE TABLE IF NOT EXISTS lp.sync_errors (
  id          BIGSERIAL PRIMARY KEY,
  lead_id     BIGINT REFERENCES lp.leads(id) ON DELETE CASCADE,
  sqlstate    TEXT,
  sqlerrm     TEXT,
  payload     JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sync_errors_unresolved_idx
  ON lp.sync_errors(occurred_at) WHERE resolved_at IS NULL;

-- 3) trigger function reescrita:
--    - aponta column_id pra coluna LEAD (era 1º CONTATO)
--    - lead_status = 'lead'
--    - normaliza product_interest por vertente (Assessoria/Site/Sistema/Academy/Automação & IA/Outro)
--    - lê metadata.store_name (novo campo do form) e popula crm_leads.store_name
--    - try/catch loga em lp.sync_errors em vez de falhar silenciosamente
CREATE OR REPLACE FUNCTION lp.sync_lead_to_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'lp'
AS $function$
DECLARE
  v_workspace_id UUID := '3cb9ac39-d833-449e-a4ae-77197a5eba3b';
  v_column_lead  UUID := '3f8ce9f9-0d09-4348-bb0a-1fbab03990e0';
  v_product      TEXT;
  v_project_type TEXT := NEW.metadata->>'project_type';
BEGIN
  v_product := CASE NEW.source
    WHEN 'assessoria'     THEN 'Assessoria'
    WHEN 'tech-sites'     THEN 'Site'
    WHEN 'tech-sistemas'  THEN 'Sistema'
    WHEN 'academy'        THEN 'Academy'
    WHEN 'tech'           THEN CASE v_project_type
      WHEN 'site'         THEN 'Site'
      WHEN 'sistema'      THEN 'Sistema'
      WHEN 'automacao-ia' THEN 'Automação & IA'
      ELSE 'Outro'
    END
    ELSE COALESCE(NEW.source, 'Outro')
  END;

  BEGIN
    INSERT INTO public.crm_leads (
      workspace_id, name, store_name, email, phone, site_url, revenue,
      product_interest, observations, lead_status, column_id, created_at
    ) VALUES (
      v_workspace_id,
      NEW.name,
      NULLIF(NEW.metadata->>'store_name', ''),
      NEW.email,
      NEW.whatsapp,
      COALESCE(NEW.company_website, NEW.metadata->>'website', NEW.metadata->>'current_site'),
      COALESCE(NEW.revenue_range, NEW.metadata->>'revenue_range'),
      v_product,
      NULLIF(concat_ws(E'\n',
        CASE WHEN NEW.source IS NOT NULL THEN 'Origem: ' || NEW.source END,
        CASE WHEN v_project_type IS NOT NULL THEN 'Tipo: ' || v_project_type END,
        CASE WHEN NEW.metadata->>'project_timeline' IS NOT NULL THEN 'Prazo: ' || (NEW.metadata->>'project_timeline') END,
        CASE WHEN NEW.metadata->>'budget_range' IS NOT NULL THEN 'Orçamento: ' || (NEW.metadata->>'budget_range') END,
        CASE WHEN COALESCE(NEW.niche, NEW.metadata->>'niche') IS NOT NULL THEN 'Nicho: ' || COALESCE(NEW.niche, NEW.metadata->>'niche') END,
        CASE WHEN NEW.metadata->>'experience_level' IS NOT NULL THEN 'Nível: ' || (NEW.metadata->>'experience_level') END,
        CASE WHEN NEW.metadata->>'project_scope' IS NOT NULL THEN E'\nEscopo: ' || (NEW.metadata->>'project_scope') END,
        CASE WHEN NEW.metadata->>'button_context' IS NOT NULL THEN E'\nContexto: ' || (NEW.metadata->>'button_context') END
      ), ''),
      'lead',
      v_column_lead,
      NEW.created_at
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO lp.sync_errors (lead_id, sqlstate, sqlerrm, payload)
    VALUES (NEW.id, SQLSTATE, SQLERRM, to_jsonb(NEW));
    RAISE WARNING 'sync_lead_to_crm failed for lead %: % - %', NEW.id, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;
