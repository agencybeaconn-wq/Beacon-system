// @ts-ignore
declare const Deno: any;

/**
 * app-error — caixa-preta do app mobile.
 *
 * POST { app_id?, mensagem, stack?, contexto? } → grava em system_logs
 *
 * Existe porque crash de app em produção some: o usuário vê a tela fechar e
 * ninguém descobre o motivo. Aqui o app reporta antes de mostrar a tela de
 * erro, e o time lê em SystemLogs junto com os erros das edge functions.
 *
 * Endpoint público (o app não tem sessão) — só escreve log, nunca lê dado.
 */
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        let body: any;
        try { body = await req.json(); } catch {
            return new Response(JSON.stringify({ error: 'JSON inválido' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const mensagem = String(body?.mensagem ?? '').slice(0, 2000);
        if (!mensagem) {
            return new Response(JSON.stringify({ error: 'mensagem obrigatória' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        await supabase.from('system_logs').insert({
            function_name: 'app-mobile',
            action: String(body?.acao ?? 'crash'),
            message: mensagem,
            severity: 'error',
            status: 'error',
            environment: 'production',
            error: { stack: String(body?.stack ?? '').slice(0, 6000) },
            context: {
                app_id: body?.app_id ?? null,
                plataforma: body?.plataforma ?? null,
                versao: body?.versao ?? null,
                ...(typeof body?.contexto === 'object' && body?.contexto ? body.contexto : {}),
            },
        });

        return new Response(JSON.stringify({ ok: true }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (e: any) {
        console.error('[app-error] falhou', e.message);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
