export type TrackingStatus =
    | 'confirmado'
    | 'postado'
    | 'transito_internacional'
    | 'alfandega'
    | 'transito_nacional'
    | 'saiu_para_entrega'
    | 'entregue'
    | 'problema'
    | 'desconhecido';

/** Vocabulário único usado por Shopify, painel, jornadas e app. */
export function normalizeTrackingStatus(value: unknown): TrackingStatus {
    const status = String(value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s-]+/g, '_');

    if (!status) return 'desconhecido';
    if (/delivered|entregue/.test(status)) return 'entregue';
    if (/out_for_delivery|saiu_para_entrega/.test(status)) return 'saiu_para_entrega';
    if (/custom|alfandeg|aduaneir/.test(status)) return 'alfandega';
    if (/failure|failed|error|exception|attempted_delivery|problema/.test(status)) return 'problema';
    if (/international|import|transito_internacional/.test(status)) return 'transito_internacional';
    if (/in_transit|transit|transito_nacional/.test(status)) return 'transito_nacional';
    if (/confirmed|label_purchased|label_printed|picked_up|ready_for_pickup|posted|postado/.test(status)) return 'postado';
    if (/open|pending|confirmado/.test(status)) return 'confirmado';
    return 'desconhecido';
}

export function trackingEventText(status: TrackingStatus): string {
    const messages: Record<TrackingStatus, string> = {
        confirmado: 'Recebemos seu pedido e ele está sendo preparado.',
        postado: 'Seu pedido foi postado e já está a caminho.',
        transito_internacional: 'Seu pedido está em trânsito internacional.',
        alfandega: 'Seu pedido está passando pelo processamento aduaneiro.',
        transito_nacional: 'Seu pedido já está em trânsito no país de destino.',
        saiu_para_entrega: 'Seu pedido saiu para entrega. Fique de olho!',
        entregue: 'Seu pedido foi entregue.',
        problema: 'A transportadora informou uma ocorrência na entrega.',
        desconhecido: 'Aguardando uma nova atualização da transportadora.',
    };
    return messages[status];
}
