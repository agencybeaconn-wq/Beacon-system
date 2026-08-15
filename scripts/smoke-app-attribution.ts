/**
 * Smoke de INTEGRAÇÃO do gate de atribuição assinada (#13) — Fase 3.
 *
 * Prova, contra a edge `app-shopify-webhooks` JÁ PUBLICADA, que um pedido
 * `orders/paid` só entra em `app_orders` com token de atribuição assinado e
 * válido. Assina o token (attribution.ts) e o HMAC Shopify do cliente, dispara
 * 3 casos (sem token / forjado / válido) e confere o resultado. Limpa os rows.
 *
 * Complementa o teste unitário repetível `tests/webhook-logic.test.ts` (a lógica
 * pura); este exercita o caminho real ponta-a-ponta no servidor.
 *
 * Uso:
 *   ATTRIBUTION_SECRET=<segredo> npx tsx scripts/smoke-app-attribution.ts
 * (SB URL + service role vêm do .env da raiz; o secret NÃO fica em disco.)
 */
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { assinarAtribuicao } from '../supabase/functions/_shared/attribution.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET = process.env.ATTRIBUTION_SECRET;
if (!URL || !KEY) throw new Error('faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env');
if (!SECRET) throw new Error('exporte ATTRIBUTION_SECRET no ambiente (mesmo valor do secret da edge)');

const FN = `${URL}/functions/v1/app-shopify-webhooks`;
const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const shopHmac = (body: string, secret: string) =>
    crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');

async function main(): Promise<void> {
    // cliente de teste com app + domínio + secret
    const { data: apps } = await sb.from('store_apps').select('id, client_id');
    let clientId = '', appId = '', dominio = '', cliSecret = '';
    for (const a of apps ?? []) {
        const { data: c } = await sb.from('agency_clients')
            .select('id, shopify_domain, shopify_client_secret').eq('id', a.client_id).maybeSingle();
        if (c?.shopify_domain && c?.shopify_client_secret) {
            clientId = c.id; appId = a.id; dominio = c.shopify_domain; cliSecret = c.shopify_client_secret; break;
        }
    }
    if (!appId) { console.log('NENHUM cliente com app+domain+secret — não dá pra testar'); process.exit(2); }

    // device real (ou sintético só pro teste, removido no fim)
    let { data: dev } = await sb.from('app_devices').select('id').eq('app_id', appId).limit(1).maybeSingle();
    let deviceSintetico: string | null = null;
    if (!dev) {
        const { data: novo, error } = await sb.from('app_devices').insert({
            app_id: appId, client_id: clientId, installation_id: crypto.randomUUID(),
            platform: 'android', app_version: '0.0.0-smoke', push_enabled: false,
        }).select('id').single();
        if (error) { console.log('falha criando device sintético', error.message); process.exit(2); }
        dev = novo; deviceSintetico = novo!.id;
    }
    const deviceId = dev!.id;
    console.log(`alvo: client=${clientId.slice(0, 8)} app=${appId.slice(0, 8)} device=${deviceId.slice(0, 8)} dom=${dominio}`);

    const agora = Date.now();
    const tokenValido = await assinarAtribuicao(deviceId, appId, SECRET!, agora);
    const tokenForjado = await assinarAtribuicao(deviceId, appId, 'secret-do-atacante', agora);

    const base = 990000000000 + (agora % 1000000);
    const casos = [
        { nome: 'SEM token', oid: base + 1, attrs: [{ name: 'app_source', value: 'beacon_app' }] },
        { nome: 'token FORJADO', oid: base + 2, attrs: [{ name: 'app_source', value: 'beacon_app' }, { name: 'app_attribution', value: tokenForjado }] },
        { nome: 'token VÁLIDO', oid: base + 3, attrs: [{ name: 'app_source', value: 'beacon_app' }, { name: 'app_attribution', value: tokenValido }] },
    ];
    const oids = casos.map((c) => String(c.oid));

    for (const c of casos) {
        const payload = {
            id: c.oid, name: `#SMOKE${c.oid}`, order_number: c.oid,
            current_total_price: '199.90', currency: 'BRL', financial_status: 'paid',
            processed_at: new Date(agora).toISOString(), note_attributes: c.attrs,
        };
        const body = JSON.stringify(payload);
        const res = await fetch(FN, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Shop-Domain': dominio,
                'X-Shopify-Topic': 'orders/paid',
                'X-Shopify-Webhook-Id': `smoke-${c.oid}`,
                'X-Shopify-Hmac-Sha256': shopHmac(body, cliSecret),
            },
            body,
        });
        console.log(`  POST ${c.nome} → HTTP ${res.status}`);
    }

    await new Promise((r) => setTimeout(r, 1500));
    const { data: criados } = await sb.from('app_orders')
        .select('shopify_order_id, attributed_via, device_id')
        .eq('client_id', clientId).in('shopify_order_id', oids);
    const criadosSet = new Set((criados ?? []).map((r) => r.shopify_order_id));

    console.log('\n=== RESULTADO app_orders ===');
    let ok = true;
    for (const c of casos) {
        const entrou = criadosSet.has(String(c.oid));
        const esperado = c.nome === 'token VÁLIDO';
        if (entrou !== esperado) ok = false;
        console.log(`  ${c.nome}: entrou=${entrou} esperado=${esperado} → ${entrou === esperado ? 'OK' : 'FALHA'}`);
    }
    const validoRow = (criados ?? []).find((r) => r.shopify_order_id === String(base + 3));
    if (validoRow) console.log(`  válido gravou attributed_via=${validoRow.attributed_via} device=${String(validoRow.device_id ?? '').slice(0, 8)}`);

    // limpeza
    await sb.from('tracked_orders').delete().eq('client_id', clientId).in('shopify_order_id', oids);
    await sb.from('app_orders').delete().eq('client_id', clientId).in('shopify_order_id', oids);
    await sb.from('webhook_events').delete().eq('client_id', clientId).in('webhook_id', casos.map((c) => `smoke-${c.oid}`));
    if (deviceSintetico) await sb.from('app_devices').delete().eq('id', deviceSintetico);
    console.log('\nlimpeza feita.');
    console.log(ok ? '\n>>> GATE #13: PASSOU' : '\n>>> GATE #13: FALHOU');
    process.exit(ok ? 0 : 1);
}

void main();
