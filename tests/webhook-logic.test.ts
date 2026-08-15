import assert from 'node:assert/strict';
import test from 'node:test';
import {
    deveAtribuirPedido,
    fulfillmentRegrediu,
    inferirStatusFulfillment,
} from '../supabase/functions/_shared/webhook-logic.ts';

const APP = 'app-uuid-1';
const okVeredito = { valido: true, app_id: APP, device_id: 'dev-1' };

// ── gate de atribuição (#13) ────────────────────────────────────────────────

test('#13 sem secret no ambiente → não atribui (sem_prova)', () => {
    const r = deveAtribuirPedido({ secretPresente: false, token: 'x', veredito: okVeredito, appId: APP });
    assert.equal(r.atribuir, false);
    assert.equal(r.motivo, 'sem_prova');
    assert.equal(r.deviceCandidato, null);
});

test('#13 sem token no carrinho → não atribui (sem_prova)', () => {
    const r = deveAtribuirPedido({ secretPresente: true, token: null, veredito: okVeredito, appId: APP });
    assert.equal(r.atribuir, false);
    assert.equal(r.motivo, 'sem_prova');
});

test('#13 token inválido/forjado → não atribui (invalido)', () => {
    const r = deveAtribuirPedido({
        secretPresente: true, token: 'forjado',
        veredito: { valido: false, app_id: null, device_id: null }, appId: APP,
    });
    assert.equal(r.atribuir, false);
    assert.equal(r.motivo, 'invalido');
});

test('#13 token de OUTRO app (mesmo tenant) → não credita (outro_app)', () => {
    const r = deveAtribuirPedido({
        secretPresente: true, token: 't',
        veredito: { valido: true, app_id: 'app-uuid-OUTRO', device_id: 'dev-9' }, appId: APP,
    });
    assert.equal(r.atribuir, false);
    assert.equal(r.motivo, 'outro_app');
    assert.equal(r.deviceCandidato, null); // não vaza device de outro app
});

test('#13 token válido do app certo → atribui e devolve o device', () => {
    const r = deveAtribuirPedido({ secretPresente: true, token: 't', veredito: okVeredito, appId: APP });
    assert.equal(r.atribuir, true);
    assert.equal(r.motivo, 'ok');
    assert.equal(r.deviceCandidato, 'dev-1');
});

// ── inferência de status do fulfillment ─────────────────────────────────────

test('código de rastreio presente prova "postado" quando status vem desconhecido', () => {
    assert.equal(inferirStatusFulfillment('desconhecido', 1), 'postado');
    assert.equal(inferirStatusFulfillment('desconhecido', 0), 'desconhecido'); // sem código, não inventa
});

test('status já conhecido NÃO é sobrescrito por código de rastreio', () => {
    assert.equal(inferirStatusFulfillment('entregue', 2), 'entregue');
    assert.equal(inferirStatusFulfillment('saiu_para_entrega', 1), 'saiu_para_entrega');
});

// ── guarda anti-regressão do rastreio ───────────────────────────────────────

test('sem histórico anterior nunca é regressão', () => {
    assert.equal(fulfillmentRegrediu(null, '2026-08-14T10:00:00Z'), false);
    assert.equal(fulfillmentRegrediu(undefined, '2026-08-14T10:00:00Z'), false);
});

test('evento mais novo avança; mais velho ou igual regride', () => {
    const anterior = '2026-08-14T10:00:00Z';
    assert.equal(fulfillmentRegrediu(anterior, '2026-08-14T11:00:00Z'), false); // avança
    assert.equal(fulfillmentRegrediu(anterior, '2026-08-14T09:00:00Z'), true);  // webhook atrasado
    assert.equal(fulfillmentRegrediu(anterior, anterior), true);                // reenvio idêntico
});

test('data inválida não bloqueia a atualização (não é regressão)', () => {
    assert.equal(fulfillmentRegrediu('data-podre', '2026-08-14T10:00:00Z'), false);
    assert.equal(fulfillmentRegrediu('2026-08-14T10:00:00Z', 'lixo'), false);
});
