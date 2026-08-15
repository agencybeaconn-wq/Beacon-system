/**
 * Lógica PURA do receiver de webhooks (Fase 3 — testes de produto). Extraída de
 * app-shopify-webhooks/index.ts pra ser testável em node sem banco/rede. O
 * index importa daqui (fonte única — nada de cópia paralela que diverge).
 *
 * Sem zod, sem Deno: só `import type` (apagado em runtime) → roda com
 * `node --experimental-strip-types`.
 */
import type { TrackingStatus } from './tracking-status.ts';

/** Vereditos que o HMAC (attribution.ts, já testado) produz. */
export interface VeredictoAtribuicao {
    valido: boolean;
    app_id: string | null;
    device_id: string | null;
}

export type MotivoAtribuicao = 'ok' | 'sem_prova' | 'invalido' | 'outro_app';

/**
 * O GATE da receita (#13): um pedido só vira pedido-do-app com prova assinada.
 * Recebe o veredito já calculado (a validação HMAC é async e vive em
 * attribution.ts); aqui é só a decisão de negócio, 100% pura.
 *
 * - sem secret no ambiente OU sem token no carrinho → não é do app (cart
 *   attribute público é forjável; ausência de prova = ausência de crédito).
 * - token inválido/expirado → não é do app.
 * - token de OUTRO app (mesmo tenant, app diferente) → não credita.
 */
export function deveAtribuirPedido(p: {
    secretPresente: boolean;
    token: string | null;
    veredito: VeredictoAtribuicao | null;
    appId: string;
}): { atribuir: boolean; motivo: MotivoAtribuicao; deviceCandidato: string | null } {
    if (!p.secretPresente || !p.token) return { atribuir: false, motivo: 'sem_prova', deviceCandidato: null };
    if (!p.veredito || !p.veredito.valido) return { atribuir: false, motivo: 'invalido', deviceCandidato: null };
    if (p.veredito.app_id !== p.appId) return { atribuir: false, motivo: 'outro_app', deviceCandidato: null };
    return { atribuir: true, motivo: 'ok', deviceCandidato: p.veredito.device_id };
}

/**
 * Shopify manda `fulfillment.status="success"` sem `shipment_status` no
 * primeiro post. A PRESENÇA de código de rastreio prova que já foi postado —
 * senão o pedido ficaria "desconhecido" com rastreio na mão do cliente.
 */
export function inferirStatusFulfillment(inferido: TrackingStatus, qtdRastreios: number): TrackingStatus {
    return inferido === 'desconhecido' && qtdRastreios > 0 ? 'postado' : inferido;
}

/**
 * Guarda anti-regressão: webhook atrasado/reenviado NÃO pode fazer o rastreio
 * andar pra trás (ex.: "saiu para entrega" voltar pra "em trânsito" porque um
 * evento antigo chegou depois). Compara timestamps; empate também é regressão
 * (evento já refletido). Sem histórico anterior, nunca é regressão.
 */
export function fulfillmentRegrediu(existenteUltimoEventoAt: string | null | undefined, novoEventoAtISO: string): boolean {
    if (!existenteUltimoEventoAt) return false;
    const anterior = new Date(existenteUltimoEventoAt).getTime();
    const novo = new Date(novoEventoAtISO).getTime();
    if (Number.isNaN(anterior) || Number.isNaN(novo)) return false; // data ruim não bloqueia atualização
    return novo <= anterior;
}
