import type { SegmentDefinition } from './app-contracts.ts';

/**
 * Decisão pura de "quem recebe o push" — extraída do push-dispatch pra ser
 * testável sem banco NEM zod (o I/O e o parse ficam na edge; aqui só a regra).
 * `import type` é apagado no runtime, então este módulo roda em node puro.
 *
 * Correções da auditoria 2026-08-14: #18 (segmento fail-closed), #9/#17 (teto
 * único aplicado a campanha E jornada de marketing) e #8 (estado de campanha).
 */

export interface DeviceMin {
    id: string;
    platform: string;
    shopify_customer_id: string | null;
    first_seen_at: string;
    last_seen_at: string;
}

export interface CustomerAgg {
    shopify_customer_id: string;
    orders_app_count: number;
    total_spent_app: number;
}

/** Segmento resolvido pelo chamador: a def parseada, ou por que não resolveu. */
export type SegmentoResolvido = SegmentDefinition | 'ausente' | 'invalido' | null;

export interface ResolucaoAlvo {
    alvo: DeviceMin[];
    motivo: 'ok' | 'sem_devices' | 'segmento_invalido' | 'segmento_ausente';
}

/**
 * #18 FAIL-CLOSED: segmento pedido que não resolve ('ausente'/'invalido') →
 * alvo VAZIO, nunca a base inteira. `null` = nenhum segmento pedido (todos).
 */
export function resolverAlvoPuro(
    devices: DeviceMin[],
    clientes: CustomerAgg[],
    segmento: SegmentoResolvido,
    agoraMs: number,
): ResolucaoAlvo {
    if (devices.length === 0) return { alvo: [], motivo: 'sem_devices' };
    if (segmento === null) return { alvo: devices, motivo: 'ok' };
    if (segmento === 'ausente') return { alvo: [], motivo: 'segmento_ausente' };
    if (segmento === 'invalido') return { alvo: [], motivo: 'segmento_invalido' };

    const f = segmento;
    const dias = (iso: string) => (agoraMs - new Date(iso).getTime()) / 86400000;
    let alvo = devices;

    if (f.platform) alvo = alvo.filter((d) => d.platform === f.platform);
    if (f.inativo_dias !== null) alvo = alvo.filter((d) => dias(d.last_seen_at) >= f.inativo_dias!);
    if (f.instalou_ha_dias !== null) alvo = alvo.filter((d) => dias(d.first_seen_at) <= f.instalou_ha_dias!);

    if (f.comprou !== null || f.gasto_minimo !== null) {
        const porId = new Map<string, { pedidos: number; gasto: number }>(
            clientes.map((c) => [
                String(c.shopify_customer_id),
                { pedidos: Number(c.orders_app_count ?? 0), gasto: Number(c.total_spent_app ?? 0) },
            ]),
        );
        alvo = alvo.filter((d) => {
            const c = d.shopify_customer_id ? porId.get(d.shopify_customer_id) : undefined;
            const comprou = !!c && c.pedidos > 0;
            if (f.comprou === 'sim' && !comprou) return false;
            if (f.comprou === 'nao' && comprou) return false;
            if (f.gasto_minimo !== null && (c?.gasto ?? 0) < f.gasto_minimo) return false;
            return true;
        });
    }
    return { alvo, motivo: 'ok' };
}

/**
 * #9/#17 TETO ÚNICO: remove devices que já bateram a cota diária de push de
 * MARKETING (campanha + jornada). Rastreio é transacional e não passa aqui.
 */
export function aplicarTetoPuro(
    devices: DeviceMin[],
    contagemPorDevice: Map<string, number>,
    tetoDia: number,
): { permitidos: DeviceMin[]; bloqueados: number } {
    const permitidos = devices.filter((d) => (contagemPorDevice.get(d.id) ?? 0) < tetoDia);
    return { permitidos, bloqueados: devices.length - permitidos.length };
}

/**
 * #8 MÁQUINA DE ESTADO: 'enviada' NUNCA reabre; 'enviando' só é retomável se
 * stale (a function morreu no meio). Decisão de tempo fica no chamador.
 */
export const STATUS_CAMPANHA_CLAIMAVEL = ['rascunho', 'agendada', 'erro'] as const;

export function podeReivindicarCampanha(status: string, enviandoStale: boolean): boolean {
    if ((STATUS_CAMPANHA_CLAIMAVEL as readonly string[]).includes(status)) return true;
    return status === 'enviando' && enviandoStale;
}
