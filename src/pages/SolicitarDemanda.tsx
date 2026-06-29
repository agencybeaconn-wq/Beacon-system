import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DemandForm } from "@/components/demands/DemandForm";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useDashboard } from "@/contexts/DashboardContext";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Client interface moved to DashboardContext


export default function SolicitarDemanda() {
    const { workspaceId, clients, isLoadingClients } = useDashboard();
    const [selectedClientId, setSelectedClientId] = useState<string>("");

    useEffect(() => {
        if (clients.length > 0 && !selectedClientId) {
            setSelectedClientId(clients[0].id);
        }
    }, [clients, selectedClientId]);

    const selectedClient = clients.find(c => c.id === selectedClientId);

    if (isLoadingClients) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!workspaceId) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-muted-foreground">Carregando workspace...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-6 pt-6 pb-8 px-2 md:px-4 w-full max-w-3xl mx-auto">
            {/* Page Header */}
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Solicitar Demanda
                </h1>
                <p className="text-muted-foreground">
                    Preencha o formulário abaixo para enviar uma nova solicitação.
                </p>
            </div>

            {/* Client Selector (for agency use) */}
            {clients.length > 1 && (
                <Card className="p-4 bg-card border-border/50">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                            Selecionar Cliente
                        </label>
                        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                            <SelectTrigger className="h-11">
                                <SelectValue placeholder="Escolha um cliente..." />
                            </SelectTrigger>
                            <SelectContent>
                                {clients.map(client => (
                                    <SelectItem key={client.id} value={client.id}>
                                        {client.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </Card>
            )}

            {/* Demand Form */}
            {selectedClientId && (
                <Card className="p-6 md:p-8 bg-card border-border/50">
                    <DemandForm
                        clientId={selectedClientId}
                        workspaceId={workspaceId}
                        clientName={selectedClient?.name}
                        onSuccess={() => {
                            // Could navigate or show success state
                        }}
                    />
                </Card>
            )}

            {clients.length === 0 && !isLoadingClients && (
                <Card className="p-8 bg-card border-border/50 text-center">
                    <p className="text-muted-foreground">
                        Nenhum cliente cadastrado. Cadastre um cliente primeiro para solicitar demandas.
                    </p>
                </Card>
            )}
        </div>
    );
}
