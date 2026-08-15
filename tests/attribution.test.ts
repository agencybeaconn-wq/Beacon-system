import assert from 'node:assert/strict';
import test from 'node:test';
import { assinarAtribuicao, validarAtribuicao } from '../supabase/functions/_shared/attribution.ts';

const SECRET = 'segredo-de-teste-super-secreto';
const DEV = 'device-uuid-1';
const APP = 'app-uuid-1';
const AGORA = 1_760_000_000_000;

test('#13 token assinado valida e devolve device/app', async () => {
    const token = await assinarAtribuicao(DEV, APP, SECRET, AGORA);
    const r = await validarAtribuicao(token, SECRET, AGORA + 1000);
    assert.equal(r.valido, true);
    assert.equal(r.device_id, DEV);
    assert.equal(r.app_id, APP);
});

test('#13 token com secret ERRADO é rejeitado (forja)', async () => {
    const token = await assinarAtribuicao(DEV, APP, SECRET, AGORA);
    const r = await validarAtribuicao(token, 'outro-secret', AGORA + 1000);
    assert.equal(r.valido, false);
    assert.equal(r.motivo, 'assinatura');
});

test('#13 payload adulterado (device trocado) quebra a assinatura', async () => {
    const token = await assinarAtribuicao(DEV, APP, SECRET, AGORA);
    // troca o corpo mantendo a assinatura → deve falhar
    const [, mac] = token.split('.');
    const forjadoPayload = Buffer.from(JSON.stringify({ d: 'device-hacker', a: APP, e: AGORA + 999999 }))
        .toString('base64url');
    const forjado = `${forjadoPayload}.${mac}`;
    const r = await validarAtribuicao(forjado, SECRET, AGORA + 1000);
    assert.equal(r.valido, false);
    assert.equal(r.motivo, 'assinatura');
});

test('#13 token expirado é rejeitado', async () => {
    const token = await assinarAtribuicao(DEV, APP, SECRET, AGORA, 1000); // validade 1s
    const r = await validarAtribuicao(token, SECRET, AGORA + 2000); // 2s depois
    assert.equal(r.valido, false);
    assert.equal(r.motivo, 'expirado');
});

test('#13 formato inválido é rejeitado', async () => {
    for (const bad of ['', 'semponto', 'a.b.c', '.x', 'x.']) {
        const r = await validarAtribuicao(bad, SECRET, AGORA);
        assert.equal(r.valido, false);
        assert.equal(r.motivo, 'formato');
    }
});
