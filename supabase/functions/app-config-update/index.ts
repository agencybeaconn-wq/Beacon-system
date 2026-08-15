// @ts-ignore
declare const Deno: any;

/**
 * app-config-update — Fase 2 P1 (#15). Única porta pra gravar store_apps.config.
 *
 * POST { app_id, config }  (JWT obrigatório)
 *  1. valida o JWT e que o caller ENXERGA o app (RLS decide staff vs cliente)
 *  2. valida o config com appConfigSchema (Zod) — cliente não grava JSON quebrado
 *  3. grava via service role
 *
 * Com esta porta + a remoção da policy de UPDATE direto do cliente, `config` e
 * `push_limits` deixam de ser editáveis crus via PostgREST pelo cliente (o teto
 * anti-spam na coluna push_limits fica intocável — só staff, via policy staff).
 */
import { corsHeaders } from '../_shared/cors.ts';
import { instrument } from '../_shared/logger.ts';
import { appConfigSchema } from '../_shared/app-contracts.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

Deno.serve(instrument('app-config-update', async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!jwt) return json(401, { error: 'não autenticado' });

    let body: any;
    try { body = await req.json(); } catch { return json(400, { error: 'JSON inválido' }); }
    const appId = String(body?.app_id ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(appId)) return json(400, { error: 'app_id inválido' });

    // valida config com Zod — grava só o que o schema aprova
    const parsed = appConfigSchema.safeParse(body?.config);
    if (!parsed.success) {
        return json(400, { error: 'config inválido', issues: parsed.error.issues });
    }

    // #15 acesso: o token do usuário só enxerga o app se RLS deixar (staff/cliente
    // do tenant). Sem acesso → PostgREST devolve vazio → 403.
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: visivel, error: acessoErr } = await asUser
        .from('store_apps').select('id').eq('id', appId).maybeSingle();
    if (acessoErr) return json(401, { error: 'token inválido' });
    if (!visivel) return json(403, { error: 'sem acesso a esse app' });

    // grava só config (push_limits fica intocável pelo cliente — coluna à parte)
    const service = createClient(url, serviceKey);
    const { error } = await service.from('store_apps')
        .update({ config: parsed.data })
        .eq('id', appId);
    if (error) return json(500, { error: 'falha ao gravar' });

    return json(200, { ok: true, version: parsed.data.version });
}));
