import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Notifica grupo WhatsApp do cliente quando uma task em client_tasks vira "concluida".
// Input: { taskId: string }
// Disparado pelo frontend depois de marcar task como completed_at != null.

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.jotabot.site'
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''

const AREA_LABELS: Record<string, string> = {
    traffic: 'Tráfego',
    design: 'Design',
    copy: 'Copy',
    strategy: 'Estratégia',
    dev: 'Desenvolvimento',
    shopify: 'Shopify',
    ads: 'Anúncios',
    seo: 'SEO',
    email: 'Email',
}

Deno.serve(instrument("notify-task-completed", async (req: Request) => {
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
        const { taskId } = await req.json()
        if (!taskId) {
            return new Response(JSON.stringify({ error: 'taskId is required' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Carregar task + dados do cliente
        const { data: task, error: taskError } = await supabase
            .from('client_tasks')
            .select('id, title, description, area, completed_at, assignee_id, client_id, workspace_id, cover_image_url, images, drive_links')
            .eq('id', taskId)
            .single()

        if (taskError || !task) {
            return new Response(JSON.stringify({ error: 'Task nao encontrada', details: taskError?.message }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (!task.completed_at) {
            return new Response(JSON.stringify({ skipped: true, reason: 'Task ainda nao foi concluida' }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. Carregar cliente + grupo
        const { data: client, error: clientError } = await supabase
            .from('agency_clients')
            .select('name, whatsapp_group_jid, whatsapp_group_name')
            .eq('id', task.client_id)
            .single()

        if (clientError || !client) {
            return new Response(JSON.stringify({ error: 'Cliente nao encontrado' }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (!client.whatsapp_group_jid) {
            return new Response(JSON.stringify({ skipped: true, reason: 'Cliente sem grupo WhatsApp cadastrado' }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 3. Nome do responsavel (opcional)
        let assigneeName: string | null = null
        if (task.assignee_id) {
            const { data: member } = await supabase
                .from('team_members')
                .select('name')
                .eq('user_id', task.assignee_id)
                .eq('workspace_id', task.workspace_id)
                .maybeSingle()
            assigneeName = member?.name || null
        }

        // 4. Resolver instancia WhatsApp do workspace owner
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
            console.log('[notify-task-completed] Sem instancia ou API key, skip')
            return new Response(JSON.stringify({ skipped: true, reason: 'Sem instancia WhatsApp configurada' }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 5. Formatar data de conclusao em pt-BR (timezone do servidor da edge function = UTC)
        const completedDate = new Date(task.completed_at)
        const dateStr = completedDate.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        })

        // 6. Coletar anexos (drive_links + images + cover_image_url).
        //    drive_links: array de { title?, url } | string. images: array de URLs.
        const driveLinksRaw: any[] = Array.isArray(task.drive_links) ? task.drive_links : []
        const driveLinks = driveLinksRaw
            .map((l: any) => {
                if (typeof l === 'string') return { title: 'Link', url: l }
                if (l && typeof l.url === 'string') return { title: l.title || 'Link', url: l.url }
                return null
            })
            .filter((l: any) => l && l.url) as Array<{ title: string; url: string }>

        const imagesRaw: any[] = Array.isArray(task.images) ? task.images : []
        const imageUrls: string[] = imagesRaw
            .map((i: any) => (typeof i === 'string' ? i : i?.url))
            .filter((u: any) => typeof u === 'string' && u.length > 0)
        // cover_image_url entra como primeira imagem se existir e nao estiver duplicada
        if (task.cover_image_url && !imageUrls.includes(task.cover_image_url)) {
            imageUrls.unshift(task.cover_image_url)
        }

        // 7. Montar mensagem com tom de atendente humana.
        // - WhatsApp markdown: *negrito*, _italico_
        // - Linhas em branco entre blocos pra respiro visual
        // - Sem "Cliente" (a msg ja vai pro grupo dele) e sem mostrar quem concluiu
        //   na linha (mantem a impressao de que a atendente esta avisando em nome do time)
        const lines: string[] = []
        lines.push(`Olá pessoal, tudo bem? 👋`)
        lines.push(``)
        lines.push(`Passando pra avisar que mais uma demanda de vocês foi *concluída* ✅`)
        lines.push(``)
        lines.push(`*Título:* ${task.title}`)

        if (task.description) {
            const truncated = task.description.length > 500
                ? task.description.substring(0, 500) + '...'
                : task.description
            lines.push(``)
            lines.push(`*Descrição:*`)
            lines.push(truncated)
        }

        if (driveLinks.length > 0) {
            lines.push(``)
            lines.push(`*Links anexados:*`)
            for (const l of driveLinks) {
                lines.push(`🔗 ${l.title}: ${l.url}`)
            }
        }

        lines.push(``)
        if (task.area) {
            lines.push(`*Área:* ${AREA_LABELS[task.area] || task.area}`)
        }
        if (assigneeName) {
            lines.push(`*Responsável:* ${assigneeName}`)
        }
        lines.push(`*Concluída em:* ${dateStr}`)

        if (imageUrls.length > 0) {
            lines.push(``)
            lines.push(imageUrls.length === 1
                ? `📎 Anexo enviado a seguir.`
                : `📎 ${imageUrls.length} anexos enviados a seguir.`)
        }

        lines.push(``)
        lines.push(`Qualquer dúvida, estamos à disposição!`)
        lines.push(``)
        lines.push(`_Para novas demandas, acessem o portal Beacon_ 🚀`)

        const message = lines.join('\n')

        // 7. Enviar pro grupo via Evolution API
        console.log(`[notify-task-completed] task=${taskId} client=${client.name} group=${client.whatsapp_group_jid} instance=${instanceName}`)

        const sendRes = await fetch(`${EVOLUTION_API_URL.replace(/\/$/, '')}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
                number: client.whatsapp_group_jid,
                text: message,
            }),
        })

        const sendBody = await sendRes.text()
        if (!sendRes.ok) {
            console.error(`[notify-task-completed] Send failed ${sendRes.status}: ${sendBody}`)
            return new Response(JSON.stringify({
                sent: false,
                error: 'WhatsApp send failed',
                status: sendRes.status,
                details: sendBody
            }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 8. Enviar imagens como midia separada (best-effort, nao bloqueia retorno).
        let imagesSent = 0
        let imagesFailed = 0
        if (imageUrls.length > 0) {
            for (const imageUrl of imageUrls) {
                try {
                    const mediaRes = await fetch(`${EVOLUTION_API_URL.replace(/\/$/, '')}/message/sendMedia/${instanceName}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': EVOLUTION_API_KEY,
                        },
                        body: JSON.stringify({
                            number: client.whatsapp_group_jid,
                            mediatype: 'image',
                            media: imageUrl,
                            caption: `📎 Anexo da tarefa: ${task.title}`,
                        }),
                    })
                    if (mediaRes.ok) {
                        imagesSent++
                    } else {
                        imagesFailed++
                        const errText = await mediaRes.text()
                        console.warn(`[notify-task-completed] sendMedia falhou (${mediaRes.status}): ${errText}`)
                    }
                } catch (imgErr) {
                    imagesFailed++
                    console.warn(`[notify-task-completed] sendMedia exception:`, imgErr)
                }
            }
        }

        console.log(`[notify-task-completed] Enviado pra ${client.whatsapp_group_jid} | images sent=${imagesSent} failed=${imagesFailed}`)
        return new Response(JSON.stringify({
            sent: true,
            group: client.whatsapp_group_jid,
            clientName: client.name,
            images: { total: imageUrls.length, sent: imagesSent, failed: imagesFailed },
            links: driveLinks.length,
        }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('[notify-task-completed] Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
}))
