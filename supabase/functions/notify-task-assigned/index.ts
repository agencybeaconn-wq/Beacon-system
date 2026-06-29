import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.jotabot.site';
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

Deno.serve(instrument("notify-task-assigned", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    // --- AUTH dupla: X-Internal-Auth (chamada do trigger SQL) OU JWT (chamada do front) ---
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
        const { assignee_id, task_title, task_description, client_name, workspace_id, instance_name, due_date, priority, area, images, drive_links } = await req.json()

        if (!assignee_id || !task_title || !workspace_id) {
            return new Response(JSON.stringify({ error: 'Missing required fields: assignee_id, task_title, workspace_id' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Get assignee details
        const { data: member, error: memberError } = await supabase
            .from('team_members')
            .select('name, phone, whatsapp_notifications, email')
            .eq('user_id', assignee_id)
            .eq('workspace_id', workspace_id)
            .single()

        if (memberError || !member) {
            return new Response(JSON.stringify({ skipped: true, reason: 'Member not found' }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. Check if notifications are enabled
        if (!member.whatsapp_notifications) {
            return new Response(JSON.stringify({ skipped: true, reason: 'Notifications disabled for this member' }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 3. Check phone number
        if (!member.phone) {
            return new Response(JSON.stringify({ skipped: true, reason: 'No phone number registered' }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 4. Format phone for WhatsApp (remove spaces, dashes, ensure country code)
        let phone = member.phone.replace(/[\s\-\(\)\+]/g, '')
        if (!phone.startsWith('55')) phone = '55' + phone

        // 5. Build priority/area labels
        const priorityLabels: Record<string, string> = { low: '🟢 Baixa', medium: '🟡 Média', high: '🔴 Alta', critical: '🟣 Crítica' }
        const areaLabels: Record<string, string> = { traffic: 'Tráfego', design: 'Design', copy: 'Copy', strategy: 'Estratégia', dev: 'Desenvolvimento' }

        // Format due date
        let dueDateStr = ''
        if (due_date) {
            try {
                const d = new Date(due_date)
                dueDateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            } catch { dueDateStr = due_date }
        }

        // Build links list
        const linksArr = Array.isArray(drive_links) ? drive_links : []
        const linksText = linksArr.map((l: any) => `  🔗 ${l.title || 'Link'}: ${l.url}`).join('\n')

        // Build images list
        const imagesArr = Array.isArray(images) ? images : []
        const imagesText = imagesArr.map((url: string, i: number) => `  📎 Imagem ${i + 1}: ${url}`).join('\n')

        const message = [
            `📋 *Nova demanda atribuída a você!*`,
            ``,
            `*Título:* ${task_title}`,
            task_description ? `*Descrição:* ${task_description.substring(0, 500)}` : '',
            client_name ? `*Cliente:* ${client_name}` : '',
            priority ? `*Prioridade:* ${priorityLabels[priority] || priority}` : '',
            area ? `*Área:* ${areaLabels[area] || area}` : '',
            dueDateStr ? `*Prazo:* ${dueDateStr}` : '',
            linksText ? `\n*Links:*\n${linksText}` : '',
            imagesText ? `\n*Anexos:*\n${imagesText}` : '',
            ``,
            `Acesse o sistema para ver todos os detalhes.`,
        ].filter(Boolean).join('\n')

        // 6. Determine which WhatsApp instance to use
        let whatsappInstance = instance_name

        if (!whatsappInstance) {
            // Get workspace owner, then find their WhatsApp connection
            const { data: ws } = await supabase
                .from('workspaces')
                .select('owner_id')
                .eq('id', workspace_id)
                .single()

            if (ws?.owner_id) {
                const { data: waConn } = await supabase
                    .from('whatsapp_connections')
                    .select('instance_name')
                    .eq('user_id', ws.owner_id)
                    .eq('status', 'connected')
                    .maybeSingle()

                whatsappInstance = waConn?.instance_name
            }
        }

        if (!whatsappInstance || !EVOLUTION_API_KEY) {
            console.log('[NOTIFY] No WhatsApp instance or API key configured, skipping send')
            return new Response(JSON.stringify({ skipped: true, reason: 'No WhatsApp instance configured' }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 7. Send via Evolution API
        console.log(`[NOTIFY] Sending to ${member.name || member.email} (${phone}) via instance ${whatsappInstance}`)

        const sendRes = await fetch(`${EVOLUTION_API_URL}/message/sendText/${whatsappInstance}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({ number: phone, text: message })
        })

        const sendData = await sendRes.text()
        console.log(`[NOTIFY] WhatsApp response: ${sendRes.status}`)

        if (!sendRes.ok) {
            console.error(`[NOTIFY] WhatsApp send failed:`, sendData)
            return new Response(JSON.stringify({ sent: false, error: 'WhatsApp send failed', details: sendData }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 8. Send images as media messages (if any)
        if (imagesArr.length > 0) {
            for (const imageUrl of imagesArr) {
                try {
                    await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${whatsappInstance}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': EVOLUTION_API_KEY
                        },
                        body: JSON.stringify({
                            number: phone,
                            mediatype: 'image',
                            media: imageUrl,
                            caption: `📎 Anexo da demanda: ${task_title}`
                        })
                    })
                } catch (imgErr) {
                    console.warn(`[NOTIFY] Failed to send image:`, imgErr)
                }
            }
        }

        return new Response(JSON.stringify({ sent: true, to: member.name || member.email }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('[NOTIFY] Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
}))
