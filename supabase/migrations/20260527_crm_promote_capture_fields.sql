-- Promove Tipo / Prazo / Orçamento de texto concatenado em observations
-- pra colunas próprias em crm_leads (permite filtrar/ordenar no kanban no futuro).
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS project_type     TEXT,
  ADD COLUMN IF NOT EXISTS project_timeline TEXT,
  ADD COLUMN IF NOT EXISTS budget_range     TEXT;

COMMENT ON COLUMN public.crm_leads.project_type     IS 'Tipo do projeto (loja-nova, refazer-loja, sob-medida, saas, automacao-ia, etc). Capturado do form.';
COMMENT ON COLUMN public.crm_leads.project_timeline IS 'Prazo desejado pelo lead (<1mes, 1-3meses, 3-6meses, 6+meses, sem-prazo). Capturado do form.';
COMMENT ON COLUMN public.crm_leads.budget_range     IS 'Faixa de investimento (ate-10k, 10k-30k, 30k-80k, 80k-200k, 200k+, a-definir). Capturado do form.';

-- Trigger reescrita: popula as 3 colunas novas + remove esses campos do bloco observations
-- (mantém só Origem/Nicho/Nível/Escopo/Contexto em observations).
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
      product_interest, project_type, project_timeline, budget_range,
      observations, lead_status, column_id, created_at
    ) VALUES (
      v_workspace_id,
      NEW.name,
      NULLIF(NEW.metadata->>'store_name', ''),
      NEW.email,
      NEW.whatsapp,
      COALESCE(NEW.company_website, NEW.metadata->>'website', NEW.metadata->>'current_site'),
      COALESCE(NEW.revenue_range, NEW.metadata->>'revenue_range'),
      v_product,
      v_project_type,
      NEW.metadata->>'project_timeline',
      NEW.metadata->>'budget_range',
      NULLIF(concat_ws(E'\n',
        CASE WHEN NEW.source IS NOT NULL THEN 'Origem: ' || NEW.source END,
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
