/**
 * Rastreio da landing NODE.
 *
 * Grava em DOIS lugares de propósito:
 *  1. PostHog — painel pronto, funil e sessão (já configurado no projeto)
 *  2. Tabela `landing_events` no Supabase da agência — o dado fica na casa da NODE,
 *     consultável por SQL e pronto pra virar painel interno depois
 *
 * Nunca lança erro pra cima: rastreio quebrado não pode derrubar clique de venda.
 */
import posthog from 'posthog-js';
import { supabase } from '@/integrations/supabase/client';

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

// A tabela `landing_events` é nova e os tipos gerados do Supabase ainda não a conhecem.
// Cast escopado só a esta chamada — o formato do payload continua garantido por
// EventoLanding acima. Ao regerar os tipos do banco, este bloco pode sair.
const banco = supabase as unknown as {
    from(tabela: 'landing_events'): {
        insert(valor: EventoLanding): PromiseLike<{ error: { message: string } | null }>;
    };
};

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
    const o = origem();
    const dispositivo = window.innerWidth < 760 ? 'mobile' : window.innerWidth < 1100 ? 'tablet' : 'desktop';

    // 1) PostHog — só se estiver inicializado (em dev ele está opt-out)
    try {
        posthog?.capture?.(evento, { detalhe, dispositivo, ...o });
    } catch { /* rastreio nunca bloqueia a ação do usuário */ }

    // 2) Banco da agência — dispara e esquece
    try {
        void banco.from('landing_events').insert({
            evento,
            detalhe: detalhe ?? null,
            path: window.location.pathname.slice(0, 200),
            referrer: document.referrer ? document.referrer.slice(0, 300) : null,
            utm_source: o.utm_source,
            utm_medium: o.utm_medium,
            utm_campaign: o.utm_campaign,
            dispositivo,
        }).then(({ error }) => {
            if (error) console.warn('[rastreio] falhou o registro do evento:', error.message);
        });
    } catch { /* idem */ }
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
