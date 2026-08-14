import assert from 'node:assert/strict';
import test from 'node:test';
import {
    resolverAlvoPuro, aplicarTetoPuro, podeReivindicarCampanha,
    type DeviceMin, type CustomerAgg,
} from '../supabase/functions/_shared/dispatch-audience.ts';

const AGORA = Date.parse('2026-08-14T12:00:00Z');
const dev = (id: string, over: Partial<DeviceMin> = {}): DeviceMin => ({
    id, platform: 'android', shopify_customer_id: null,
    first_seen_at: '2026-08-01T12:00:00Z', last_seen_at: '2026-08-14T11:00:00Z', ...over,
});

// ── #18 segmento fail-closed ────────────────────────────────────────────────
test('sem segmento pedido → alvo é a base inteira', () => {
    const r = resolverAlvoPuro([dev('a'), dev('b')], [], null, AGORA);
    assert.equal(r.motivo, 'ok');
    assert.equal(r.alvo.length, 2);
});

test('#18 segmento pedido mas AUSENTE (deletado) → alvo VAZIO, não a base', () => {
    const r = resolverAlvoPuro([dev('a'), dev('b')], [], 'ausente', AGORA);
    assert.equal(r.motivo, 'segmento_ausente');
    assert.equal(r.alvo.length, 0);
});

test('#18 segmento pedido com definition INVÁLIDA → alvo VAZIO', () => {
    const r = resolverAlvoPuro([dev('a')], [], 'invalido', AGORA);
    assert.equal(r.motivo, 'segmento_invalido');
    assert.equal(r.alvo.length, 0);
});

test('segmento válido por plataforma filtra corretamente', () => {
    const devices = [dev('a', { platform: 'android' }), dev('b', { platform: 'ios' })];
    const def = { platform: 'ios' as const, comprou: null, inativo_dias: null, instalou_ha_dias: null, gasto_minimo: null };
    const r = resolverAlvoPuro(devices, [], def, AGORA);
    assert.equal(r.motivo, 'ok');
    assert.deepEqual(r.alvo.map((d) => d.id), ['b']);
});

test('segmento "comprou=sim" cruza com o CRM por customer', () => {
    const devices = [
        dev('comprador', { shopify_customer_id: 'c1' }),
        dev('curioso', { shopify_customer_id: 'c2' }),
        dev('anonimo', { shopify_customer_id: null }),
    ];
    const clientes: CustomerAgg[] = [{ shopify_customer_id: 'c1', orders_app_count: 2, total_spent_app: 300 }];
    const def = { platform: null, comprou: 'sim' as const, inativo_dias: null, instalou_ha_dias: null, gasto_minimo: null };
    const r = resolverAlvoPuro(devices, clientes, def, AGORA);
    assert.deepEqual(r.alvo.map((d) => d.id), ['comprador']);
});

test('base vazia → motivo sem_devices', () => {
    const r = resolverAlvoPuro([], [], null, AGORA);
    assert.equal(r.motivo, 'sem_devices');
});

// ── #9/#17 teto único ───────────────────────────────────────────────────────
test('#9/#17 teto remove quem já bateu a cota de marketing do dia', () => {
    const devices = [dev('no_limite'), dev('estourou')];
    const contagem = new Map([['estourou', 3]]);
    const { permitidos, bloqueados } = aplicarTetoPuro(devices, contagem, 3);
    assert.deepEqual(permitidos.map((d) => d.id), ['no_limite']);
    assert.equal(bloqueados, 1);
});

test('teto: device sem envios no dia passa', () => {
    const { permitidos, bloqueados } = aplicarTetoPuro([dev('novo')], new Map(), 3);
    assert.equal(permitidos.length, 1);
    assert.equal(bloqueados, 0);
});

// ── #8 máquina de estado de campanha ────────────────────────────────────────
test('#8 campanha ENVIADA nunca reabre (nem stale)', () => {
    assert.equal(podeReivindicarCampanha('enviada', false), false);
    assert.equal(podeReivindicarCampanha('enviada', true), false);
});

test('#8 rascunho/agendada/erro são reivindicáveis', () => {
    assert.equal(podeReivindicarCampanha('rascunho', false), true);
    assert.equal(podeReivindicarCampanha('agendada', false), true);
    assert.equal(podeReivindicarCampanha('erro', false), true);
});

test('#8 enviando só volta pra fila se estiver STALE (crash)', () => {
    assert.equal(podeReivindicarCampanha('enviando', false), false);
    assert.equal(podeReivindicarCampanha('enviando', true), true);
});
