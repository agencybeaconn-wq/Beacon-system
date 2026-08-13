/**
 * Observabilidade do NODE — Sentry (erros).
 *
 * (PostHog NÃO mora aqui: o produto/replay tem integração própria e anterior em
 * `@/lib/posthog.ts` — provider no AppShell + rastreio lazy na landing. Cheguei a
 * duplicar o init aqui em 2026-08-12 sem saber da existente; a fusão ficou na
 * integração antiga, que é a casa canônica. Uma fonte de verdade só.)
 *
 * Regras desta camada:
 * 1. Gateado por env: sem VITE_SENTRY_DSN o módulo é inerte e o SDK nem é baixado.
 * 2. A landing não paga o peso: init completo só no AppSistema; na landing,
 *    `capturarErro` baixa o SDK sob demanda QUANDO um erro acontece.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

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

