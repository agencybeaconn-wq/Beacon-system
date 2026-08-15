/**
 * Atribuição assinada (Fase 2 P1 #13). Cart attribute é público
 * (/cart/update.js) — qualquer visitante forja `app_source=beacon_app`. Sem
 * prova, atribuir receita (e futuro cashback) vira fraude. Aqui: o backend
 * emite um token HMAC vinculado a device+app+expiração; a bridge grava no
 * carrinho; o webhook valida antes de creditar o pedido ao app.
 *
 * Sem zod e com Web Crypto → roda em Deno (edge) e em node (teste).
 */

const enc = (s: string) => new TextEncoder().encode(s);

function b64url(bytes: Uint8Array): string {
    const s = btoa(String.fromCharCode(...bytes));
    return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
    const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
    return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
}

async function hmac(secret: string, msg: string): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
        'raw', enc(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc(msg)));
}

/** constant-time (mesmo comprimento sempre, HMAC é fixo). */
function ctEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

export interface AtribuicaoPayload {
    d: string; // device_id
    a: string; // app_id
    e: number; // expiração (epoch ms)
}

/** Token: `<payload b64url>.<hmac b64url>`. Expira em `validadeMs` (default 90d). */
export async function assinarAtribuicao(
    deviceId: string, appId: string, secret: string,
    agoraMs: number, validadeMs = 90 * 86400000,
): Promise<string> {
    const payload: AtribuicaoPayload = { d: deviceId, a: appId, e: agoraMs + validadeMs };
    const p = b64url(enc(JSON.stringify(payload)));
    const mac = b64url(await hmac(secret, p));
    return `${p}.${mac}`;
}

export interface ResultadoAtribuicao {
    valido: boolean;
    device_id: string | null;
    app_id: string | null;
    motivo: 'ok' | 'formato' | 'assinatura' | 'expirado';
}

export async function validarAtribuicao(
    token: string, secret: string, agoraMs: number,
): Promise<ResultadoAtribuicao> {
    const partes = (token ?? '').split('.');
    if (partes.length !== 2 || !partes[0] || !partes[1]) {
        return { valido: false, device_id: null, app_id: null, motivo: 'formato' };
    }
    const [p, macRecebido] = partes;
    const macEsperado = await hmac(secret, p);
    if (!ctEqual(b64urlDecode(macRecebido), macEsperado)) {
        return { valido: false, device_id: null, app_id: null, motivo: 'assinatura' };
    }
    let payload: AtribuicaoPayload;
    try {
        payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
    } catch {
        return { valido: false, device_id: null, app_id: null, motivo: 'formato' };
    }
    if (typeof payload.e !== 'number' || payload.e < agoraMs) {
        return { valido: false, device_id: payload.d ?? null, app_id: payload.a ?? null, motivo: 'expirado' };
    }
    return { valido: true, device_id: payload.d, app_id: payload.a, motivo: 'ok' };
}
