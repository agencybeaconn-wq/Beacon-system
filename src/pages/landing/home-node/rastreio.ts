/**
 * Rastreio da landing NODE.
 *
 * Grava em DOIS lugares de propósito:
 *  1. PostHog — painel pronto, funil e sessão (já configurado no projeto)
 *  2. Tabela `landing_events` no Supabase da agência — o dado fica na casa da NODE,
 *     consultável por SQL e pronto pra virar painel interno depois
 *
 * Nunca lança erro pra cima: rastreio quebrado não pode derrubar clique de venda.
 *
 * ── POR QUE O CARREGAMENTO É PREGUIÇOSO ──
 * Estes dois módulos (posthog-js + cliente Supabase) pesam ~348KB e estavam no
 * TOPO do arquivo. Como a página importa este módulo, os dois entravam no caminho
 * crítico: o navegador precisava baixar e executar analytics ANTES de conseguir
 * pintar a landing. Medido: 753KB com eles, 405KB sem.
 *
 * Agora eles chegam depois da primeira pintura, e nada se perde: todo evento
 * disparado antes disso fica numa FILA que é descarregada na ordem assim que os
 * módulos sobem. Um clique de CTA também força o carregamento na hora, em vez de
 * esperar a ociosidade — conversão não espera.
 */

const UTM = ['utm_source', 'utm_medium', 'utm_campaign'] as const;

type EventoLanding = {
    evento: string;
    detalhe: string | null;
    path: string;
    referrer: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    dispositivo: string;
};

type Bagagem = { evento: string; detalhe?: string; payload: EventoLanding };

/* ── carregamento sob demanda ──────────────────────────────────────────── */

let carregando: Promise<void> | null = null;
let despachar: ((b: Bagagem) => void) | null = null;
const fila: Bagagem[] = [];
const LIMITE_FILA = 40; // trava de segurança: fila não pode virar vazamento de memória

function carregar(): Promise<void> {
    if (carregando) return carregando;
    carregando = (async () => {
        // os dois em paralelo; se um falhar, o outro ainda registra
        const [ph, sb] = await Promise.allSettled([
            import('posthog-js'),
            import('@/integrations/supabase/client'),
        ]);
        const posthog = ph.status === 'fulfilled' ? ph.value.default : null;
        const supabase = sb.status === 'fulfilled' ? sb.value.supabase : null;

        // A tabela `landing_events` é nova e os tipos gerados do Supabase ainda não a
        // conhecem. Cast escopado só a esta chamada — o formato do payload continua
        // garantido por EventoLanding. Ao regerar os tipos do banco, este bloco sai.
        const banco = supabase as unknown as {
            from(tabela: 'landing_events'): {
                insert(valor: EventoLanding): PromiseLike<{ error: { message: string } | null }>;
            };
        } | null;

        despachar = ({ evento, detalhe, payload }) => {
            try {
                posthog?.capture?.(evento, {
                    detalhe,
                    dispositivo: payload.dispositivo,
                    utm_source: payload.utm_source,
                    utm_medium: payload.utm_medium,
                    utm_campaign: payload.utm_campaign,
                });
            } catch { /* rastreio nunca bloqueia a ação do usuário */ }

            try {
                void banco?.from('landing_events').insert(payload).then(({ error }) => {
                    if (error) console.warn('[rastreio] falhou o registro do evento:', error.message);
                });
            } catch { /* idem */ }
        };

        // descarrega o que chegou antes dos módulos, na ordem original
        while (fila.length) despachar(fila.shift()!);
    })();
    return carregando;
}

/** Acorda o rastreio quando o navegador estiver ocioso, sem disputar com a pintura. */
function agendarCarga() {
    if (carregando) return;
    const ocioso = (window as unknown as {
        requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void;
    }).requestIdleCallback;
    if (ocioso) ocioso(() => { void carregar(); }, { timeout: 2500 });
    else setTimeout(() => { void carregar(); }, 1200);
}

if (typeof window !== 'undefined') {
    if (document.readyState === 'complete') agendarCarga();
    else window.addEventListener('load', agendarCarga, { once: true });
}

/* ── API pública (inalterada) ──────────────────────────────────────────── */

function origem() {
    try {
        const q = new URLSearchParams(window.location.search);
        const o: Record<string, string | null> = {};
        for (const k of UTM) o[k] = q.get(k);
        return o;
    } catch {
        return { utm_source: null, utm_medium: null, utm_campaign: null };
    }
}

export function registrar(evento: string, detalhe?: string) {
    try {
        const o = origem();
        const payload: EventoLanding = {
            evento,
            detalhe: detalhe ?? null,
            path: window.location.pathname.slice(0, 200),
            referrer: document.referrer ? document.referrer.slice(0, 300) : null,
            utm_source: o.utm_source,
            utm_medium: o.utm_medium,
            utm_campaign: o.utm_campaign,
            dispositivo: window.innerWidth < 760 ? 'mobile' : window.innerWidth < 1100 ? 'tablet' : 'desktop',
        };
        const bagagem: Bagagem = { evento, detalhe, payload };

        if (despachar) { despachar(bagagem); return; }
        if (fila.length < LIMITE_FILA) fila.push(bagagem);
        // evento real não espera ociosidade: puxa os módulos agora
        void carregar();
    } catch { /* rastreio nunca derruba clique de venda */ }
}

/** Marcos de scroll: diz até onde a pessoa leu antes de sair. Cada marco só uma vez. */
export function observarProfundidade() {
    const marcos: Array<[string, number]> = [
        ['viu_solucoes', 0.2],
        ['viu_clientes', 0.42],
        ['viu_ofertas', 0.6],
        ['viu_faq', 0.82],
        ['leu_ate_o_fim', 0.95],
    ];
    const feitos = new Set<string>();
    let raf = 0;

    const checar = () => {
        raf = 0;
        const total = document.documentElement.scrollHeight - window.innerHeight;
        if (total <= 0) return;
        const p = window.scrollY / total;
        for (const [nome, limiar] of marcos) {
            if (p >= limiar && !feitos.has(nome)) {
                feitos.add(nome);
                registrar('landing_scroll', nome);
            }
        }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(checar); };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
        window.removeEventListener('scroll', onScroll);
        if (raf) cancelAnimationFrame(raf);
    };
}
