// ════════════════════════════════════════════════════════════════════════════
// system-watchdog — Detecta "o que deveria ter acontecido e nao aconteceu".
//
// Roda via pg_cron a cada 5 min. Faz checagens de reconciliacao sobre tabelas
// reais e, quando algo que era pra ter acontecido nao aconteceu, grava uma linha
// de falha em system_logs (que flui pro WhatsApp via system-alert-dispatcher).
//
// Dedup: cada tipo de check so re-alerta a cada DEDUP_HOURS (6h) — uma falha em
// andamento avisa uma vez, nao a cada 5 min. Marcar resolvido no painel encerra.
//
// Extensivel: novo check = mais um bloco que chama report(action, msg, ctx).
// ════════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createLogger } from '../_shared/logger.ts'

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const DEDUP_HOURS = 6

Deno.serve(async (_req: Request) => {
    try {
        const url = Deno.env.get('SUPABASE_URL') || ''
        const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        if (!url || !key) {
            return new Response(JSON.stringify({ error: 'envs ausentes' }), { status: 500, headers: JSON_HEADERS })
        }
        const supabase = createClient(url, key, { auth: { persistSession: false } })
        const log = createLogger('system-watchdog')

        // Ja existe alerta aberto desse tipo nas ultimas 6h? Entao nao repete.
        async function alreadyLogged(action: string): Promise<boolean> {
            const since = new Date(Date.now() - DEDUP_HOURS * 3600_000).toISOString()
            const { data } = await supabase
                .from('system_logs')
                .select('id')
                .eq('function_name', 'system-watchdog')
                .eq('action', action)
                .eq('resolved', false)
                .gte('created_at', since)
                .limit(1)
            return !!(data && data.length > 0)
        }

        async function report(action: string, message: string, context: Record<string, unknown>): Promise<boolean> {
            if (await alreadyLogged(action)) return false
            await log.failure({ action, message, context, severity: 'error' })
            return true
        }

        const fired: string[] = []

        // ── Check A: lembretes de reuniao vencidos e nao enviados ──────────────
        // Janela ativa de 2h (o send-meeting-reminders so tenta nessa janela).
        // Vencido ha >15min e ainda sem sent_X_at = algo falhou (cron/Evolution).
        try {
            const min15 = new Date(Date.now() - 15 * 60_000).toISOString()
            const min2h = new Date(Date.now() - 2 * 3600_000).toISOString()

            const c30 = await supabase
                .from('meeting_reminders')
                .select('id', { count: 'exact', head: true })
                .lt('remind_30_at', min15).gt('remind_30_at', min2h).is('sent_30_at', null)
            const c10 = await supabase
                .from('meeting_reminders')
                .select('id', { count: 'exact', head: true })
                .lt('remind_10_at', min15).gt('remind_10_at', min2h).is('sent_10_at', null)

            const overdue = (c30.count ?? 0) + (c10.count ?? 0)
            if (overdue > 0) {
                const ok = await report(
                    'watchdog:reminders-overdue',
                    `${overdue} lembrete(s) de reuniao venceram e nao foram enviados na janela ativa`,
                    { overdue_30: c30.count ?? 0, overdue_10: c10.count ?? 0 },
                )
                if (ok) fired.push('reminders-overdue')
            }
        } catch (e) {
            console.error('[watchdog] check reminders falhou:', e)
        }

        // ── Check B: sync diario (dw_sync_state) parado ou com erro ────────────
        try {
            const h25 = new Date(Date.now() - 25 * 3600_000).toISOString()

            const stale = await supabase
                .from('dw_sync_state')
                .select('client_id', { count: 'exact', head: true })
                .lt('last_run_at', h25)
            const errored = await supabase
                .from('dw_sync_state')
                .select('client_id', { count: 'exact', head: true })
                .not('last_error', 'is', null)

            const staleCount = stale.count ?? 0
            const errCount = errored.count ?? 0
            if (staleCount > 0 || errCount > 0) {
                const ok = await report(
                    'watchdog:daily-sync-stale',
                    `Sync diario: ${staleCount} cliente(s) sem rodar ha 25h+ e ${errCount} com erro`,
                    { stale: staleCount, errored: errCount },
                )
                if (ok) fired.push('daily-sync-stale')
            }
        } catch (e) {
            console.error('[watchdog] check dw_sync_state falhou:', e)
        }

        return new Response(JSON.stringify({ ok: true, fired }), { status: 200, headers: JSON_HEADERS })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'unknown error'
        console.error('[system-watchdog] fatal:', err)
        return new Response(JSON.stringify({ error: message }), { status: 500, headers: JSON_HEADERS })
    }
})
