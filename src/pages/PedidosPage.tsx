import { Navigate } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { Users, Loader2 } from "lucide-react";

export default function PedidosPage() {
    const { selectedClientId, isLoading } = useDashboard();

    if (isLoading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    if (!selectedClientId) {
        const saved = localStorage.getItem('dashboard_selectedClientId') || localStorage.getItem('lever_selected_client_id');
        if (saved) return <Navigate to={`/clients/${saved}?tab=orders`} replace />;
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] gap-4 text-center px-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Selecione um Cliente</h2>
                <p className="text-muted-foreground max-w-md">Use o dropdown no cabeçalho para selecionar um cliente.</p>
            </div>
        );
    }

    return <Navigate to={`/clients/${selectedClientId}?tab=orders`} replace />;
}
