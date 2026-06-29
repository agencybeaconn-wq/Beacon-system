import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Lista grupos WhatsApp da instancia Evolution conectada ao workspace.
// Uso: front chama isso pra popular o picker de grupos no cadastro/edicao de cliente.

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.jotabot.site'
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''

interface EvolutionGroup {
    id: string
    subject?: string
    size?: number
    creation?: number
}

interface NormalizedGroup {
    jid: string
    name: string
    participantCount: number
}

Deno.serve(instrument("list-whatsapp-groups", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // --- AUTH: validar JWT do usuario ---
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey)
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    try {
        if (!EVOLUTION_API_KEY) {
            throw new Error('EVOLUTION_API_KEY environment variable is not set')
        }

        const body = await req.json().catch(() => ({}))
        const explicitInstance: string | undefined = body?.instanceName

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Resolve instanceName: payload > whatsapp_connections do user
        let instanceName = explicitInstance

        if (!instanceName) {
            const { data: conn } = await supabase
                .from('whatsapp_connections')
                .select('instance_name')
                .eq('user_id', user.id)
                .eq('status', 'connected')
                .maybeSingle()

            instanceName = conn?.instance_name
        }

        if (!instanceName) {
            return new Response(JSON.stringify({
                error: 'Sem instancia WhatsApp conectada',
                hint: 'Conecte uma instancia em Configuracoes > WhatsApp antes de listar grupos.'
            }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        console.log(`[list-whatsapp-groups] User ${user.id} instance=${instanceName}`)

        // Evolution API: GET /group/fetchAllGroups/{instance}?getParticipants=false
        const url = `${EVOLUTION_API_URL.replace(/\/$/, '')}/group/fetchAllGroups/${instanceName}?getParticipants=false`
        const res = await fetch(url, {
            method: 'GET',
            headers: { 'apikey': EVOLUTION_API_KEY }
        })

        const responseText = await res.text()
        if (!res.ok) {
            console.error(`[list-whatsapp-groups] Evolution responded ${res.status}: ${responseText}`)
            return new Response(JSON.stringify({
                error: 'Evolution API error',
                status: res.status,
                details: responseText
            }), {
                status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        let raw: any
        try {
            raw = JSON.parse(responseText)
        } catch {
            console.error(`[list-whatsapp-groups] Non-JSON response: ${responseText}`)
            return new Response(JSON.stringify({ error: 'Unexpected Evolution response' }), {
                status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Evolution v2 retorna array direto; algumas versoes retornam { groups: [...] }
        const rawGroups: EvolutionGroup[] = Array.isArray(raw)
            ? raw
            : (Array.isArray(raw?.groups) ? raw.groups : [])

        const groups: NormalizedGroup[] = rawGroups
            .filter(g => g?.id?.endsWith?.('@g.us'))
            .map(g => ({
                jid: g.id,
                name: g.subject || '(sem nome)',
                participantCount: g.size || 0
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

        console.log(`[list-whatsapp-groups] ${groups.length} grupos retornados pra ${user.id}`)

        return new Response(JSON.stringify({ groups, instanceName }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('[list-whatsapp-groups] Error:', error)
        return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
}))
