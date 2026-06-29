import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
Deno.serve(instrument("receive-external-lead", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json();
        const lead = body.record || body;

        const name = lead.name || 'Sem nome';
        const email = lead.email || '';
        const whatsapp = lead.whatsapp || '';
        const companyWebsite = lead.company_website || '';
        const revenueRange = lead.revenue_range || '';
        const niches = lead.niches || '';

        if (!name && !email && !whatsapp) {
            return new Response(
                JSON.stringify({ error: 'Lead sem dados de contato' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Check duplicate
        let isDuplicate = false;
        if (email) {
            const { data } = await supabase.from('crm_leads').select('id').eq('email', email).limit(1);
            if (data && data.length > 0) isDuplicate = true;
        }
        if (!isDuplicate && whatsapp) {
            const { data } = await supabase.from('crm_leads').select('id').eq('phone', whatsapp).limit(1);
            if (data && data.length > 0) isDuplicate = true;
        }

        if (isDuplicate) {
            return new Response(
                JSON.stringify({ success: true, skipped: true, reason: 'duplicate' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get workspace + first column
        const { data: workspaces } = await supabase.from('workspaces').select('id').limit(1);
        const workspaceId = workspaces?.[0]?.id;
        if (!workspaceId) {
            return new Response(JSON.stringify({ error: 'No workspace' }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const { data: columns } = await supabase
            .from('crm_kanban_columns').select('id, title')
            .eq('workspace_id', workspaceId)
            .order('order_index', { ascending: true }).limit(1);

        const firstColumn = columns?.[0];
        const columnTitle = firstColumn?.title || 'Contato';

        // Insert lead
        const observations = [
            niches ? `Nicho: ${niches}` : '',
            revenueRange ? `Faturamento: ${revenueRange}` : '',
            companyWebsite ? `Site: ${companyWebsite}` : '',
            'Origem: Formulário do site (automático)'
        ].filter(Boolean).join('\n');

        const { error: insertError } = await supabase.from('crm_leads').insert({
            workspace_id: workspaceId,
            name, email: email || null, phone: whatsapp || null,
            store_name: companyWebsite || null, site_url: companyWebsite || null,
            lead_status: columnTitle, lead_score: revenueRange || null,
            product_interest: niches || null, observations,
            column_id: firstColumn?.id || null
        });

        if (insertError) {
            return new Response(
                JSON.stringify({ error: 'Insert failed', details: insertError }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // WhatsApp notification is handled by the PostgreSQL trigger (pg_net → Vercel → Evolution)
        return new Response(
            JSON.stringify({ success: true, lead: name, whatsapp: 'trigger_will_handle' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}));
