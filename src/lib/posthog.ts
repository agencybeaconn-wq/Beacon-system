/**
 * Init do PostHog em um lugar só, idempotente.
 *
 * Existe porque o init morava dentro do PostHogProvider, como efeito colateral de
 * import. Isso amarrava duas coisas que não precisam andar juntas: o provider React
 * (que só o app autenticado usa) e a inicialização da medição (que a landing também
 * precisa). Enquanto estavam amarrados, o posthog-js ficava no pacote de entrada e
 * era baixado por todo visitante anônimo antes da página pintar.
 *
 * Agora: o provider importa isto, e o rastreio da landing importa isto — sob demanda,
 * cada um no seu tempo. Chamar duas vezes não reinicializa.
 */
import posthog from 'posthog-js';

const chave = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const host = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

let iniciado = false;

/** Garante o init uma única vez. Devolve null se não houver credencial configurada. */
export function garantirPostHog() {
    if (typeof window === 'undefined' || !chave || !host) return null;
    if (iniciado) return posthog;
    iniciado = true;
    posthog.init(chave, {
        api_host: host,
        loaded: (ph) => {
            // em desenvolvimento não se mede nada
            if (import.meta.env.MODE === 'development') ph.opt_out_capturing();
        },
        // pageview é disparado à mão para cobrir a navegação SPA
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: true,
        // replay de sessão com inputs mascarados: assiste-se O QUE o usuário fez,
        // nunca o que digitou (senha, dados de cliente)
        session_recording: { maskAllInputs: true },
    });
    // Identifica o usuário logado (replay/funil POR CLIENTE — essencial pro suporte).
    // Import dinâmico: na landing, o supabase já chega lazy pelo rastreio; aqui só
    // penduramos o listener. Reset SÓ no logout explícito — resetar em sessão nula
    // regeneraria o id anônimo a cada visita e quebraria o funil da landing.
    void import('@/integrations/supabase/client')
        .then(({ supabase }) => {
            supabase.auth.onAuthStateChange((evento, sessao) => {
                const u = sessao?.user;
                if (u) posthog.identify(u.id, { email: u.email });
                else if (evento === 'SIGNED_OUT') posthog.reset();
            });
        })
        .catch(() => { /* sem supabase, segue anônimo */ });
    return posthog;
}

export const postHogConfigurado = Boolean(chave && host);
export { posthog };
