// Edge Function: paperclip-dispatcher
// Ponto único de saída de eventos do Lever System para o painel Paperclip.
// Invocada via supabase.functions.invoke('paperclip-dispatcher', { body: payload }).

import { instrument } from "../_shared/logger.ts";
import { z } from 'https://esm.sh/zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const payloadSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  priority: z.enum(['low', 'medium', 'high']),
  source: z.string().min(1).max(120),
});

// @ts-ignore - Deno global
Deno.serve(instrument("paperclip-dispatcher", async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let parsed: z.infer<typeof payloadSchema>;
  try {
    const raw = await req.json();
    parsed = payloadSchema.parse(raw);
  } catch (err) {
    console.error('[paperclip-dispatcher] payload inválido:', err);
    return new Response(JSON.stringify({ error: 'Payload inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // @ts-ignore - Deno global
  const url = Deno.env.get('PAPERCLIP_WEBHOOK_URL');
  // @ts-ignore - Deno global
  const secret = Deno.env.get('PAPERCLIP_WEBHOOK_SECRET');

  if (!url || !secret) {
    console.error('[paperclip-dispatcher] secrets ausentes no ambiente da função.');
    // Ainda respondemos 202: o chamador não deve depender disso.
    return new Response(JSON.stringify({ accepted: false, reason: 'missing_secrets' }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fire-and-forget: não esperamos resposta do Paperclip para devolver ao caller.
  const dispatch = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      ...parsed,
      dispatched_at: new Date().toISOString(),
    }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(
          `[paperclip-dispatcher] Paperclip retornou ${res.status}: ${text.slice(0, 500)}`
        );
      }
    })
    .catch((err) => {
      console.error('[paperclip-dispatcher] falha de rede ao despachar:', err);
    });

  // @ts-ignore - EdgeRuntime global disponível em Supabase Edge
  if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
    // @ts-ignore
    EdgeRuntime.waitUntil(dispatch);
  }

  return new Response(JSON.stringify({ accepted: true }), {
    status: 202,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}));
