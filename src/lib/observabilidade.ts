/**
 * Observabilidade do NODE — Sentry (erros) + PostHog (produto/replay).
 *
 * Regras desta camada:
 * 1. TUDO gateado por env: sem VITE_SENTRY_DSN / VITE_POSTHOG_KEY, os módulos
 *    são inertes e os SDKs nem são baixados (import dinâmico). Deploy sem as
 *    chaves se comporta exatamente como hoje.
 * 2. A landing pública NÃO paga o peso: os SDKs iniciam no AppSistema (chunk do
 *    sistema). Na landing, só `capturarErro` existe — e baixa o Sentry sob
 *    demanda QUANDO um erro acontece (erro é raro; peso zero no caminho feliz).
 * 3. Nada de PII além de e-mail no identify; inputs mascarados no replay.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const PH_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const PH_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com';

let sentryCarregando: Promise<typeof import('@sentry/react')> | null = null;

async function carregarSentry() {
    if (!sentryCarregando) {
        sentryCarregando = import('@sentry/react').then((S) => {
            S.init({
                dsn: DSN,
                environment: import.meta.env.MODE,
                sendDefaultPii: false,
                tracesSampleRate: 0.1,
            });
            return S;
        });
    }
    return sentryCarregando;
}

/** Início completo (breadcrumbs, contexto) — chamar no AppSistema. */
export function iniciarSentry() {
    if (!DSN) return;
    void carregarSentry();
}

/** Captura pontual. Funciona em qualquer lugar (inclusive landing): se o SDK
 *  ainda não carregou, baixa na hora — só quem tem erro paga o download. */
export function capturarErro(erro: unknown, contexto?: Record<string, unknown>) {
    if (!DSN) {
        return; // sem Sentry configurado, o console.error de quem chamou já basta
    }
    void carregarSentry().then((S) =>
        S.captureException(erro, contexto ? { extra: contexto } : undefined),
    );
}

/** PostHog no sistema: autocapture + replay (inputs mascarados) + identify do
 *  usuário logado via Supabase — replay e funil por cliente, essencial pro suporte. */
export function iniciarPostHog() {
    if (!PH_KEY) return;
    void import('posthog-js').then(async ({ default: posthog }) => {
        posthog.init(PH_KEY, {
            api_host: PH_HOST,
            capture_pageview: true,
            session_recording: { maskAllInputs: true },
        });
        const { supabase } = await import('@/integrations/supabase/client');
        supabase.auth.onAuthStateChange((_evento, sessao) => {
            const u = sessao?.user;
            if (u) posthog.identify(u.id, { email: u.email });
            else posthog.reset();
        });
    });
}
