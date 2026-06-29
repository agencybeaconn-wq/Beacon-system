// clarity-proxy — Microsoft Clarity Data Export API gateway
//
// Actions:
//   - validate: testa o token, salva em agency_clients, marca status='connected'
//   - insights: busca dados (numOfDays + dimensions). USA CACHE pq Clarity tem rate-limit 10/dia.
//   - disconnect: limpa credenciais e status
//   - usage: retorna quantas requests foram feitas hoje
//
// Body: { action, clientId, ...specificFields }

// @ts-ignore
import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const CLARITY_BASE = 'https://www.clarity.ms/export-data/api/v1';
const CACHE_TTL_HOURS = 6; // 6h pra economizar quota (10/dia)
const DAILY_LIMIT = 10;

// @ts-ignore
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
// @ts-ignore
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function jsonResp(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function fetchClarityInsights(token: string, params: { numOfDays: number; dimension1?: string; dimension2?: string; dimension3?: string }) {
  const qs = new URLSearchParams();
  qs.set('numOfDays', String(params.numOfDays));
  if (params.dimension1) qs.set('dimension1', params.dimension1);
  if (params.dimension2) qs.set('dimension2', params.dimension2);
  if (params.dimension3) qs.set('dimension3', params.dimension3);

  const r = await fetch(`${CLARITY_BASE}/project-live-insights?${qs}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const text = await r.text();
  let payload: any;
  try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  return { status: r.status, payload };
}

async function trackUsage(supa: any, clientId: string, statusCode: number, errMsg?: string) {
  const today = new Date().toISOString().slice(0, 10);
  // Upsert (incrementa request_count se existir, cria se não)
  const { data: existing } = await supa
    .from('clarity_api_usage')
    .select('id, request_count')
    .eq('client_id', clientId)
    .eq('request_date', today)
    .maybeSingle();
  if (existing) {
    await supa
      .from('clarity_api_usage')
      .update({
        request_count: existing.request_count + 1,
        last_request_at: new Date().toISOString(),
        last_status_code: statusCode,
        last_error: errMsg ?? null,
      })
      .eq('id', existing.id);
  } else {
    await supa.from('clarity_api_usage').insert({
      client_id: clientId,
      request_date: today,
      request_count: 1,
      last_request_at: new Date().toISOString(),
      last_status_code: statusCode,
      last_error: errMsg ?? null,
    });
  }
}

async function getUsageToday(supa: any, clientId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supa
    .from('clarity_api_usage')
    .select('request_count')
    .eq('client_id', clientId)
    .eq('request_date', today)
    .maybeSingle();
  return data?.request_count ?? 0;
}

// @ts-ignore
Deno.serve(instrument("clarity-proxy", async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, clientId } = body;
    if (!action || !clientId) return jsonResp({ error: 'action + clientId obrigatórios' }, 400);

    const supa = createClient(supabaseUrl, serviceRoleKey);

    // ---------- VALIDATE ----------
    if (action === 'validate') {
      const { projectId, apiToken } = body;
      if (!projectId || !apiToken) return jsonResp({ error: 'projectId + apiToken obrigatórios' }, 400);

      // Testa o token chamando o endpoint mínimo
      const test = await fetchClarityInsights(apiToken, { numOfDays: 1 });
      await trackUsage(supa, clientId, test.status, test.status >= 400 ? JSON.stringify(test.payload).slice(0, 200) : undefined);

      if (test.status === 401 || test.status === 403) {
        return jsonResp({ error: 'Token inválido ou sem permissão. Verifique no Clarity > Settings > Data Export.' }, 400);
      }
      if (test.status === 429) {
        return jsonResp({ error: 'Limite diário do Clarity já atingido (10 req/dia). Tente novamente amanhã.' }, 429);
      }
      if (test.status >= 400) {
        return jsonResp({ error: `Clarity API erro ${test.status}: ${JSON.stringify(test.payload).slice(0, 200)}` }, 400);
      }

      // Salva credenciais + marca connected
      const { error: updErr } = await supa
        .from('agency_clients')
        .update({
          clarity_project_id: projectId,
          clarity_api_token: apiToken,
          clarity_status: 'connected',
          clarity_connected_at: new Date().toISOString(),
        })
        .eq('id', clientId);
      if (updErr) return jsonResp({ error: `Falha ao salvar: ${updErr.message}` }, 500);

      // Cacheia o resultado da validação como bonus
      const expires = new Date(Date.now() + CACHE_TTL_HOURS * 3600 * 1000).toISOString();
      await supa.from('clarity_insights_cache').upsert({
        client_id: clientId,
        num_of_days: 1,
        dimension1: null, dimension2: null, dimension3: null,
        payload: test.payload,
        fetched_at: new Date().toISOString(),
        expires_at: expires,
      }, { onConflict: 'client_id,num_of_days,dimension1,dimension2,dimension3' });

      return jsonResp({ success: true, cached: true, dataPreview: test.payload });
    }

    // ---------- DISCONNECT ----------
    if (action === 'disconnect') {
      await supa.from('agency_clients').update({
        clarity_project_id: null,
        clarity_api_token: null,
        clarity_status: 'disconnected',
        clarity_connected_at: null,
        clarity_snippet_installed: false,
      }).eq('id', clientId);
      // limpa cache
      await supa.from('clarity_insights_cache').delete().eq('client_id', clientId);
      return jsonResp({ success: true });
    }

    // ---------- USAGE ----------
    if (action === 'usage') {
      const count = await getUsageToday(supa, clientId);
      return jsonResp({ used: count, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - count) });
    }

    // ---------- INSIGHTS (com cache) ----------
    if (action === 'insights') {
      const { numOfDays = 1, dimension1 = null, dimension2 = null, dimension3 = null, force = false } = body;
      if (![1, 2, 3].includes(numOfDays)) return jsonResp({ error: 'numOfDays deve ser 1, 2 ou 3' }, 400);

      // 1) Tenta cache primeiro
      if (!force) {
        const { data: cached } = await supa
          .from('clarity_insights_cache')
          .select('payload, fetched_at, expires_at')
          .eq('client_id', clientId)
          .eq('num_of_days', numOfDays)
          .eq('dimension1', dimension1)
          .eq('dimension2', dimension2)
          .eq('dimension3', dimension3)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        if (cached) {
          return jsonResp({ data: cached.payload, fromCache: true, fetchedAt: cached.fetched_at, expiresAt: cached.expires_at });
        }
      }

      // 2) Verifica rate limit local
      const usedToday = await getUsageToday(supa, clientId);
      if (usedToday >= DAILY_LIMIT && !force) {
        // Tenta retornar cache expirado se houver, melhor que nada
        const { data: stale } = await supa
          .from('clarity_insights_cache')
          .select('payload, fetched_at')
          .eq('client_id', clientId)
          .eq('num_of_days', numOfDays)
          .eq('dimension1', dimension1)
          .eq('dimension2', dimension2)
          .eq('dimension3', dimension3)
          .order('fetched_at', { ascending: false })
          .maybeSingle();
        if (stale) {
          return jsonResp({ data: stale.payload, fromCache: true, stale: true, fetchedAt: stale.fetched_at, warning: 'Limite diário Clarity atingido — retornando cache expirado.' });
        }
        return jsonResp({ error: `Limite diário atingido (${usedToday}/${DAILY_LIMIT}). Tente amanhã.` }, 429);
      }

      // 3) Busca credenciais
      const { data: client } = await supa
        .from('agency_clients')
        .select('clarity_api_token, clarity_status')
        .eq('id', clientId)
        .single();
      if (!client?.clarity_api_token) return jsonResp({ error: 'Cliente sem Clarity conectado.' }, 400);

      // 4) Chama Clarity
      const result = await fetchClarityInsights(client.clarity_api_token, { numOfDays, dimension1, dimension2, dimension3 });
      await trackUsage(supa, clientId, result.status, result.status >= 400 ? JSON.stringify(result.payload).slice(0, 200) : undefined);

      if (result.status === 429) {
        return jsonResp({ error: 'Clarity rate limit atingido (10/dia).', clarityStatus: 429 }, 429);
      }
      if (result.status >= 400) {
        return jsonResp({ error: `Clarity erro ${result.status}: ${JSON.stringify(result.payload).slice(0, 300)}` }, 400);
      }

      // 5) Salva no cache
      const expires = new Date(Date.now() + CACHE_TTL_HOURS * 3600 * 1000).toISOString();
      await supa.from('clarity_insights_cache').upsert({
        client_id: clientId,
        num_of_days: numOfDays,
        dimension1, dimension2, dimension3,
        payload: result.payload,
        fetched_at: new Date().toISOString(),
        expires_at: expires,
      }, { onConflict: 'client_id,num_of_days,dimension1,dimension2,dimension3' });

      return jsonResp({ data: result.payload, fromCache: false, fetchedAt: new Date().toISOString(), expiresAt: expires });
    }

    return jsonResp({ error: `Action desconhecida: ${action}` }, 400);
  } catch (e: any) {
    return jsonResp({ error: e.message ?? String(e) }, 500);
  }
}));
