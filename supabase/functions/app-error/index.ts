// @ts-ignore
declare const Deno: any;

/**
 * app-error — caixa-preta do app mobile.
 *
 * POST { app_id?, mensagem, stack?, acao?, plataforma?, versao?, contexto? }
 *   → grava em system_logs (function_name='app-mobile')
 *
 * Existe porque crash de app em produção some: o usuário vê a tela fechar e
 * ninguém descobre o motivo. Endpoint público (o app não tem sessão) — por
 * isso o hardening: schema Zod, clamps de tamanho e freio anti-inundação
 * (um app bugado em loop, ou um curioso com curl, não podem afogar a tabela).
 */
import { corsHeaders } from '../_shared/cors.ts';
import { z } from 'npm:zod@3.25.76';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const MAX_BODY_BYTES = 32 * 1024; // caixa-preta não precisa de payload maior
const TETO_POR_APP_10MIN = 60;    // acima disso é loop/flood — descarta com 429

const appErrorSchema = z.object({
    app_id: z.string().uuid().nullable().default(null),
    mensagem: z.string().min(1).max(2000),
    stack: z.string().max(6000).default(''),
    acao: z.string().max(40).default('crash'),
    plataforma: z.string().max(20).nullable().default(null),
    versao: z.string().max(20).nullable().default(null),
    contexto: z.record(z.unknown()).default({}),
});

function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    try {
        const bruto = await req.text();
        if (bruto.length > MAX_BODY_BYTES) return json(413, { error: 'payload grande demais' });

        let body: unknown;
        try { body = JSON.parse(bruto); } catch { return json(400, { error: 'JSON inválido' }); }

        const parsed = appErrorSchema.safeParse(body);
        if (!parsed.success) return json(400, { error: 'payload inválido' });
        const ev = parsed.data;

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        // freio anti-inundação por app (app_id null cai num balde próprio)
        const desde = new Date(Date.now() - 10 * 60000).toISOString();
        let quota = supabase
            .from('system_logs')
            .select('id', { count: 'exact', head: true })
            .eq('function_name', 'app-mobile')
            .gte('created_at', desde);
        quota = ev.app_id
            ? quota.eq('context->>app_id', ev.app_id)
            : quota.is('context->>app_id', null);
        const { count } = await quota;
        if ((count ?? 0) >= TETO_POR_APP_10MIN) {
            return json(429, { error: 'teto de relatórios atingido — tente depois' });
        }

        const { error } = await supabase.from('system_logs').insert({
            function_name: 'app-mobile',
            action: ev.acao,
            message: ev.mensagem,
            severity: 'error',
            // valores do check: success|failure|partial ('error' era descartado
            // em silêncio — a caixa-preta nasceu cega por isso)
            status: 'failure',
            environment: 'production',
            error: { stack: ev.stack },
            context: {
                app_id: ev.app_id,
                plataforma: ev.plataforma,
                versao: ev.versao,
                // contexto do app entra clampado — nunca cru/ilimitado
                ...JSON.parse(JSON.stringify(ev.contexto).slice(0, 4000)),
            },
        });
        if (error) throw error;

        return json(200, { ok: true });
    } catch (e: any) {
        console.error('[app-error] falhou', e?.message ?? e);
        // detalhe no corpo: endpoint interno da agência; acelera diagnóstico
        return json(500, { error: String(e?.message ?? 'erro interno').slice(0, 200) });
    }
});
