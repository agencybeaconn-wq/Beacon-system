// ════════════════════════════════════════════════════════════════════════════
// system-alert-dispatcher — Envia os erros de producao pro grupo WhatsApp.
//
// Invocada por pg_cron a cada 1 min (--no-verify-jwt, idempotente). Le os logs
// de erro pendentes, AGRUPA por error_signature (coalescencia) e aplica RATE CAP
// antes de mandar — e isso que torna "todo erro notifica" sobrevivivel: 23 erros
// iguais viram 1 linha "×23", nao 23 mensagens.
//
// Destino configuravel: system_settings (alert_instance_name + alert_group_jid),
// definido na UI admin. Envio reusa o endpoint da Evolution (sendText), igual
// send-meeting-reminders. Grupo entra no campo `number` como JID ...@g.us.
// ════════════════════════════════════════════════════════════════════════════

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Funcao server-to-server (chamada pelo pg_cron via pg_net). Sem browser → sem
// CORS. Respostas JSON simples; ninguem faz preflight.
const JSON_HEADERS = { 'Content-Type': 'application/json' }

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.jotabot.site'
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || ''
const SELECT_LIMIT = 300

interface SystemSettings {
    alert_enabled: boolean
    alert_instance_name: string | null
    alert_group_jid: string | null
    rate_limit_per_min: number
}

interface LogRow {
    id: string
    function_name: string
    action: string
    severity: 'error' | 'critical'
    message: string
    error_signature: string | null
    created_at: string
}

interface Group {
    signature: string
    functionName: string
    action: string
    message: string
    severity: 'error' | 'critical'
    count: number
    lastAt: string
    ids: string[]
}

function severityRank(s: 'error' | 'critical'): number {
    return s === 'critical' ? 3 : 2
}

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
        })
    } catch {
        return ''
    }
}

// Agrupa por assinatura: cada erro recorrente vira UMA entrada com contagem.
function groupBySignature(rows: LogRow[]): Group[] {
    const map = new Map<string, Group>()
    for (const row of rows) {
        const sig = row.error_signature || `${row.function_name}|${row.action}|${row.message}`
        const existing = map.get(sig)
        if (existing) {
            existing.count++
            existing.ids.push(row.id)
            if (row.created_at > existing.lastAt) existing.lastAt = row.created_at
            if (severityRank(row.severity) > severityRank(existing.severity)) existing.severity = row.severity
        } else {
            map.set(sig, {
                signature: sig,
                functionName: row.function_name,
                action: row.action,
                message: row.message,
                severity: row.severity,
                count: 1,
                lastAt: row.created_at,
                ids: [row.id],
            })
        }
    }
    // Mais grave e mais frequente primeiro.
    return [...map.values()].sort(
        (a, b) => severityRank(b.severity) - severityRank(a.severity) || b.count - a.count,
    )
}

function buildMessage(groups: Group[], rateLimit: number): string {
    const shown = groups.slice(0, rateLimit)
    const overflow = groups.length - shown.length

    const lines: string[] = ['🔔 *Beacon — Alertas do sistema*', '']
    for (const g of shown) {
        const icon = g.severity === 'critical' ? '🔴' : '⚠️'
        const times = g.count > 1 ? ` (×${g.count})` : ''
        lines.push(`${icon} *[${g.functionName}]* ${g.action}`)
        lines.push(`   ${g.message}${times} · último ${formatTime(g.lastAt)}`)
    }
    if (overflow > 0) {
        lines.push('')
        lines.push(`➕ +${overflow} outros tipos de erro — ver painel em /agency/logs`)
    }
    return lines.join('\n')
}

async function sendToGroup(instance: string, groupJid: string, text: string): Promise<boolean> {
    const res = await fetch(`${EVOLUTION_API_URL.replace(/\/$/, '')}/message/sendText/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({ number: groupJid, text }),
    })
    if (!res.ok) {
        const body = await res.text()
        console.error(`[system-alert-dispatcher] Evolution ${res.status}: ${body}`)
        return false
    }
    return true
}

async function markAlerted(supabase: SupabaseClient, ids: string[], status: 'sent' | 'skipped'): Promise<void> {
    if (ids.length === 0) return
    const { error } = await supabase
        .from('system_logs')
        .update({ alert_status: status, alerted_at: new Date().toISOString() })
        .in('id', ids)
    if (error) console.error(`[system-alert-dispatcher] erro ao marcar ${status}:`, error.message)
}

Deno.serve(async (_req: Request) => {
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        if (!supabaseUrl || !serviceRoleKey) {
            return new Response(JSON.stringify({ error: 'envs ausentes' }), {
                status: 500,
                headers: JSON_HEADERS,
            })
        }
        const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

        // 1. Config de destino.
        const { data: settings } = await supabase
            .from('system_settings')
            .select('alert_enabled, alert_instance_name, alert_group_jid, rate_limit_per_min')
            .eq('id', 1)
            .maybeSingle<SystemSettings>()

        // 2. Erros pendentes de PRODUCAO (alerta nao se aplica a dev/local).
        const { data: rows, error: selErr } = await supabase
            .from('system_logs')
            .select('id, function_name, action, severity, message, error_signature, created_at')
            .eq('alert_status', 'pending')
            .eq('environment', 'production')
            .in('severity', ['error', 'critical'])
            .order('created_at', { ascending: true })
            .limit(SELECT_LIMIT)

        if (selErr) {
            return new Response(JSON.stringify({ error: selErr.message }), {
                status: 500,
                headers: JSON_HEADERS,
            })
        }

        const pending = (rows ?? []) as LogRow[]
        if (pending.length === 0) {
            return new Response(JSON.stringify({ processed: 0 }), {
                status: 200,
                headers: JSON_HEADERS,
            })
        }

        const allIds = pending.map((r) => r.id)

        // 3. Alerta desligado ou destino nao configurado → marca skipped e sai.
        //    (Evita backlog infinito; quando ligar, so erros novos alertam.)
        if (!settings?.alert_enabled || !settings.alert_instance_name || !settings.alert_group_jid || !EVOLUTION_API_KEY) {
            await markAlerted(supabase, allIds, 'skipped')
            return new Response(JSON.stringify({ skipped: allIds.length, reason: 'alert disabled or unconfigured' }), {
                status: 200,
                headers: JSON_HEADERS,
            })
        }

        // 4. Coalescencia + rate cap.
        const groups = groupBySignature(pending)
        const rateLimit = settings.rate_limit_per_min > 0 ? settings.rate_limit_per_min : 10
        const text = buildMessage(groups, rateLimit)

        // 5. Envia.
        const ok = await sendToGroup(settings.alert_instance_name, settings.alert_group_jid, text)

        // 6. Sucesso → marca todos os selecionados como enviados (inclui os
        //    resumidos no "+N"). Falha → deixa pending pra proxima execucao.
        if (ok) {
            await markAlerted(supabase, allIds, 'sent')
            return new Response(JSON.stringify({ sent: allIds.length, groups: groups.length }), {
                status: 200,
                headers: JSON_HEADERS,
            })
        }

        return new Response(JSON.stringify({ error: 'falha no envio Evolution', pending: allIds.length }), {
            status: 502,
            headers: JSON_HEADERS,
        })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'unknown error'
        console.error('[system-alert-dispatcher] fatal:', err)
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: JSON_HEADERS,
        })
    }
})
