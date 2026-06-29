import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Notifica o grupo WhatsApp do cliente quando a AGÊNCIA atribui uma tarefa pro
// cliente executar (tabela client_assigned_tasks — feature "Atribuir ao Cliente").
// Input: { taskId: string }  (id em client_assigned_tasks)
// Disparado pelo trigger SQL notify_on_assigned_task (X-Internal-Auth) ou pelo front (JWT).

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.jotabot.site'
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''
const PORTAL_URL = Deno.env.get('PORTAL_URL') || 'https://app.leverag.digital'

const PRIORITY_LABELS: Record<string, string> = {
    low: '🟢 Baixa',
    medium: '🟡 Média',
    high: '🔴 Alta',
    critical: '🟣 Urgente',
}

const DONE_STATUSES = new Set(['done', 'concluido', 'completed'])

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    const internalAuth = req.headers.get('x-internal-auth')
    const internalSecret = Deno.env.get('LEVER_MCP_INTERNAL_SECRET')
    const isInternalCall = !!(internalAuth && internalSecret && internalAuth === internalSecret)

    if (!isInternalCall) {
        const authHeader = req.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        if (!token) {
            return new Response(JSON.stringify({ error: 'Not authenticated' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }
        const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey)
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }
    }

    try {
        const { taskId } = await req.json()
        if (!taskId) {
            return new Response(JSON.stringify({ error: 'taskId is required' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Carregar a tarefa atribuída
        const { data: task, error: taskError } = await supabase
            .from('client_assigned_tasks')
            .select('id, title, description, priority, status, category, client_id, workspace_id')
            .eq('id', taskId)
            .single()

        if (taskError || !task) {
            return new Response(JSON.stringify({ error: 'Tarefa não encontrada', details: taskError?.message }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (DONE_STATUSES.has(String(task.status))) {
            return new Response(JSON.stringify({ skipped: true, reason: 'Tarefa já concluída' }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. Cliente + grupo WhatsApp
        const { data: client, error: clientError } = await supabase
            .from('agency_clients')
            .select('name, whatsapp_group_jid')
            .eq('id', task.client_id)
            .single()

        if (clientError || !client) {
            return new Response(JSON.stringify({ error: 'Cliente não encontrado' }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }
        if (!client.whatsapp_group_jid) {
            return new Response(JSON.stringify({ skipped: true, reason: 'Cliente sem grupo WhatsApp' }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 3. Instância WhatsApp do workspace owner
        const { data: ws } = await supabase
            .from('workspaces')
            .select('owner_id')
            .eq('id', task.workspace_id)
            .single()

        let instanceName: string | null = null
        if (ws?.owner_id) {
            const { data: conn } = await supabase
                .from('whatsapp_connections')
                .select('instance_name')
                .eq('user_id', ws.owner_id)
                .eq('status', 'connected')
                .maybeSingle()
            instanceName = conn?.instance_name || null
        }

        if (!instanceName || !EVOLUTION_API_KEY) {
            return new Response(JSON.stringify({ skipped: true, reason: 'Sem instância WhatsApp configurada' }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 4. Mensagem (tom de atendente humana pedindo uma ação ao cliente)
        const lines: string[] = []
        lines.push(`Olá pessoal, tudo bem? 👋`)
        lines.push(``)
        lines.push(`Temos uma *tarefa* que precisa de vocês pra seguirmos 👇`)
        lines.push(``)
        lines.push(`*${task.title}*`)
        if (task.description) {
            const desc = task.description.length > 600 ? task.description.substring(0, 600) + '...' : task.description
            lines.push(``)
            lines.push(desc)
        }
        if (task.priority && PRIORITY_LABELS[task.priority]) {
            lines.push(``)
            lines.push(`*Prioridade:* ${PRIORITY_LABELS[task.priority]}`)
        }
        lines.push(``)
        lines.push(`👉 Acessem o portal pra resolver e marcar como concluído:`)
        lines.push(`${PORTAL_URL.replace(/\/$/, '')}/portal/my-tasks`)
        lines.push(``)
        lines.push(`Qualquer dúvida, é só chamar. Valeu! 🙌`)

        const message = lines.join('\n')

        const sendRes = await fetch(`${EVOLUTION_API_URL.replace(/\/$/, '')}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
            body: JSON.stringify({ number: client.whatsapp_group_jid, text: message }),
        })

        const sendBody = await sendRes.text()
        if (!sendRes.ok) {
            console.error(`[notify-client-demand] Send failed ${sendRes.status}: ${sendBody}`)
            return new Response(JSON.stringify({ sent: false, error: 'WhatsApp send failed', status: sendRes.status, details: sendBody }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        console.log(`[notify-client-demand] assigned_task=${taskId} enviado pro grupo ${client.whatsapp_group_jid}`)
        return new Response(JSON.stringify({ sent: true, group: client.whatsapp_group_jid, clientName: client.name }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('[notify-client-demand] Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
