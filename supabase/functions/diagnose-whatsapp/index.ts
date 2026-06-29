import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EVOLUTION_API_URL = 'https://evo.jotabot.site';
const EVOLUTION_API_KEY = 'JotaBotEVO2025_API_Key_Definitiva';

// @ts-ignore
Deno.serve(instrument("diagnose-whatsapp", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const report: any = { steps: [] };

        // Step 1: Check env var
        const comercialNumber = Deno.env.get('COMERCIAL_WHATSAPP_NUMBER') || '5531995194872';
        report.comercial_number = comercialNumber;
        report.steps.push('✅ Número do comercial: ' + comercialNumber);

        // Step 2: Query whatsapp_connections
        const { data: allConns, error: connErr } = await supabase
            .from('whatsapp_connections')
            .select('*');

        report.whatsapp_connections_count = allConns?.length || 0;
        report.whatsapp_connections_error = connErr?.message || null;
        report.whatsapp_connections = allConns?.map((c: any) => ({
            instance_name: c.instance_name,
            status: c.status,
            user_id: c.user_id?.substring(0, 8) + '...'
        })) || [];
        report.steps.push(allConns?.length ? `✅ ${allConns.length} conexão(ões) encontrada(s)` : '❌ Nenhuma conexão WhatsApp no banco');

        // Step 3: Get connected instance
        const connectedInstance = allConns?.find((c: any) => c.status === 'connected');
        const instanceName = connectedInstance?.instance_name || '';
        report.instance_name = instanceName || 'NENHUM';
        report.steps.push(instanceName ? `✅ Instância conectada: ${instanceName}` : '❌ Nenhuma instância com status "connected"');

        if (!instanceName) {
            report.conclusion = '❌ FALHA: Não há instância WhatsApp com status "connected" no banco do Beacon. O WhatsApp precisa ser reconectado na página de Conexões.';
            return new Response(JSON.stringify(report, null, 2), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Step 4: Check Evolution API connection state
        let evoState = 'unknown';
        try {
            const stateRes = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
                headers: { 'apikey': EVOLUTION_API_KEY }
            });
            const stateData = await stateRes.json();
            evoState = stateData.instance?.state || stateData.state || 'unknown';
            report.evolution_state = evoState;
            report.evolution_raw = stateData;
            report.steps.push(evoState === 'open' ? `✅ Evolution API: instância está OPEN` : `⚠️ Evolution API: instância está ${evoState}`);
        } catch (e: any) {
            report.evolution_error = e.message;
            report.steps.push(`❌ Erro ao consultar Evolution: ${e.message}`);
        }

        // Step 5: Try to send a test message
        if (evoState === 'open') {
            try {
                const testMsg = '🧪 *Teste de diagnóstico do Beacon System*\n\nSe você recebeu essa mensagem, a integração de notificação de novos leads está funcionando! ✅';
                const sendRes = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
                    body: JSON.stringify({ number: comercialNumber, text: testMsg })
                });
                const sendText = await sendRes.text();
                report.send_status = sendRes.status;
                report.send_response = sendText.substring(0, 300);
                report.steps.push(sendRes.ok ? '✅ Mensagem de teste ENVIADA com sucesso!' : `❌ Envio falhou: HTTP ${sendRes.status}`);
            } catch (e: any) {
                report.send_error = e.message;
                report.steps.push(`❌ Erro ao enviar: ${e.message}`);
            }
        } else {
            report.steps.push('⏭️ Envio pulado: instância não está "open"');
        }

        // Conclusion
        const allOk = report.steps.every((s: string) => s.startsWith('✅'));
        report.conclusion = allOk
            ? '✅ TUDO FUNCIONANDO! O pipeline de leads com WhatsApp está operacional.'
            : '⚠️ Há problemas — veja os passos acima.';

        return new Response(JSON.stringify(report, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}));
