/**
 * Meeting Reminders — Expansao de ocorrencias e sync da tabela `meeting_reminders`.
 *
 * Responsabilidades:
 *  - Expandir uma RRULE simples (DAILY/WEEKDAYS/WEEKLY/MONTHLY/YEARLY) em N ocorrencias futuras.
 *  - Dado um evento do Google Calendar e os team_members vinculados, regenerar a lista de
 *    lembretes de WhatsApp na tabela `meeting_reminders` (delete + bulk insert).
 *  - Filtrar apenas funcionarios com `whatsapp_notifications = true` e `phone` preenchido.
 *
 * A edge function `send-meeting-reminders` consome as rows resultantes via pg_cron.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WINDOW_DAYS = 90
const MAX_OCCURRENCES = 180

// ─── Normalizacao de telefone ──────────────────────────────────────────────────

export function normalizePhone(raw: string | null | undefined): string | null {
    if (!raw) return null
    const digits = raw.replace(/[\s\-\(\)\+]/g, '')
    if (!digits) return null
    return digits.startsWith('55') ? digits : '55' + digits
}

// ─── Expansao de RRULE ─────────────────────────────────────────────────────────

type RRuleFreq = 'DAILY' | 'WEEKLY' | 'WEEKDAYS' | 'MONTHLY' | 'YEARLY' | null

function parseRRule(rules: string[] | undefined | null): RRuleFreq {
    if (!rules || rules.length === 0) return null
    const rule = rules.find((r) => r.toUpperCase().startsWith('RRULE:'))
    if (!rule) return null
    const upper = rule.toUpperCase()
    if (upper.includes('FREQ=WEEKLY') && upper.includes('BYDAY=MO,TU,WE,TH,FR')) return 'WEEKDAYS'
    if (upper.includes('FREQ=DAILY')) return 'DAILY'
    if (upper.includes('FREQ=WEEKLY')) return 'WEEKLY'
    if (upper.includes('FREQ=MONTHLY')) return 'MONTHLY'
    if (upper.includes('FREQ=YEARLY')) return 'YEARLY'
    return null
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date)
    next.setUTCDate(next.getUTCDate() + days)
    return next
}

function addMonths(date: Date, months: number): Date {
    const next = new Date(date)
    next.setUTCMonth(next.getUTCMonth() + months)
    return next
}

function addYears(date: Date, years: number): Date {
    const next = new Date(date)
    next.setUTCFullYear(next.getUTCFullYear() + years)
    return next
}

export function expandOccurrences(
    startDateTime: string,
    recurrence: string[] | undefined | null,
    windowDays: number = WINDOW_DAYS,
): Date[] {
    const base = new Date(startDateTime)
    if (Number.isNaN(base.getTime())) return []

    const now = Date.now()
    const horizon = now + windowDays * 24 * 60 * 60 * 1000
    const freq = parseRRule(recurrence)

    // Evento unico: so a propria data
    if (!freq) {
        return base.getTime() >= now ? [base] : []
    }

    const out: Date[] = []
    let cursor = base

    while (cursor.getTime() <= horizon && out.length < MAX_OCCURRENCES) {
        const isWeekday = cursor.getUTCDay() >= 1 && cursor.getUTCDay() <= 5
        const include = freq === 'WEEKDAYS' ? isWeekday : true
        if (include && cursor.getTime() >= now) {
            out.push(new Date(cursor))
        }

        switch (freq) {
            case 'DAILY':
            case 'WEEKDAYS':
                cursor = addDays(cursor, 1)
                break
            case 'WEEKLY':
                cursor = addDays(cursor, 7)
                break
            case 'MONTHLY':
                cursor = addMonths(cursor, 1)
                break
            case 'YEARLY':
                cursor = addYears(cursor, 1)
                break
        }
    }

    return out
}

// ─── Sync da tabela `meeting_reminders` ────────────────────────────────────────

interface SyncInput {
    workspaceId: string
    googleEventId: string
    teamMemberIds: string[]
    summary: string
    meetLink: string | null
    startDateTime: string
    recurrence?: string[] | null
}

interface SyncResult {
    deleted: number
    inserted: number
    skipped: { reason: string; teamMemberId: string }[]
}

export async function deleteMeetingReminders(
    supabase: SupabaseClient,
    workspaceId: string,
    googleEventId: string,
): Promise<number> {
    const { data, error } = await supabase
        .from('meeting_reminders')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('google_event_id', googleEventId)
        .select('id')

    if (error) {
        console.error('[reminders] delete error:', error)
        return 0
    }
    return data?.length ?? 0
}

export async function syncMeetingReminders(
    supabase: SupabaseClient,
    input: SyncInput,
): Promise<SyncResult> {
    const { workspaceId, googleEventId, teamMemberIds, summary, meetLink, startDateTime, recurrence } = input

    const result: SyncResult = { deleted: 0, inserted: 0, skipped: [] }

    // 1. Limpar reminders antigos deste evento (sempre regenera — simples e correto para updates).
    result.deleted = await deleteMeetingReminders(supabase, workspaceId, googleEventId)

    if (!teamMemberIds || teamMemberIds.length === 0) {
        return result
    }

    // 2. Buscar team_members elegiveis: flag on + phone preenchido + mesmo workspace.
    // Frontend envia user_id (auth.users.id) no array — filtramos por user_id OU id
    // pra ser tolerante a qual identificador o caller usou.
    const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('id, user_id, name, phone, whatsapp_notifications')
        .or(`id.in.(${teamMemberIds.join(',')}),user_id.in.(${teamMemberIds.join(',')})`)
        .eq('workspace_id', workspaceId)

    if (membersError) {
        console.error('[reminders] fetch team_members error:', membersError)
        return result
    }

    const eligible: { id: string; phone: string }[] = []
    for (const m of members ?? []) {
        const member = m as { id: string; phone: string | null; whatsapp_notifications: boolean | null }
        if (!member.whatsapp_notifications) {
            result.skipped.push({ reason: 'whatsapp_notifications off', teamMemberId: member.id })
            continue
        }
        const phone = normalizePhone(member.phone)
        if (!phone) {
            result.skipped.push({ reason: 'phone ausente', teamMemberId: member.id })
            continue
        }
        eligible.push({ id: member.id, phone })
    }

    if (eligible.length === 0) return result

    // 3. Expandir ocorrencias futuras (janela 90 dias).
    const occurrences = expandOccurrences(startDateTime, recurrence ?? null)
    if (occurrences.length === 0) return result

    // 4. Montar rows: member X ocorrencia.
    const rows: Record<string, unknown>[] = []
    for (const occ of occurrences) {
        const remind30 = new Date(occ.getTime() - 30 * 60 * 1000).toISOString()
        const remind10 = new Date(occ.getTime() - 10 * 60 * 1000).toISOString()
        const occIso = occ.toISOString()
        for (const e of eligible) {
            rows.push({
                workspace_id: workspaceId,
                google_event_id: googleEventId,
                team_member_id: e.id,
                occurrence_start: occIso,
                remind_30_at: remind30,
                remind_10_at: remind10,
                phone_snapshot: e.phone,
                meet_link: meetLink,
                summary,
            })
        }
    }

    // 5. Bulk insert (upsert em caso de race com outra execucao).
    const { error: insertError, count } = await supabase
        .from('meeting_reminders')
        .upsert(rows, {
            onConflict: 'workspace_id,google_event_id,team_member_id,occurrence_start',
            count: 'exact',
        })

    if (insertError) {
        console.error('[reminders] insert error:', insertError)
        return result
    }

    result.inserted = count ?? rows.length
    return result
}

// ─── Notificacao imediata na criacao/edicao do evento ──────────────────────────
//
// Diferente dos lembretes 30/10min (agendados via tabela), esta funcao envia AGORA
// para cada team_member vinculado avisando que ele foi adicionado a uma reuniao.
// Tambem dispara em updateMeeting para casos em que um novo participante foi vinculado.

interface NotifyInput {
    workspaceId: string
    teamMemberIds: string[]
    summary: string
    startDateTime: string
    meetLink: string | null
    action: 'createMeeting' | 'updateMeeting'
    recurrence?: string[] | null
}

interface NotifyResult { sent: number; skipped: number; errors: number }

async function getEvolutionInstance(supabase: SupabaseClient, workspaceId: string): Promise<string | null> {
    const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', workspaceId).single()
    if (!ws?.owner_id) return null
    const { data: waConn } = await supabase
        .from('whatsapp_connections')
        .select('instance_name')
        .eq('user_id', ws.owner_id)
        .eq('status', 'connected')
        .maybeSingle()
    return (waConn as { instance_name?: string } | null)?.instance_name ?? null
}

async function sendEvolutionMessage(instance: string, phone: string, text: string): Promise<boolean> {
    const baseUrl = (Deno.env.get('EVOLUTION_API_URL') || 'https://evo.jotabot.site').replace(/\/$/, '')
    const apikey = Deno.env.get('EVOLUTION_API_KEY') || ''
    if (!apikey) {
        console.error('[notify] EVOLUTION_API_KEY ausente')
        return false
    }
    try {
        const res = await fetch(`${baseUrl}/message/sendText/${instance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey },
            body: JSON.stringify({ number: phone, text }),
        })
        if (!res.ok) {
            const body = await res.text()
            console.error(`[notify] Evolution ${res.status}: ${body}`)
            return false
        }
        return true
    } catch (e) {
        console.error('[notify] send falhou:', e)
        return false
    }
}

function formatDateTimePt(iso: string): string {
    try {
        const d = new Date(iso)
        return d.toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
        })
    } catch {
        return iso
    }
}

function describeRecurrence(rules: string[] | null | undefined): string | null {
    if (!rules || rules.length === 0) return null
    const rule = rules.find((r) => r.toUpperCase().startsWith('RRULE:'))
    if (!rule) return null
    const u = rule.toUpperCase()
    if (u.includes('FREQ=WEEKLY') && u.includes('BYDAY=MO,TU,WE,TH,FR')) return 'segunda a sexta'
    if (u.includes('FREQ=DAILY')) return 'todos os dias'
    if (u.includes('FREQ=WEEKLY')) return 'toda semana'
    if (u.includes('FREQ=MONTHLY')) return 'todo mes'
    if (u.includes('FREQ=YEARLY')) return 'todo ano'
    return null
}

export async function notifyAttendeesAdded(supabase: SupabaseClient, input: NotifyInput): Promise<NotifyResult> {
    const result: NotifyResult = { sent: 0, skipped: 0, errors: 0 }
    if (!input.teamMemberIds || input.teamMemberIds.length === 0) return result

    const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('id, user_id, name, phone, whatsapp_notifications')
        .or(`id.in.(${input.teamMemberIds.join(',')}),user_id.in.(${input.teamMemberIds.join(',')})`)
        .eq('workspace_id', input.workspaceId)

    if (membersError) {
        console.error('[notify] fetch team_members erro:', membersError)
        return result
    }
    if (!members || members.length === 0) return result

    const instance = await getEvolutionInstance(supabase, input.workspaceId)
    if (!instance) {
        console.log('[notify] sem instancia Evolution conectada — pulando')
        return result
    }

    const horario = formatDateTimePt(input.startDateTime)
    const recur = describeRecurrence(input.recurrence ?? null)
    const verb = input.action === 'createMeeting'
        ? 'Voce foi vinculado a uma nova reuniao'
        : 'Reuniao atualizada — voce esta vinculado'

    for (const m of members as Array<{ id: string; name: string | null; phone: string | null; whatsapp_notifications: boolean | null }>) {
        if (!m.whatsapp_notifications) { result.skipped++; continue }
        const phone = normalizePhone(m.phone)
        if (!phone) { result.skipped++; continue }

        const lines: string[] = [
            `*${verb}*`,
            '',
            `Reuniao: *${input.summary}*`,
            `Quando: ${horario}${recur ? ` (${recur})` : ''}`,
        ]
        if (input.meetLink) lines.push(`Meet: ${input.meetLink}`)
        lines.push('', 'Voce recebera lembretes 30 e 10 minutos antes.')

        const ok = await sendEvolutionMessage(instance, phone, lines.join('\n'))
        if (ok) result.sent++; else result.errors++
    }

    return result
}
