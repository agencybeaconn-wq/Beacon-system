/**
 * Provider do PostHog para o app autenticado.
 *
 * O init saiu daqui para `@/lib/posthog` (idempotente). Motivo: enquanto a
 * inicialização era efeito colateral do import DESTE arquivo, o posthog-js
 * ficava preso ao pacote de entrada e todo visitante anônimo da landing baixava
 * a biblioteca antes da página pintar. A landing agora inicializa por conta
 * própria, dentro do rastreio, depois da primeira pintura.
 */
import { PostHogProvider as PostHogReactProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { garantirPostHog, postHogConfigurado, posthog } from '@/lib/posthog';

garantirPostHog();

function PostHogPageviewTracker() {
    const location = useLocation();

    useEffect(() => {
        if (postHogConfigurado && import.meta.env.MODE !== 'development') {
            posthog.capture('$pageview', { $current_url: window.location.href });
        }
    }, [location]);

    return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    if (!postHogConfigurado) {
        return <>{children}</>;
    }

    return (
        <PostHogReactProvider client={posthog}>
            <PostHogPageviewTracker />
            {children}
        </PostHogReactProvider>
    );
}
