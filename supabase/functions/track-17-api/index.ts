import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TOKEN_17TRACK = "90967A51B6E578D4F9858EE681060806"

interface RegisterPayload {
    number: string;
    carrier?: string;
    note?: string;
    action?: 'register' | 'sync';
}

serve(instrument("track-17-api", async (req: Request) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            }
        })
    }

    try {
        console.log('[17TRACK-API] Request received')
        const authHeader = req.headers.get('Authorization')
        console.log('[17TRACK-API] Auth header present:', !!authHeader)

        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        console.log('[17TRACK-API] Supabase URL present:', !!supabaseUrl)
        console.log('[17TRACK-API] Supabase Service Key present:', !!supabaseServiceKey)

        const supabaseClient = createClient(
            supabaseUrl ?? '',
            supabaseServiceKey ?? ''
        )

        if (!authHeader) {
            console.error('[17TRACK-API] Missing Authorization header')
            return new Response(JSON.stringify({
                error: 'Unauthorized',
                message: 'Missing Authorization header',
                hint: 'Certifique-se que o cliente Supabase no frontend está passando o token JWT.'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            })
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

        if (authError || !user) {
            console.error('[17TRACK-API] Auth verification failed:', authError?.message || 'User not found')
            return new Response(JSON.stringify({
                error: 'Unauthorized',
                message: authError?.message || 'User verification failed',
                token_length: token.length,
                supabase_url_present: !!supabaseUrl,
                supabase_key_present: !!supabaseServiceKey
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            })
        }

        console.log('[17TRACK-API] User authenticated:', user.email)

        const body = await req.json()
        const { number, carrier: providedCarrier, action = 'register' } = body as RegisterPayload

        if (!number) {
            return new Response(JSON.stringify({ error: 'Tracking number is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }

        let carrier = providedCarrier;

        // 1. If carrier not provided, try to detect it
        if (!carrier) {
            console.log(`[17TRACK] Detecting carrier for ${number}...`)
            try {
                const detectRes = await fetch('https://api.17track.net/track/v1/detect', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        '17token': TOKEN_17TRACK
                    },
                    body: JSON.stringify({ number })
                })
                const detectData = await detectRes.json()
                if (detectData.code === 0 && detectData.data?.length > 0) {
                    carrier = detectData.data[0].carrier
                    console.log(`[17TRACK] Detected carrier: ${carrier}`)
                }
            } catch (err) {
                console.error('[17TRACK] Detection error:', err)
            }
        }

        if (action === 'register') {
            // 2. Register on 17TRACK
            console.log(`[17TRACK] Registering ${number}...`)
            const res17 = await fetch('https://api.17track.net/track/v1/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', '17token': TOKEN_17TRACK },
                body: JSON.stringify([{ number, carrier }])
            })
            const data17 = await res17.json()
            console.log('[17TRACK] Register response:', JSON.stringify(data17))
        }

        // 3. Fetch latest status (GetTrack)
        console.log(`[17TRACK] Fetching details for ${number}...`)
        const fetchDetails = async (c: string | undefined) => {
            const res = await fetch('https://api.17track.net/track/v1/gettrack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', '17token': TOKEN_17TRACK },
                body: JSON.stringify([{ number, carrier: c }])
            })
            return await res.json()
        }

        let dataDetails = await fetchDetails(carrier)
        console.log('[17TRACK] Initial details response:', JSON.stringify(dataDetails))

        // 3.1 If not found or error, and we are syncing, try to register JUST IN CASE it's not registered
        const shouldRetry = !dataDetails.data?.accepted?.[0] && action === 'sync';
        if (shouldRetry) {
            console.log(`[17TRACK] No data for ${number}, attempting auto-registration during sync...`)
            await fetch('https://api.17track.net/track/v1/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', '17token': TOKEN_17TRACK },
                body: JSON.stringify([{ number, carrier }])
            })
            // Retry fetch
            dataDetails = await fetchDetails(carrier)
            console.log('[17TRACK] Retry details response:', JSON.stringify(dataDetails))
        }

        const trackInfo = dataDetails.data?.accepted?.[0] || dataDetails.data?.errors?.[0];

        if (trackInfo) {
            const track = trackInfo.track || {};
            // 17TRACK V1 uses cryptic fields:
            // z0 = latest event
            // z1 = events from primary carrier
            // subfields: a = time, z = content, c = location
            const z0 = track.z0 || {};
            const rawEvents1 = track.z1 || [];
            const rawEvents2 = track.z2 || [];

            // Combine events from both carriers and sort descending by time
            const allRawEvents = [...rawEvents1, ...rawEvents2].sort((evA, evB) => {
                const dateA = evA.a ? new Date(evA.a).getTime() : 0;
                const dateB = evB.a ? new Date(evB.a).getTime() : 0;
                return dateB - dateA;
            });

            const latestDescription = z0.z || (allRawEvents[0]?.z) || 'Aguardando atualização';
            const latestTime = z0.a || (allRawEvents[0]?.a) || new Date().toISOString();

            // Mapping 17TRACK status (state)
            const state = track.state || 0;
            let statusText = 'Pendente'
            if (state === 10) statusText = 'Em Trânsito'
            if (state === 20) statusText = 'Postado'
            if (state === 40) statusText = 'Entregue'
            if (state === 30) statusText = 'Atrasado'
            if (state === 35) statusText = 'Devolvido'

            const contentLower = latestDescription.toLowerCase()
            const isTaxed = contentLower.includes('fiscal') || contentLower.includes('taxado') || contentLower.includes('pagamento');

            const formattedHistory = allRawEvents.map((e: any) => ({
                time: e.a || '',
                content: e.z || '',
                location: e.c || ''
            }));

            console.log(`[17TRACK] Parsed: ${statusText} | Total Events: ${formattedHistory.length}`)

            // Save to DB
            const { error: dbError } = await supabaseClient
                .from('shipments')
                .upsert({
                    tracking_number: number,
                    user_id: user.id,
                    status: statusText,
                    last_event_description: latestDescription,
                    last_event_time: latestTime,
                    is_taxed: isTaxed,
                    tracking_history: formattedHistory,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'tracking_number' })

            if (dbError) {
                console.warn('[DB] Could not save full history (col potentially missing):', dbError.message);
                // Fallback: save without history column if it doesn't exist yet
                await supabaseClient
                    .from('shipments')
                    .upsert({
                        tracking_number: number,
                        user_id: user.id,
                        status: statusText,
                        last_event_description: latestDescription,
                        last_event_time: latestTime,
                        is_taxed: isTaxed,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'tracking_number' })
            }

            return new Response(JSON.stringify({
                success: true,
                status: statusText,
                details: latestDescription,
                history: formattedHistory
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            })
        } else {
            console.error('[17TRACK] No track info in response:', JSON.stringify(dataDetails))
            const errorInfo = dataDetails.data?.errors?.[0] || dataDetails.data?.rejected?.[0];
            const errorMsg = errorInfo?.error?.message || errorInfo?.message || 'Resposta vazia da API (verifique se o código é válido)';

            // Return 200 but with error field so frontend can handle it without a catch block
            return new Response(JSON.stringify({
                success: false,
                error: 'Falha ao buscar detalhes no 17TRACK',
                details: errorMsg
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            })
        }

    } catch (error: any) {
        console.error('[17TRACK-API] Fatal error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
    }
}))
