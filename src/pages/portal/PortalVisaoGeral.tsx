import { useEffect } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useDashboard } from "@/contexts/DashboardContext";
import OverviewClone from "@/pages/OverviewClone";

export default function PortalVisaoGeral() {
    const { linkedClientId } = usePermissions();
    const { setSelectedClient, selectedClientId } = useDashboard();

    // Auto-select the client's own ID
    useEffect(() => {
        if (linkedClientId && linkedClientId !== selectedClientId) {
            setSelectedClient(linkedClientId);
        }
    }, [linkedClientId, selectedClientId, setSelectedClient]);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
                <h1 className="text-3xl font-black tracking-tight">Visão Geral</h1>
                <p className="text-muted-foreground mt-1">
                    Acompanhe o desempenho das suas campanhas em tempo real.
                </p>
            </div>

            {/* The main dashboard component */}
            <OverviewClone />

            {/* Inject CSS to hide the client selector since it's forced */}
            <style>{`
                .ad-account-selector-container { display: none !important; }
            `}</style>
        </div>
    );
}
