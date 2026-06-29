import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EVOLUTION_API_URL = 'https://evo.jotabot.site';
const EVOLUTION_API_KEY = 'JotaBotEVO2025_API_Key_Definitiva';

const EXTERNAL_LEADS = [
    { name: 'Joao Vithor Bauer', email: 'ads@leverecom.com.br', whatsapp: '45999878620', company_website: 'arquibancadaoficial.com.br', revenue_range: '200k-1M', niches: 'Ecommerce' },
    { name: 'Mauro Gomes de Freitas Neto', email: 'mfreitas053@gmail.com', whatsapp: '68981056798', company_website: 'www.hypeimports.com.br', revenue_range: 'Ate 50k', niches: 'Dropshipping de Sneakers' },
    { name: 'Jean Vaz', email: 'jeanvaz.100@gmail.com', whatsapp: '31992651279', company_website: 'goldenesportes.com.br', revenue_range: 'Ate 50k', niches: 'E-commerce' },
    { name: 'Bruno Fernandes', email: 'brunoartdesser@gmail.com', whatsapp: '21964845459', company_website: '', revenue_range: 'Ate 50k', niches: 'E-commerce' },
    { name: 'Erivelto Maffezzoli Junior', email: 'contato.diariodetorcedor@gmail.com', whatsapp: '48991358741', company_website: 'diariostores.com', revenue_range: '50k-200k', niches: 'E-commerce' },
    { name: 'Matheus Lima Marques Moreira', email: 'matheus.3m.k22@hotmail.com', whatsapp: '27996950390', company_website: 'peltavix.com', revenue_range: 'Ate 50k', niches: 'E-commerce' },
    { name: 'Rodrigo Rolim', email: 'suporte@r2imports.com.br', whatsapp: '9299473128', company_website: 'https://r2imports.com/', revenue_range: 'Ate 50k', niches: 'Artigos Esportivos' },
    { name: 'Victor Cassio', email: 'victordcassio5600@gmail.com', whatsapp: '11958970486', company_website: 'www.atacantestore.com', revenue_range: 'Ate 50k', niches: 'Dropshipping' },
    { name: 'Paulo Matheus Da Silva Mendes', email: 'paulobessa124@gmail.com', whatsapp: '21982097208', company_website: 'Central do torcedor', revenue_range: 'Ate 50k', niches: 'Site' },
    { name: 'Ramon Alves Jardim', email: 'ramonjardim300@gmail.com', whatsapp: '99984557942', company_website: 'Em produção', revenue_range: 'Ate 50k', niches: 'E-commerce' },
    { name: 'Francisco Gutemberg Souza da Silva', email: 'grsports.ofc@gmail.com', whatsapp: '88981264021', company_website: 'https://lojagrsports.lojavirtualnuvem.com', revenue_range: 'Ate 50k', niches: 'Camisas de time' },
];

// @ts-ignore
Deno.serve(instrument("import-existing-leads", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: workspaces } = await supabase.from('workspaces').select('id').limit(1);
        const workspaceId = workspaces?.[0]?.id;
        if (!workspaceId) {
            return new Response(JSON.stringify({ error: 'No workspace' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data: columns } = await supabase
            .from('crm_kanban_columns').select('id, title')
            .eq('workspace_id', workspaceId).order('order_index', { ascending: true }).limit(1);
        const firstColumn = columns?.[0];
        const columnTitle = firstColumn?.title || 'Contato';

        const { data: existingLeads } = await supabase.from('crm_leads').select('email, phone').eq('workspace_id', workspaceId);
        const existingEmails = new Set((existingLeads || []).map((l: any) => l.email).filter(Boolean));
        const existingPhones = new Set((existingLeads || []).map((l: any) => l.phone).filter(Boolean));

        let imported = 0, skipped = 0;
        const importedNames: string[] = [];

        // STEP 1: Insert all leads first (fast, no delays)
        for (const lead of EXTERNAL_LEADS) {
            if ((lead.email && existingEmails.has(lead.email)) || (lead.whatsapp && existingPhones.has(lead.whatsapp))) {
                skipped++;
                continue;
            }

            const obs = [
                lead.niches ? `Nicho: ${lead.niches}` : '',
                lead.revenue_range ? `Faturamento: ${lead.revenue_range}` : '',
                lead.company_website ? `Site: ${lead.company_website}` : '',
                'Origem: Formulário do site (importação)'
            ].filter(Boolean).join('\n');

            const { error } = await supabase.from('crm_leads').insert({
                workspace_id: workspaceId,
                name: lead.name, email: lead.email || null, phone: lead.whatsapp || null,
                store_name: lead.company_website || null, site_url: lead.company_website || null,
                lead_status: columnTitle, lead_score: lead.revenue_range || null,
                product_interest: lead.niches || null, observations: obs,
                column_id: firstColumn?.id || null
            });

            if (!error) {
                imported++;
                importedNames.push(`• ${lead.name} (${lead.whatsapp})`);
                if (lead.email) existingEmails.add(lead.email);
                if (lead.whatsapp) existingPhones.add(lead.whatsapp);
            }
        }

        // STEP 2: Send ONE consolidated WhatsApp message (no delays)
        let whatsappSent = false;
        if (importedNames.length > 0) {
            let instanceName = '';
            const { data: conn } = await supabase.from('whatsapp_connections').select('instance_name').eq('status', 'connected').limit(1);
            if (conn?.[0]?.instance_name) instanceName = conn[0].instance_name;
            const comercialNumber = Deno.env.get('COMERCIAL_WHATSAPP_NUMBER') || '5531995194872';

            if (instanceName && comercialNumber) {
                const msg = [
                    `🔔 *${importedNames.length} Novos Leads Importados!*`,
                    '',
                    ...importedNames,
                    '',
                    '_Importados automaticamente pelo Beacon System_'
                ].join('\n');

                const sendRes = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
                    body: JSON.stringify({ number: comercialNumber, text: msg })
                });
                whatsappSent = sendRes.ok;
            }
        }

        return new Response(JSON.stringify({
            total: EXTERNAL_LEADS.length, imported, skipped,
            whatsapp_enviado: whatsappSent,
            leads_importados: importedNames
        }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
}));
