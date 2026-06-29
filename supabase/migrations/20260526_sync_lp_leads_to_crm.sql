-- Sincroniza leads capturados pelo site institucional (LeverSite -> lp.leads)
-- com o CRM da aba Comercial (public.crm_leads).
--
-- Contexto:
-- - LeverSite (leveragency/LeverSite) usa createClient(... { db: { schema: 'lp' } })
--   e insere em lp.leads.
-- - A aba Comercial do Lever System lê de public.crm_leads.
-- - Sem isso, leads do site nunca aparecem no funil.
--
-- Trigger AFTER INSERT em lp.leads chama lp.sync_lead_to_crm() que faz INSERT
-- na public.crm_leads na coluna kanban "1º contato" do workspace Lever.
--
-- O trigger_notify_comercial em public.crm_leads continua disparando normalmente,
-- então o squad recebe a notificação de novo lead.

CREATE OR REPLACE FUNCTION lp.sync_lead_to_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, lp
AS $$
BEGIN
  INSERT INTO public.crm_leads (
    workspace_id,
    name,
    email,
    phone,
    site_url,
    revenue,
    product_interest,
    observations,
    lead_status,
    column_id,
    created_at
  ) VALUES (
    '3cb9ac39-d833-449e-a4ae-77197a5eba3b'::uuid,
    NEW.name,
    NEW.email,
    NEW.whatsapp,
    COALESCE(NEW.company_website, NEW.metadata->>'website'),
    COALESCE(NEW.revenue_range, NEW.metadata->>'revenue_range'),
    COALESCE(NEW.metadata->>'project_type', NEW.source),
    NULLIF(
      concat_ws(E'\n',
        CASE WHEN NEW.source IS NOT NULL THEN 'Origem: ' || NEW.source END,
        CASE WHEN NEW.metadata->>'budget_range' IS NOT NULL THEN 'Orçamento: ' || (NEW.metadata->>'budget_range') END,
        CASE WHEN NEW.metadata->>'project_type' IS NOT NULL THEN 'Tipo: ' || (NEW.metadata->>'project_type') END,
        CASE WHEN COALESCE(NEW.niche, NEW.metadata->>'niche') IS NOT NULL THEN 'Nicho: ' || COALESCE(NEW.niche, NEW.metadata->>'niche') END,
        CASE WHEN NEW.metadata->>'experience_level' IS NOT NULL THEN 'Experiência: ' || (NEW.metadata->>'experience_level') END,
        CASE WHEN NEW.metadata->>'project_scope' IS NOT NULL THEN E'\nEscopo: ' || (NEW.metadata->>'project_scope') END,
        CASE WHEN NEW.metadata->>'button_context' IS NOT NULL THEN E'\nContexto: ' || (NEW.metadata->>'button_context') END
      ), ''
    ),
    '1º_contato',
    'd60cf9cb-64ec-4c3d-9fd2-1429b8977494',
    NEW.created_at
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_lp_lead_to_crm ON lp.leads;
CREATE TRIGGER sync_lp_lead_to_crm
AFTER INSERT ON lp.leads
FOR EACH ROW EXECUTE FUNCTION lp.sync_lead_to_crm();
