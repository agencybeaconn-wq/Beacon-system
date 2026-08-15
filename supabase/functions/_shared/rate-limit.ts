/**
 * Rate-limit dos endpoints públicos (Fase 2 P1 #12). Chama a função atômica
 * rate_limit_hit no Postgres. Dois baldes por request: por app_id (limite
 * generoso) e por IP hash (limite apertado, pega o abusador anônimo).
 *
 * O IP vem do x-forwarded-for; guardamos só um hash (nunca o IP cru).
 */

async function sha256Hex(input: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

export function ipDaRequest(req: Request): string {
    const fwd = req.headers.get('x-forwarded-for') ?? '';
    return fwd.split(',')[0].trim() || 'desconhecido';
}

/**
 * Retorna true se o request PODE prosseguir; false se estourou algum limite.
 * @param supabase   client service-role
 * @param acao       'register' | 'event' | 'error' (prefixo do balde)
 * @param appId      escopo por app (ou 'nulo')
 * @param req        pra extrair o IP
 * @param limites    { app: [n, janelaSeg], ip: [n, janelaSeg] }
 */
export async function dentroDoLimite(
    supabase: any,
    acao: string,
    appId: string,
    req: Request,
    limites: { app: [number, number]; ip: [number, number] },
): Promise<boolean> {
    try {
        const ipHash = await sha256Hex(ipDaRequest(req));
        const [{ data: okApp }, { data: okIp }] = await Promise.all([
            supabase.rpc('rate_limit_hit', {
                p_bucket: `${acao}:app:${appId}`, p_limite: limites.app[0], p_janela_seg: limites.app[1],
            }),
            supabase.rpc('rate_limit_hit', {
                p_bucket: `${acao}:ip:${ipHash}`, p_limite: limites.ip[0], p_janela_seg: limites.ip[1],
            }),
        ]);
        // fail-open em erro de infra: rate-limit nunca pode derrubar o serviço
        return okApp !== false && okIp !== false;
    } catch (e) {
        console.warn('[rate-limit] rpc falhou, liberando', (e as any)?.message);
        return true;
    }
}
