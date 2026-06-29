import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
Deno.serve(instrument("setup-lead-trigger", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const results: string[] = [];

        // Step 1: Enable pg_net extension
        const { error: extErr } = await supabase.rpc('exec_sql', {
            sql: `CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;`
        });

        // If exec_sql doesn't exist, try direct SQL via REST
        if (extErr) {
            results.push(`⚠️ exec_sql RPC not available (${extErr.message}). Trying alternative...`);

            // Use the postgres connection via supabase management API
            // Actually, let's use a workaround: create the function via multiple RPC calls
            // For now, let's check if pg_net is already available
            const { data: extCheck, error: extCheckErr } = await supabase
                .from('pg_extension')
                .select('extname')
                .eq('extname', 'pg_net')
                .maybeSingle();

            if (extCheckErr) {
                // Try querying via information schema
                results.push(`Checking pg_net via alternative method...`);
            }
        } else {
            results.push('✅ pg_net extension enabled');
        }

        // Step 2: Create the trigger function using raw SQL
        // We'll use supabase's SQL endpoint
        const triggerFunctionSQL = `
CREATE OR REPLACE FUNCTION public.notify_comercial_new_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  _instance_name TEXT;
  _comercial_number TEXT;
  _message TEXT;
  _request_id BIGINT;
BEGIN
  -- ONLY fire for leads from the website form (not manual leads)
  IF NEW.observations IS NULL OR position('site' in lower(NEW.observations)) = 0 THEN
    RETURN NEW;
  END IF;

  -- Get comercial number (hardcoded default, can be updated)
  _comercial_number := '5531995194872';

  -- Get connected WhatsApp instance
  SELECT instance_name INTO _instance_name
  FROM public.whatsapp_connections
  WHERE status = 'connected'
  LIMIT 1;

  IF _instance_name IS NULL THEN
    RAISE LOG 'notify_comercial: No connected WhatsApp instance';
    RETURN NEW;
  END IF;

  -- Build notification message
  _message := E'🔔 *Novo Lead Qualificado!*\\n\\n' ||
    E'👤 *Nome:* ' || COALESCE(NEW.name, 'Sem nome') || E'\\n' ||
    CASE WHEN NEW.phone IS NOT NULL AND NEW.phone != '' THEN E'📞 *WhatsApp:* ' || NEW.phone || E'\\n' ELSE '' END ||
    CASE WHEN NEW.email IS NOT NULL AND NEW.email != '' THEN E'📧 *Email:* ' || NEW.email || E'\\n' ELSE '' END ||
    CASE WHEN NEW.site_url IS NOT NULL AND NEW.site_url != '' THEN E'🌐 *Site:* ' || NEW.site_url || E'\\n' ELSE '' END ||
    CASE WHEN NEW.lead_score IS NOT NULL AND NEW.lead_score != '' THEN E'💰 *Faturamento:* ' || NEW.lead_score || E'\\n' ELSE '' END ||
    CASE WHEN NEW.product_interest IS NOT NULL AND NEW.product_interest != '' THEN E'🏷️ *Nicho:* ' || NEW.product_interest || E'\\n' ELSE '' END ||
    E'\\n_Enviado automaticamente pelo Beacon System_';

  -- Send via pg_net HTTP POST to Evolution API
  SELECT net.http_post(
    url := 'https://evo.jotabot.site/message/sendText/' || _instance_name,
    headers := '{"Content-Type": "application/json", "apikey": "JotaBotEVO2025_API_Key_Definitiva"}'::jsonb,
    body := jsonb_build_object('number', _comercial_number, 'text', _message)
  ) INTO _request_id;

  RAISE LOG 'notify_comercial: Sent request % for lead %', _request_id, NEW.name;
  RETURN NEW;
END;
$fn$;
`;

        const dropTriggerSQL = `DROP TRIGGER IF EXISTS trigger_notify_comercial ON public.crm_leads;`;

        const createTriggerSQL = `
CREATE TRIGGER trigger_notify_comercial
  AFTER INSERT ON public.crm_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comercial_new_lead();
`;

        // Execute SQL statements via Supabase REST API using the SQL endpoint
        // Since we can't use exec_sql RPC, we'll use the Supabase Management API
        // Actually the best approach is to use the PostgreSQL connection directly

        // Let's try using supabase-js's rpc with a generic SQL executor
        // First, let's try creating a temporary function to run our SQL

        // Alternative: Use the Supabase SQL API endpoint directly
        const dbUrl = supabaseUrl.replace('https://', '');
        const projectRef = dbUrl.split('.')[0];

        // Execute via the Supabase REST SQL endpoint (only works with service role)
        const sqlEndpoint = `${supabaseUrl}/rest/v1/rpc/`;

        // Let's try a different approach: execute SQL via pg_net or via the supabase client
        // The supabase client doesn't have a raw SQL method, but we can use a workaround

        // Create a helper function first
        const helperSQL = `
CREATE OR REPLACE FUNCTION public._run_sql(query text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $helper$
BEGIN
  EXECUTE query;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$helper$;
`;

        // Try creating the helper via RPC (this might fail if we can't run DDL)
        const { data: helperResult, error: helperErr } = await supabase.rpc('_run_sql', { query: 'SELECT 1' });

        if (helperErr && helperErr.message.includes('does not exist')) {
            // Helper doesn't exist, we need another way
            results.push('ℹ️ Need to create SQL helper function. Trying via dashboard API...');

            // Use Supabase Management API to run SQL
            // Actually, the cleanest way: use the database's HTTP API
            // POST to /rest/v1/rpc with service role key can create functions if we use DO blocks

            // Try using a DO block via a temporary RPC
            results.push('ℹ️ Attempting to run SQL via Supabase...');

            // The simplest approach that works: use pg_net or the SQL editor API
            // Since neither is available programmatically without the management API,
            // let's output the SQL for the user to run in the Dashboard SQL Editor

            return new Response(JSON.stringify({
                status: 'MANUAL_SQL_NEEDED',
                message: 'Não consegui executar SQL diretamente. Cole o SQL abaixo no Editor SQL do Supabase Dashboard.',
                instructions: [
                    '1. Abra o Dashboard do Supabase do Beacon System',
                    '2. Vá em SQL Editor (menu lateral)',
                    '3. Cole o SQL abaixo e clique em RUN',
                    '4. Depois abra a URL /functions/v1/test-trigger para testar'
                ],
                sql: `-- Ativar extensão pg_net
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Criar a função do trigger
${triggerFunctionSQL}

-- Remover trigger anterior se existir
${dropTriggerSQL}

-- Criar o trigger
${createTriggerSQL}

-- Verificar que foi criado
SELECT tgname, tgrelid::regclass, tgenabled FROM pg_trigger WHERE tgname = 'trigger_notify_comercial';`
            }, null, 2), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // If helper exists, use it to run our SQL
        results.push('✅ SQL helper available');

        // Enable pg_net
        const { data: r1 } = await supabase.rpc('_run_sql', { query: `CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;` });
        results.push(`pg_net: ${r1}`);

        // Create trigger function
        const { data: r2 } = await supabase.rpc('_run_sql', { query: triggerFunctionSQL });
        results.push(`Trigger function: ${r2}`);

        // Drop old trigger
        const { data: r3 } = await supabase.rpc('_run_sql', { query: dropTriggerSQL });
        results.push(`Drop old trigger: ${r3}`);

        // Create trigger
        const { data: r4 } = await supabase.rpc('_run_sql', { query: createTriggerSQL });
        results.push(`Create trigger: ${r4}`);

        return new Response(JSON.stringify({ status: 'OK', results }, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}));
