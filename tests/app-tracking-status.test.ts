import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTrackingStatus, trackingEventText } from '../supabase/functions/_shared/tracking-status.ts';

test('normaliza estados de fulfillment da Shopify', () => {
    assert.equal(normalizeTrackingStatus('out_for_delivery'), 'saiu_para_entrega');
    assert.equal(normalizeTrackingStatus('delivered'), 'entregue');
    assert.equal(normalizeTrackingStatus('in_transit'), 'transito_nacional');
    assert.equal(normalizeTrackingStatus('failure'), 'problema');
});

test('reconhece sinais logísticos em português sem depender de acento', () => {
    assert.equal(normalizeTrackingStatus('Processamento na alfândega'), 'alfandega');
    assert.equal(normalizeTrackingStatus('Trânsito internacional'), 'transito_internacional');
});

test('todo status possui mensagem segura para o consumidor', () => {
    assert.match(trackingEventText('postado'), /caminho/i);
    assert.match(trackingEventText('problema'), /ocorrência/i);
});
