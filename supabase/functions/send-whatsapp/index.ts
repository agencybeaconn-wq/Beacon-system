import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.25.76'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// instanceName vai direto na URL do Evolution API — sem regex permite path traversal.
// groupId pode ser phone (somente dígitos) ou group jid (NN@g.us / NN@s.whatsapp.net).
// text limitado a 4096 (limite WhatsApp), min 1 evita mensagem vazia.
const sendSchema = z.object({
    instanceName: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'instanceName inválido'),
    groupId: z.string().regex(/^[a-zA-Z0-9@._-]+$/, 'groupId inválido').min(1).max(100),
    text: z.string().min(1).max(4096),
})

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.jotabot.site';
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

// @ts-ignore
Deno.serve(instrument("send-whatsapp", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // --- AUTH: Validate the requesting user ---
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
        return new Response(
            JSON.stringify({ error: 'Not authenticated' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '')
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
        return new Response(
            JSON.stringify({ error: 'Invalid or expired token' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    try {
        const rawBody = await req.json();
        const parsed = sendSchema.safeParse(rawBody);
        if (!parsed.success) {
            console.error('[WA-SEND] Payload inválido:', parsed.error.flatten());
            return new Response(
                JSON.stringify({ error: 'Payload inválido', details: parsed.error.flatten() }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
        const { instanceName, groupId, text } = parsed.data;

        if (!EVOLUTION_API_KEY) {
            throw new Error('EVOLUTION_API_KEY environment variable is not set');
        }

        console.log(`[WA-SEND] User: ${user.id}, Instance: ${instanceName}, Group: ${groupId}`);

        // 1. Check connection state
        const stateRes = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
            headers: { 'apikey': EVOLUTION_API_KEY }
        });
        const stateData = await stateRes.json();
        const connState = stateData.instance?.state || stateData.state;
        console.log(`[WA-SEND] Connection state: ${connState}`);

        // 2. If not open, try restart
        if (connState !== 'open') {
            console.log(`[WA-SEND] Not open, restarting...`);
            await fetch(`${EVOLUTION_API_URL}/instance/restart/${instanceName}`, {
                method: 'PUT',
                headers: { 'apikey': EVOLUTION_API_KEY }
            });
            // Wait for reconnection
            await new Promise(r => setTimeout(r, 5000));
        }

        // 3. Send the message
        console.log(`[WA-SEND] Sending text message...`);
        const sendRes = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({ number: groupId, text: text })
        });

        const sendData = await sendRes.text();
        console.log(`[WA-SEND] Response status: ${sendRes.status}, body: ${sendData}`);

        if (!sendRes.ok) {
            // Try restart + retry
            if (sendData.includes('SessionError') || sendData.includes('No sessions')) {
                console.log(`[WA-SEND] SessionError, restarting instance and retrying...`);

                // Delete and recreate to force fresh session
                await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
                    method: 'DELETE',
                    headers: { 'apikey': EVOLUTION_API_KEY }
                });
                await new Promise(r => setTimeout(r, 2000));

                await fetch(`${EVOLUTION_API_URL}/instance/restart/${instanceName}`, {
                    method: 'PUT',
                    headers: { 'apikey': EVOLUTION_API_KEY }
                });
                await new Promise(r => setTimeout(r, 8000));

                // Retry send
                const retryRes = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': EVOLUTION_API_KEY
                    },
                    body: JSON.stringify({ number: groupId, text: text })
                });

                const retryData = await retryRes.text();
                console.log(`[WA-SEND] Retry response: ${retryRes.status}, body: ${retryData}`);

                if (!retryRes.ok) {
                    return new Response(
                        JSON.stringify({ error: 'Failed after retry', details: retryData }),
                        { status: retryRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                return new Response(retryData, {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            return new Response(
                JSON.stringify({ error: 'Send failed', details: sendData }),
                { status: sendRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(sendData, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[WA-SEND] Fatal error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}));
