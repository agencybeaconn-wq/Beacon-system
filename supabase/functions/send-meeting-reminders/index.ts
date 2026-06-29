/**
 * send-meeting-reminders — Disparo de lembretes de reuniao via WhatsApp.
 *
 * Fluxo:
 *  1. pg_cron invoca este endpoint a cada minuto (service_role via pg_net).
 *  2. Busca rows em `meeting_reminders` com remind_30_at <= now() AND sent_30_at IS NULL
 *     (e o mesmo para remind_10_at / sent_10_at).
 *  3. Janela de 2 horas no passado para evitar reenvios retroativos apos downtime longo.
 *  4. Para cada row envia mensagem via Evolution API e marca sent_30_at / sent_10_at.
 *
 * Reuso: segue o mesmo padrao de [notify-task-assigned/index.ts] para buscar a instancia
 * WhatsApp conectada do workspace owner (tabela `whatsapp_connections`).
 */

import { instrument } from "../_shared/logger.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.jotabot.site'
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''
const BATCH_LIMIT = 100
const LOOKBACK_HOURS = 2

interface ReminderRow {
    id: string
    workspace_id: string
    team_member_id: string
    occurrence_start: string
    phone_snapshot: string
    meet_link: string | null
    summary: string
}

interface SendOutcome {
    id: string
    ok: boolean
    reason?: string
}

function formatTime(iso: string): string {
    try {
        const d = new Date(iso)
        return d.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
        })
    } catch {
        return ''
    }
}

function buildMessage(row: ReminderRow, minutes: 30 | 10): string {
    const horario = formatTime(row.occurrence_start)
    const lines = [
        `Lembrete: *${row.summary}* em ${minutes} minutos${horario ? ` (${horario})` : ''}.`,
    ]
    if (row.meet_link) {
        lines.push(`Meet: ${row.meet_link}`)
    }
    return lines.join('\n')
}

async function getInstanceName(
    supabase: SupabaseClient,
    workspaceId: string,
    cache: Map<string, string | null>,
): Promise<string | null> {
    if (cache.has(workspaceId)) return cache.get(workspaceId) ?? null

    const { data: ws } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .single()

    if (!ws?.owner_id) {
        cache.set(workspaceId, null)
        return null
    }

    const { data: waConn } = await supabase
        .from('whatsapp_connections')
        .select('instance_name')
        .eq('user_id', ws.owner_id)
        .eq('status', 'connected')
        .maybeSingle()

    const instance = waConn?.instance_name ?? null
    cache.set(workspaceId, instance)
    return instance
}

async function sendWhatsApp(instance: string, phone: string, text: string): Promise<boolean> {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({ number: phone, text }),
    })

    if (!res.ok) {
        const body = await res.text()
        console.error(`[send-meeting-reminders] Evolution ${res.status}: ${body}`)
        return false
    }
    return true
}

async function processSlot(
    supabase: SupabaseClient,
    slot: 30 | 10,
    instanceCache: Map<string, string | null>,
): Promise<SendOutcome[]> {
    const remindColumn = slot === 30 ? 'remind_30_at' : 'remind_10_at'
    const sentColumn = slot === 30 ? 'sent_30_at' : 'sent_10_at'

    const nowIso = new Date().toISOString()
    const lookbackIso = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()

    const { data: rows, error } = await supabase
        .from('meeting_reminders')
        .select('id, workspace_id, team_member_id, occurrence_start, phone_snapshot, meet_link, summary')
        .lte(remindColumn, nowIso)
        .gte(remindColumn, lookbackIso)
        .is(sentColumn, null)
        .limit(BATCH_LIMIT)

    if (error) {
        console.error(`[send-meeting-reminders] fetch ${slot}min error:`, error)
        return []
    }

    if (!rows || rows.length === 0) return []

    const outcomes: SendOutcome[] = []

    for (const row of rows as ReminderRow[]) {
        const instance = await getInstanceName(supabase, row.workspace_id, instanceCache)
        if (!instance || !EVOLUTION_API_KEY) {
            outcomes.push({ id: row.id, ok: false, reason: 'no-instance' })
            continue
        }

        const text = buildMessage(row, slot)
        const sent = await sendWhatsApp(instance, row.phone_snapshot, text)

        if (sent) {
            const { error: updError } = await supabase
                .from('meeting_reminders')
                .update({ [sentColumn]: new Date().toISOString() })
                .eq('id', row.id)

            if (updError) {
                console.error(`[send-meeting-reminders] update ${sentColumn} error:`, updError)
                outcomes.push({ id: row.id, ok: false, reason: 'update-failed' })
            } else {
                outcomes.push({ id: row.id, ok: true })
            }
        } else {
            outcomes.push({ id: row.id, ok: false, reason: 'evolution-failed' })
        }
    }

    return outcomes
}

Deno.serve(instrument("send-meeting-reminders", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

        if (!supabaseUrl || !serviceRoleKey) {
            return new Response(
                JSON.stringify({ error: 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            )
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false },
        })

        const instanceCache = new Map<string, string | null>()

        const [slot30, slot10] = await Promise.all([
            processSlot(supabase, 30, instanceCache),
            processSlot(supabase, 10, instanceCache),
        ])

        const sent30 = slot30.filter((o) => o.ok).length
        const sent10 = slot10.filter((o) => o.ok).length
        const errors = [...slot30, ...slot10].filter((o) => !o.ok)

        console.log(`[send-meeting-reminders] sent30=${sent30} sent10=${sent10} errors=${errors.length}`)

        return new Response(
            JSON.stringify({
                processed30: slot30.length,
                processed10: slot10.length,
                sent30,
                sent10,
                errors,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    } catch (err: unknown) {
        console.error('[send-meeting-reminders] fatal:', err)
        const message = err instanceof Error ? err.message : 'unknown error'
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    }
}))
