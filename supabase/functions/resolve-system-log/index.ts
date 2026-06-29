// ════════════════════════════════════════════════════════════════════════════
// resolve-system-log — Marca um log como resolvido (ou reabre).
//
// Chamada pelo painel /agency/logs. Escrita em system_logs e exclusiva de
// service_role (a tabela nao tem policy de UPDATE), entao o "marcar como
// resolvido" passa por aqui: valida o JWT do usuario, confirma que e admin da
// agencia, e so entao grava com service_role. Registra quem resolveu e quando.
// ════════════════════════════════════════════════════════════════════════════

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

async function isAgencyAdmin(admin: SupabaseClient, userId: string): Promise<boolean> {
    // Dono de qualquer workspace?
    const { data: ws } = await admin
        .from('workspaces')
        .select('id')
        .eq('owner_id', userId)
        .limit(1)
        .maybeSingle()
    if (ws) return true

    // team_member com role admin?
    const { data: tm } = await admin
        .from('team_members')
        .select('id')
        .eq('user_id', userId)
        .ilike('role', 'admin')
        .limit(1)
        .maybeSingle()
    return !!tm
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const json = (body: unknown, status: number) =>
        new Response(JSON.stringify(body), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

        const token = req.headers.get('authorization')?.replace('Bearer ', '')
        if (!token) return json({ error: 'Nao autenticado' }, 401)

        const supabaseAuth = createClient(supabaseUrl, anonKey)
        const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser(token)
        if (authErr || !user) return json({ error: 'Token invalido' }, 401)

        const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

        if (!(await isAgencyAdmin(admin, user.id))) {
            return json({ error: 'Acesso negado: somente admin' }, 403)
        }

        const body = await req.json().catch(() => ({}))
        const id: string | undefined = body?.id
        const resolved: boolean = body?.resolved !== false // default true
        if (!id) return json({ error: 'id obrigatorio' }, 400)

        const { error: updErr } = await admin
            .from('system_logs')
            .update({
                resolved,
                resolution: resolved
                    ? { by: user.email ?? user.id, at: new Date().toISOString() }
                    : null,
            })
            .eq('id', id)

        if (updErr) return json({ error: updErr.message }, 500)

        return json({ success: true, id, resolved }, 200)
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'unknown error'
        return json({ error: message }, 500)
    }
})
