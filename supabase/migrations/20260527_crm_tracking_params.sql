-- UTM/gclid/referrer capture: colunas próprias em crm_leads pra rastreio milimétrico
-- LP (LeverSite/lib/tracking.ts) captura no first-touch via sessionStorage e envia em metadata.

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS gclid          TEXT,
  ADD COLUMN IF NOT EXISTS utm_source     TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium     TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign   TEXT,
  ADD COLUMN IF NOT EXISTS utm_content    TEXT,
  ADD COLUMN IF NOT EXISTS utm_term       TEXT,
  ADD COLUMN IF NOT EXISTS landing_page   TEXT,
  ADD COLUMN IF NOT EXISTS referrer       TEXT;

COMMENT ON COLUMN public.crm_leads.gclid IS 'Google Ads Click ID — necessário pra offline conversion upload via API.';
COMMENT ON COLUMN public.crm_leads.utm_source IS 'utm_source da URL no first-touch (sessionStorage).';

CREATE INDEX IF NOT EXISTS crm_leads_gclid_idx ON public.crm_leads(gclid) WHERE gclid IS NOT NULL;

-- Trigger reescrita: popula as 8 colunas novas + emojis visuais em observations pra time ver rápido
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
      gclid, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      landing_page, referrer,
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
      NEW.metadata->>'gclid',
      NEW.metadata->>'utm_source',
      NEW.metadata->>'utm_medium',
      NEW.metadata->>'utm_campaign',
      NEW.metadata->>'utm_content',
      NEW.metadata->>'utm_term',
      NEW.metadata->>'landing_page',
      NEW.metadata->>'referrer',
      NULLIF(concat_ws(E'\n',
        CASE WHEN NEW.source IS NOT NULL THEN 'Origem: ' || NEW.source END,
        CASE WHEN COALESCE(NEW.niche, NEW.metadata->>'niche') IS NOT NULL THEN 'Nicho: ' || COALESCE(NEW.niche, NEW.metadata->>'niche') END,
        CASE WHEN NEW.metadata->>'experience_level' IS NOT NULL THEN 'Nível: ' || (NEW.metadata->>'experience_level') END,
        CASE WHEN NEW.metadata->>'project_scope' IS NOT NULL THEN E'\nEscopo: ' || (NEW.metadata->>'project_scope') END,
        CASE WHEN NEW.metadata->>'button_context' IS NOT NULL THEN E'\nContexto: ' || (NEW.metadata->>'button_context') END,
        CASE WHEN NEW.metadata->>'utm_source' IS NOT NULL THEN E'\nUTM: ' || (NEW.metadata->>'utm_source') || ' / ' || COALESCE(NEW.metadata->>'utm_medium', '?') || ' / ' || COALESCE(NEW.metadata->>'utm_campaign', '?') END,
        CASE WHEN NEW.metadata->>'gclid' IS NOT NULL THEN 'Google Ads click (gclid presente)' END,
        CASE WHEN NEW.metadata->>'fbclid' IS NOT NULL THEN 'Facebook Ads click (fbclid presente)' END,
        CASE WHEN NEW.metadata->>'referrer' IS NOT NULL AND NEW.metadata->>'referrer' <> 'direct' THEN 'Referrer: ' || (NEW.metadata->>'referrer') END
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
