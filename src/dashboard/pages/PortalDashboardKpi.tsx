import { usePermissions } from "@/contexts/PermissionsContext";
import OverviewClone from "@/pages/OverviewClone";

/**
 * Dashboard do CLIENTE (substitui PortalVisaoGeral).
 *
 * Diferenças vs Admin/Agency:
 *  - Slot 4 mostra Lucro Previsto (decidido por isClient=true no OverviewClone).
 *  - Força o clientId via `clientIdOverride={linkedClientId}` em vez de depender
 *    do `setSelectedClient` em useEffect (que tinha race condition e causava
 *    Faturamento/Gasto/ROAS zerados no primeiro render).
 *  - Esconde o selector de cliente do AdAccountSelector (cliente só vê dele).
 */
export default function PortalDashboardKpi() {
    const { linkedClientId } = usePermissions();

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
                <h1 className="text-3xl font-black tracking-tight">Visão Geral</h1>
                <p className="text-muted-foreground mt-1">
                    Acompanhe o desempenho das suas campanhas em tempo real.
                </p>
            </div>

            <OverviewClone clientIdOverride={linkedClientId} />

            {/* Esconde o selector de cliente — cliente só pode ver dele mesmo */}
            <style>{`.ad-account-selector-container { display: none !important; }`}</style>
        </div>
    );
}
