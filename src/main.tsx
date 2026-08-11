import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import './i18n';

// Chunk velho pós-deploy: o Vite avisa quando o preload de um módulo dinâmico
// falha (arquivo com hash antigo que já não existe). Recarrega UMA vez por
// sessão pra pegar o HTML novo. Cobre falhas que acontecem antes de qualquer
// ErrorBoundary — o guarda por tempo impede loop.
window.addEventListener('vite:preloadError', () => {
    try {
        const CHAVE = '__reloadChunkEm';
        const ultimo = Number(sessionStorage.getItem(CHAVE) || 0);
        if (Date.now() - ultimo > 15000) {
            sessionStorage.setItem(CHAVE, String(Date.now()));
            window.location.reload();
        }
    } catch {
        window.location.reload();
    }
});

createRoot(document.getElementById("root")!).render(<App />);
