import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// EvolutionAPI Configuration (Should be set in Supabase Secrets)
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(instrument("whatsapp-evolution", async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Validate environment variables
        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
            console.error('[WhatsApp-Evolution] Missing environment variables')
            throw new Error('Server configuration error: Missing API credentials')
        }

        // Get Authorization header
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            console.error('[WhatsApp-Evolution] No Authorization header provided')
            return new Response(JSON.stringify({
                error: 'No authorization header',
                hint: 'Certifique-se que o usuário está logado e o token JWT está sendo enviado.'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            })
        }

        console.log('[WhatsApp-Evolution] Auth Header present (starts with):', authHeader.substring(0, 20) + '...')

        // Initialize Supabase Client with Service Role
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Optional: Extract user_id from token if needed, but don't block on it
        let userId = 'system';
        let userEmail = 'system';
        try {
            const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
            if (user) {
                userId = user.id;
                userEmail = user.email || 'system';
            }
        } catch (e) {
            console.log('[WhatsApp-Evolution] Could not verify user token');
        }

        console.log('[WhatsApp-Evolution] Authenticated user:', userEmail)

        let body: any = {};
        try {
            body = await req.json();
        } catch (e) {
            console.log('[WhatsApp-Evolution] No body provided or invalid JSON');
        }

        const { action, instanceName } = body

        if (!action) throw new Error('Action is required')

        // Instance name defaults to user ID if not provided
        // Remove dashes to comply with preferred alphanumeric server convention
        const name = (instanceName || `user${userId.substring(0, 8)}`).replace(/[^a-zA-Z0-9]/g, '')

        // Helper for EvolutionAPI headers
        const getHeaders = () => ({
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY!,
            'Global-ApiKey': EVOLUTION_API_KEY!,
            'Authorization': `Bearer ${EVOLUTION_API_KEY}`
        })

        // Helper to get URL (Keeping it clean for v2.x and normalizing slashes)
        const getUrl = (path: string) => {
            const baseUrl = EVOLUTION_API_URL!.endsWith('/')
                ? EVOLUTION_API_URL!.slice(0, -1)
                : EVOLUTION_API_URL!
            const cleanPath = path.startsWith('/') ? path : `/${path}`
            return `${baseUrl}${cleanPath}`
        }

        let result = {}

        if (action === 'CREATE_INSTANCE') {
            const url = getUrl('/instance/create')
            console.log('[WhatsApp-Evolution] Creating/Checking instance at:', url.replace(EVOLUTION_API_KEY!, '***'))

            const response = await fetch(url, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    instanceName: name,
                    token: userId,
                    qrcode: true,
                    integration: "WHATSAPP-BAILEYS"
                }),
            })

            let createResult: any;
            try {
                createResult = await response.json();
            } catch (e) {
                const text = await response.text();
                console.error('[WhatsApp-Evolution] CREATE_INSTANCE - Failed to parse JSON:', text);
                createResult = { error: 'Invalid JSON', raw: text };
            }

            console.log(`[WhatsApp-Evolution] CREATE_INSTANCE status: ${response.status}`)

            // Se já existe, tentamos o connect para pegar o QR
            if (response.status === 403 || response.status === 409 || (createResult as any).error?.includes('exists')) {
                console.log('[WhatsApp-Evolution] Instance already exists, fetching QR via connect...')
                const connectUrl = getUrl(`/instance/connect/${name}`)
                const connectRes = await fetch(connectUrl, { headers: getHeaders() })
                const connectData = await connectRes.json()

                // Em algumas versões o QR vem em connectData.base64 ou connectData.qrcode.base64
                const qrCode = connectData.base64 || connectData.qrcode?.base64 || connectData.code

                result = {
                    ...connectData,
                    qrcode: qrCode,
                    instanceName: name,
                    alreadyExists: true
                }
            } else if (response.ok) {
                // Se criou agora, o QR costuma vir no createResult.qrcode.base64
                const qrCodeValue = createResult.qrcode?.base64 || createResult.base64
                result = {
                    ...createResult,
                    qrcode: qrCodeValue,
                    instanceName: name
                }
            } else {
                throw new Error(createResult.message || createResult.error || 'Failed to create instance')
            }

            // Persistir no banco
            await supabase.from('whatsapp_connections' as any).upsert({
                user_id: userId,
                instance_name: name,
                status: 'connecting',
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, instance_name' });
        }

        else if (action === 'GET_QRCODE') {
            const endpoints = [
                { name: 'QR-v1', url: getUrl(`/instance/connect/${name}`), method: 'GET' },
                { name: 'QR-v2', url: getUrl(`/instance/connect/qrcode/${name}`), method: 'GET' }
            ]

            let success = false;
            for (const ep of endpoints) {
                console.log(`[WhatsApp-Evolution] Trying ${ep.name}: ${ep.url.replace(EVOLUTION_API_KEY!, '***')}`)
                const response = await fetch(ep.url, { method: ep.method, headers: getHeaders() })
                if (response.ok) {
                    result = await response.json()
                    success = true
                    console.log(`[WhatsApp-Evolution] ${ep.name} success`)
                    break
                }
            }

            if (!success) throw new Error('Could not find QR Code endpoint on server')
        }

        else if (action === 'CONNECT_PHONE') {
            const { phoneNumber } = body
            if (!phoneNumber) throw new Error('Phone number is required for pairing code')

            // Super Hunter 2.2.3: Exhaustive pattern matching
            const variants = [name, name.includes('-') ? name.replace(/-/g, '') : `${name.substring(0, 4)}-${name.substring(4)}`];

            const endpoints: any[] = []

            for (const n of variants) {
                endpoints.push(
                    // 1. Body-based (v2.x Standard/Newest)
                    { name: `Body-pairingCode-Connect-${n}`, url: getUrl(`/instance/connect/pairingCode`), method: 'POST', body: { instanceName: n, number: phoneNumber } },
                    { name: `Body-pairing-code-Connect-${n}`, url: getUrl(`/instance/connect/pairing-code`), method: 'POST', body: { instanceName: n, number: phoneNumber } },
                    { name: `Body-pairingCode-Direct-${n}`, url: getUrl(`/instance/pairingCode`), method: 'POST', body: { instanceName: n, number: phoneNumber } },
                    { name: `Body-pairing-code-Direct-${n}`, url: getUrl(`/instance/pairing-code`), method: 'POST', body: { instanceName: n, number: phoneNumber } },

                    // 2. URL-based (v2.0-v2.1)
                    { name: `URL-pairingCode-Connect-${n}`, url: getUrl(`/instance/connect/pairingCode/${n}`), method: 'POST', body: { number: phoneNumber } },
                    { name: `URL-pairing-code-Connect-${n}`, url: getUrl(`/instance/connect/pairing-code/${n}`), method: 'POST', body: { number: phoneNumber } },

                    // 3. GET Fallbacks
                    { name: `GET-pairingCode-Connect-${n}`, url: getUrl(`/instance/connect/pairingCode/${n}?number=${phoneNumber}`), method: 'GET' },
                    { name: `GET-pairing-code-Connect-${n}`, url: getUrl(`/instance/connect/pairing-code/${n}?number=${phoneNumber}`), method: 'GET' },
                    { name: `GET-pairingCode-Direct-${n}`, url: getUrl(`/instance/pairingCode/${n}?number=${phoneNumber}`), method: 'GET' }
                )
            }

            let lastResult = null;
            let success = false;
            const failures: any[] = [];

            for (const ep of endpoints) {
                console.log(`[WhatsApp-Evolution] Hunter trying ${ep.name}: ${ep.method}`)
                try {
                    const response = await fetch(ep.url, {
                        method: ep.method,
                        headers: getHeaders(),
                        body: ep.body ? JSON.stringify(ep.body) : undefined
                    })

                    const text = await response.text();
                    let resBody;
                    try { resBody = JSON.parse(text); } catch { resBody = { raw: text }; }

                    if (response.ok) {
                        result = resBody
                        success = true
                        console.log(`[WhatsApp-Evolution] Success with ${ep.name}`)
                        break
                    } else {
                        failures.push({ ep: ep.name, status: response.status, res: resBody })
                    }
                } catch (e: any) {
                    failures.push({ ep: ep.name, error: e.message })
                }
            }

            if (!success) {
                return new Response(JSON.stringify({
                    error: 'Super Hunter falhou. Nenhum padrão de pareamento reconhecido pelo seu servidor.',
                    debug: failures,
                    instance: name
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 502
                })
            }
        }

        else if (action === 'GET_STATUS') {
            console.log('[WhatsApp-Evolution] Checking status for instance:', name)
            const url = getUrl(`/instance/connectionState/${name}`)
            const response = await fetch(url, {
                method: 'GET',
                headers: getHeaders(),
            })

            if (response.ok) {
                result = await response.json()
                const instanceStatus = (result as any).instance?.state || (result as any).state

                console.log(`[WhatsApp-Evolution] Status for ${name}:`, instanceStatus)

                // Update database if status is "open" (connected in our system)
                if (instanceStatus === 'open') {
                    await supabase.from('whatsapp_connections' as any).upsert({
                        user_id: userId,
                        instance_name: name,
                        status: 'connected',
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id, instance_name' });
                } else if (instanceStatus === 'close' || instanceStatus === 'connecting') {
                    await supabase.from('whatsapp_connections' as any).upsert({
                        user_id: userId,
                        instance_name: name,
                        status: 'connecting',
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id, instance_name' });
                }
            } else {
                const text = await response.text()
                console.error(`[WhatsApp-Evolution] GET_STATUS failed: ${response.status}`, text)
                throw new Error(`Failed to get status: ${response.status}`)
            }
        }

        else if (action === 'LOGOUT_INSTANCE') {
            console.log('[WhatsApp-Evolution] Logging out instance:', name)
            const url = getUrl(`/instance/logout/${name}`)
            const response = await fetch(url, {
                method: 'DELETE',
                headers: getHeaders(),
            })
            result = await response.json()
        }

        else if (action === 'DELETE_INSTANCE') {
            console.log('[WhatsApp-Evolution] Deleting instance:', name)
            const url = getUrl(`/instance/delete/${name}`)
            const response = await fetch(url, {
                method: 'DELETE',
                headers: getHeaders(),
            })
            result = await response.json()

            // Remover do banco
            await supabase.from('whatsapp_connections' as any)
                .delete()
                .eq('user_id', userId)
                .eq('instance_name', name);
        }


        else if (action === 'SEND_MESSAGE') {
            const { groupId, text } = body
            if (!groupId || !text) throw new Error('groupId and text are required for SEND_MESSAGE')
            console.log('[WhatsApp-Evolution] SEND_MESSAGE to ' + groupId + ' via ' + name)

            const sendUrl = getUrl('/message/sendText/' + name)
            const isGroup = String(groupId).includes('@g.us')

            // Attempt 1: Direct send
            let sendRes = await fetch(sendUrl, {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: groupId, text })
            })
            let sendBody = await sendRes.text()
            console.log('[WhatsApp-Evolution] Direct send status: ' + sendRes.status + ' body: ' + sendBody.substring(0, 200))

            const isSessionErr = (b: string) => b.includes('SessionError') || b.includes('No sessions')

            // Attempt 2: Baileys group SessionError - send individually to each participant
            if (!sendRes.ok && isGroup && isSessionErr(sendBody)) {
                console.log('[WhatsApp-Evolution] SessionError on group - fetching participants...')
                const allGroupsUrl = getUrl('/group/fetchAllGroups/' + name + '?getParticipants=true')
                const gpRes = await fetch(allGroupsUrl, { method: 'GET', headers: getHeaders() })
                const gpBody = await gpRes.text()
                console.log('[WhatsApp-Evolution] fetchAllGroups status: ' + gpRes.status)

                let participantsSent = 0
                const participantErrors: string[] = []

                if (gpRes.ok) {
                    let groups: any[] = []
                    try { groups = JSON.parse(gpBody) } catch {}
                    const targetGroup = Array.isArray(groups) ? groups.find((g: any) => g.id === groupId) : null
                    const participants: any[] = targetGroup?.participants || []
                    console.log('[WhatsApp-Evolution] participants found: ' + participants.length)

                    for (const p of participants) {
                        const jid: string = p.id || (typeof p === 'string' ? p : '')
                        if (!jid || jid.includes('@g.us') || jid.includes('@broadcast')) continue
                        const number = jid.replace('@s.whatsapp.net', '')
                        if (!number) continue
                        const pRes = await fetch(sendUrl, {
                            method: 'POST',
                            headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                            body: JSON.stringify({ number, text })
                        })
                        const pBody = await pRes.text()
                        console.log('[WhatsApp-Evolution] -> ' + number + ': ' + pRes.status)
                        if (pRes.ok) participantsSent++
                        else participantErrors.push(number + ': ' + pBody.substring(0, 60))
                    }
                }

                if (participantsSent > 0) {
                    result = { success: true, method: 'per_participant', sent: participantsSent, errors: participantErrors }
                } else {
                    throw new Error('SessionError no grupo. Nao foi possivel enviar individualmente. Erro: ' + sendBody)
                }
            } else if (!sendRes.ok) {
                throw new Error('sendText failed (' + sendRes.status + '): ' + sendBody)
            } else {
                try { result = JSON.parse(sendBody) } catch { result = { raw: sendBody, success: true } }
            }
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error('[WhatsApp-Evolution] Fatal Error:', error.message)
        console.error('[WhatsApp-Evolution] Error stack:', error.stack)
        return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack,
            hint: 'Verifique se a EVOLUTION_API_URL e KEY estão corretas no console do Supabase.'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
}))
