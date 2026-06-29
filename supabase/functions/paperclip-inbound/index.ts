// Edge Function: paperclip-inbound
// Recebe chamadas do Paperclip (multi-agent) e executa ações no Lever.
// Segurança em camadas:
//   1. Bearer token (PAPERCLIP_WEBHOOK_SECRET) — compara em tempo constante
//   2. Allow-list de ações (registry explícito — nunca dispatch dinâmico)
//   3. Zod valida `params` de cada ação
//   4. Idempotência via UNIQUE(idempotency_key) em paperclip_action_log
//   5. Execução com service role (RLS bypass), mas APÓS autenticar o Bearer

import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.25.76';
import { getAction, listManifest } from './actions/registry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const envelopeSchema = z.object({
  action: z.string().min(1).max(80),
  params: z.record(z.string(), z.unknown()).default({}),
  idempotency_key: z.string().min(8).max(200),
  actor: z.string().max(120).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Comparação em tempo constante para evitar timing attacks.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// @ts-ignore - Deno global
Deno.serve(instrument("paperclip-inbound", async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  // 1. Autenticação
  // @ts-ignore - Deno global
  const expected = Deno.env.get('PAPERCLIP_WEBHOOK_SECRET');
  if (!expected) {
    console.error('[paperclip-inbound] PAPERCLIP_WEBHOOK_SECRET não configurado.');
    return json({ error: 'Servidor mal configurado' }, 500);
  }

  const auth = req.headers.get('authorization') ?? '';
  const provided = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : '';

  if (!provided || !timingSafeEqual(provided, expected)) {
    return json({ error: 'Não autorizado' }, 401);
  }

  // 2. Parse do envelope
  let envelope: z.infer<typeof envelopeSchema>;
  try {
    const raw = await req.json();
    envelope = envelopeSchema.parse(raw);
  } catch (err) {
    return json({ error: 'Envelope inválido', detail: String(err) }, 400);
  }

  // 3. Supabase client com service role (bypass RLS) — só alcançável após Bearer OK
  // @ts-ignore - Deno global
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  // @ts-ignore - Deno global
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    console.error('[paperclip-inbound] SUPABASE_URL/SERVICE_ROLE_KEY ausentes.');
    return json({ error: 'Servidor mal configurado' }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 4. Idempotência — se já executamos essa key, devolve o resultado anterior
  {
    const { data: existing } = await supabase
      .from('paperclip_action_log')
      .select('action, status, result, error, created_at')
      .eq('idempotency_key', envelope.idempotency_key)
      .maybeSingle();

    if (existing) {
      return json({
        replayed: true,
        action: existing.action,
        status: existing.status,
        result: existing.result,
        error: existing.error,
        at: existing.created_at,
      }, 200);
    }
  }

  // 5. Meta-action: list_actions (discovery, não grava log)
  if (envelope.action === 'list_actions') {
    return json({
      success: true,
      action: 'list_actions',
      result: { actions: listManifest() },
    });
  }

  // 6. Resolve e valida a ação
  const action = getAction(envelope.action);
  if (!action) {
    return json({ error: `Ação desconhecida: ${envelope.action}` }, 400);
  }

  let validated: unknown;
  try {
    validated = action.paramsSchema.parse(envelope.params);
  } catch (err) {
    return json({ error: 'Params inválidos', detail: String(err) }, 400);
  }

  // 7. Executa + grava log
  const actor = envelope.actor ?? null;
  try {
    // deno-lint-ignore no-explicit-any
    const result = await action.handler(validated as any, { supabase, actor });

    await supabase.from('paperclip_action_log').insert({
      idempotency_key: envelope.idempotency_key,
      action: envelope.action,
      actor,
      params: envelope.params,
      status: 'success',
      result,
    });

    return json({
      success: true,
      action: envelope.action,
      idempotency_key: envelope.idempotency_key,
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[paperclip-inbound] erro em ${envelope.action}:`, message);

    await supabase.from('paperclip_action_log').insert({
      idempotency_key: envelope.idempotency_key,
      action: envelope.action,
      actor,
      params: envelope.params,
      status: 'error',
      error: { message },
    });

    return json({
      success: false,
      action: envelope.action,
      idempotency_key: envelope.idempotency_key,
      error: { message },
    }, 422);
  }
}));
