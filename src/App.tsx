import { BrowserRouter, Routes, Route, useLocation, useNavigationType } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";

// Só a HomeNodeV2 fica no pacote inicial: ela é a home e precisa pintar na hora.
// TODO o sistema (providers, i18n, react-query e as rotas do SaaS) vive em
// AppSistema.tsx e só é baixado quando alguém sai das rotas públicas — quem só
// visita a home nunca baixa o admin. (Corte de peso, 2026-08-12.)
import HomeNodeV2 from "./pages/landing/home-node/page-v2";
import { ErrorBoundary } from "./components/ErrorBoundary";

const HomeNode = lazy(() => import("./pages/landing/home-node/page"));
const ServicoPage = lazy(() => import("./pages/landing/servicos/ServicoPage"));
const AppSistema = lazy(() => import("./AppSistema"));

function RolarParaTopo() {
  const { pathname } = useLocation();
  const tipoNavegacao = useNavigationType();
  useEffect(() => {
    if (tipoNavegacao === 'POP') return;
    if (!PAGINAS_PUBLICAS.includes(pathname)) return;
    window.scrollTo(0, 0);
  }, [pathname, tipoNavegacao]);
  return null;
}

const RouteFallback = () => (
  <div style={{ minHeight: "100vh", background: "#08090C" }} aria-busy="true" />
);

// Deep links (convite web + OAuth do app iOS) sem pesar o pacote da landing:
// o hash de convite é JS puro; o listener do Capacitor só é criado quando o
// runtime nativo existe — no navegador nada é baixado.
function DeepLinks() {
  useEffect(() => {
    const hash = window.location.hash;
    const pathname = window.location.pathname;
    if (hash && hash.includes('access_token') && hash.includes('type=invite')) {
      if (!pathname.includes('/auth/accept-invite')) {
        window.location.href = '/auth/accept-invite' + hash;
        return;
      }
    }
    if (!(window as unknown as { Capacitor?: unknown }).Capacitor) return;
    import("@capacitor/app").then(({ App: CapacitorApp }) => {
      CapacitorApp.addListener('appUrlOpen', async (event: { url: string }) => {
        try {
          const url = new URL(event.url);
          if (url.hash && url.hash.includes('access_token')) {
            const params = new URLSearchParams(url.hash.substring(1));
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');
            if (params.get('type') === 'invite') {
              window.location.href = '/auth/accept-invite' + url.hash;
              return;
            }
            if (access_token && refresh_token) {
              const { supabase } = await import("@/integrations/supabase/client");
              const { error } = await supabase.auth.setSession({ access_token, refresh_token });
              if (!error) window.location.href = '/';
            }
          }
        } catch (error) {
          console.error('[DeepLink] Erro processando URL:', error);
        }
      });
    });
    // App nunca desmonta: listener vive pela sessão inteira, sem cleanup.
  }, []);
  return null;
}

const App = () => (
  <BrowserRouter>
    <ErrorBoundary>
      <DeepLinks />
      <RolarParaTopo />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* ── PÚBLICAS: pintam sem baixar o sistema ── */}
          <Route path="/" element={<HomeNodeV2 />} />
          {/* /v2 continua respondendo: link e print antigos não quebram */}
          <Route path="/v2" element={<HomeNodeV2 />} />
          {/* home anterior preservada para comparação e rollback imediato */}
          <Route path="/v1" element={<HomeNode />} />
          <Route path="/criacao-de-sites" element={<ServicoPage />} />
          <Route path="/sistemas-e-ia" element={<ServicoPage />} />
          <Route path="/mentoria-de-ia" element={<ServicoPage />} />
          {/* ── SISTEMA: todo o resto chega sob demanda ── */}
          <Route path="/*" element={<AppSistema />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  </BrowserRouter>
);

export default App;
