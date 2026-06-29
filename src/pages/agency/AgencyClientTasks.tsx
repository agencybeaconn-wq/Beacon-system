import { useNavigate, useSearchParams } from "react-router-dom";
import { useDashboard } from "@/contexts/DashboardContext";
import { TasksView } from "@/components/lever-os/TasksView";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Briefcase, Calendar, CheckCircle2, Clock, Filter, Search, User } from "lucide-react";
import AgencyClients from "./AgencyClients";
import { useEffect, useState } from "react";

export default function AgencyClientTasks() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const clientId = searchParams.get("clientId");
    const { clients, isLoadingClients, workspaceId } = useDashboard();

    // Find the client name if an ID is selected
    const selectedClient = clients.find(c => c.id === clientId);

    const handleBack = () => {
        // Remove the clientId param to go back to selection mode
        setSearchParams({});
        // Alternatively navigate back to the client list page if that's the desired flow
        // navigate("/portal/clients");
    };

    if (!clientId) {
        // If no client selected, show the client list (Reusing PortalClients component logic or just redirecting)
        // For better UX, let's just render the list here so "Tarefas do Cliente" menu item works immediately
        return <AgencyClients />;
    }

    if (clientId && !selectedClient) {
        // Loading state or Invalid ID handling
        // We might be loading clients still
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handleBack} className="rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-black tracking-tight italic flex items-center gap-2">
                        <Briefcase className="w-6 h-6 text-primary" />
                        {selectedClient?.name || "Cliente"}
                    </h1>
                    <p className="text-muted-foreground">
                        Gerencie as demandas específicas deste cliente.
                    </p>
                </div>
            </div>

            <div className="bg-card border border-border/50 rounded-lg p-6 shadow-none min-h-[600px]">
                <TasksView
                    clientId={clientId}
                    title={`Demandas: ${selectedClient?.name}`}
                    readOnly={false} // Employees can interact
                />
            </div>
        </div>
    );
}
