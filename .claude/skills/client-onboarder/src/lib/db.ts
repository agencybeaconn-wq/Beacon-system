import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// A imagem oficial do Playwright (v1.48-jammy) roda Node 20, que não tem WebSocket nativo.
// O worker NÃO usa Realtime, mas o supabase-js inicializa o RealtimeClient no construtor — e
// ele exige um WebSocket, senão crasha ("Node.js 20 detected without native WebSocket support").
// Fornecer o 'ws' como WebSocket global resolve sem tocar no resto. (Node 22+ tem nativo e ignora.)
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pxhmzpwvxvlwngjbjkrg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[db] SUPABASE_SERVICE_ROLE_KEY ausente — operações DB vão falhar');
}

export const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export type AgencyClient = {
  id: string;
  name: string;
  client_type: 'fixo' | 'avulso';
  shopify_domain: string | null;
  shopify_status: string | null;
  shopify_access_token: string | null;
  shopify_client_id: string | null;
  shopify_client_secret: string | null;
  shopify_connected_at: string | null;
  fee_fixed: number | null;
  commission_rate: number | null;
  is_archived: boolean;
  is_internal: boolean | null;
  is_ecommerce: boolean;
};

export async function findClientByName(name: string): Promise<AgencyClient | null> {
  const { data, error } = await db
    .from('agency_clients')
    .select('*')
    .ilike('name', name)
    .eq('is_archived', false)
    .maybeSingle();
  if (error) throw new Error(`findClientByName: ${error.message}`);
  return data as AgencyClient | null;
}

export async function createClient_(args: {
  name: string;
  client_type: 'fixo' | 'avulso';
  fee_fixed?: number;
  commission_rate?: number;
}): Promise<AgencyClient> {
  const { data, error } = await db
    .from('agency_clients')
    .insert({
      name: args.name,
      client_type: args.client_type,
      fee_fixed: args.fee_fixed ?? 0,
      commission_rate: args.commission_rate ?? 0,
      is_archived: false,
      is_internal: false,
      is_ecommerce: true,
    })
    .select('*')
    .single();
  if (error) throw new Error(`createClient: ${error.message}`);
  return data as AgencyClient;
}

/**
 * Polla agency_clients até o callback OAuth salvar o token (fonte de verdade —
 * independe de onde o browser parou). Resolve quando shopify_access_token != null
 * e shopify_status='connected', ou rejeita no timeout.
 */
export async function waitForToken(
  clientId: string,
  timeoutMs: number = 120000,
  pollMs: number = 3000,
): Promise<{ token: string; status: string; domain: string | null }> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const { data, error } = await db
      .from('agency_clients')
      .select('shopify_access_token, shopify_status, shopify_domain')
      .eq('id', clientId)
      .maybeSingle();
    if (error) throw new Error(`waitForToken: ${error.message}`);
    if (data?.shopify_access_token) {
      return {
        token: data.shopify_access_token,
        status: data.shopify_status ?? 'unknown',
        domain: data.shopify_domain ?? null,
      };
    }
    if (data?.shopify_status === 'error') {
      throw new Error('shopify_status=error — callback OAuth falhou (ver logs da edge function)');
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`Timeout (${timeoutMs}ms) aguardando token OAuth no DB`);
}

/**
 * Salva as credenciais do app (client_id/secret) + domínio no agency_clients e marca
 * status=pending. É o que a UI de Conexões do Lever System faz — fazemos direto no DB
 * (mais robusto que dirigir o front) porque o callback OAuth lê essas creds daqui.
 */
export async function updateShopifyCreds(
  clientId: string,
  appClientId: string,
  appClientSecret: string,
  shop: string,
): Promise<void> {
  const { error } = await db
    .from('agency_clients')
    .update({
      shopify_client_id: appClientId,
      shopify_client_secret: appClientSecret,
      shopify_domain: shop,
      shopify_status: 'pending',
    })
    .eq('id', clientId);
  if (error) throw new Error(`updateShopifyCreds: ${error.message}`);
}

/** Avança o estágio do job na máquina de estados (observabilidade). */
export async function setJobStage(jobId: string, stage: string): Promise<void> {
  await db
    .from('onboarding_jobs')
    .update({ stage, stage_updated_at: new Date().toISOString() })
    .eq('id', jobId);
}

/** Anexa eventos de log ao job (read-modify-write; só 1 worker mexe por job). Mantém os últimos 500. */
export async function appendJobLogs(jobId: string, entries: any[]): Promise<void> {
  if (!entries?.length) return;
  const { data } = await db.from('onboarding_jobs').select('logs').eq('id', jobId).maybeSingle();
  const existing = Array.isArray((data as any)?.logs) ? (data as any).logs : [];
  await db
    .from('onboarding_jobs')
    .update({ logs: [...existing, ...entries].slice(-500) })
    .eq('id', jobId);
}

/** Batimento de saúde do runner (pra UI/status saber se a VM está viva e se a sessão 2FA esfriou). */
export async function heartbeat(
  runnerId: string,
  hostname: string,
  sessionOk: boolean = true,
  note: string | null = null,
): Promise<void> {
  const { error } = await db.from('onboarding_runners').upsert({
    runner_id: runnerId,
    hostname,
    last_heartbeat_at: new Date().toISOString(),
    session_ok: sessionOk,
    note,
  });
  if (error) console.warn(`[heartbeat] ${error.message}`);
}

export async function pingShopifyToken(shop: string, token: string): Promise<{ ok: boolean; shopName?: string; error?: string }> {
  try {
    const res = await fetch(`https://${shop}/admin/api/2026-04/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ shop { name myshopifyDomain } }' }),
    });
    if (res.status !== 200) return { ok: false, error: `HTTP ${res.status}` };
    const json: any = await res.json();
    if (json.errors) return { ok: false, error: JSON.stringify(json.errors) };
    return { ok: true, shopName: json?.data?.shop?.name };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function triggerBackfill(clientId: string, days: number = 90): Promise<number | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/dw-daily-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ client_id: clientId, days }),
    });
    if (res.status !== 200) {
      console.warn(`[backfill] HTTP ${res.status}`);
      return null;
    }
    const body = await res.json();
    return body?.duration_s ? 1 : null;
  } catch (e: any) {
    console.warn(`[backfill] ${e.message}`);
    return null;
  }
}
