import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { ClientHeader } from "@/components/lever-os/ClientHeader";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { ClientSettingsView } from "@/components/lever-os/ClientSettingsView";
import { useSelectedClient } from "@/contexts/DashboardContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Client, OnboardingPhase, ClientStatus, ServiceType } from "@/types/lever-os";
import { useConvertProductsToPhases } from "@/components/clients/AssignedProducts";

// Generate a color based on client name
const generateColor = (name: string): string => {
    const colors = ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#8B5CF6', '#FF6B6B', '#4ECDC4', '#45B7D1'];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

export default function ClientDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const clientsListPath = location.pathname.startsWith('/agency') ? '/agency/clients' : '/clients';
    const { setSelectedClient, clientData, isLoading, error, clients: allClients } = useSelectedClient();

    // Sincronizar o contexto global quando a página carregar com ID da URL
    useEffect(() => {
        if (id) {
            setSelectedClient(id);
        }
    }, [id, setSelectedClient]);

    // Gerar fases baseadas nos produtos atribuídos (usando o novo hook)
    const productBasedPhases = useConvertProductsToPhases((clientData as any)?.assigned_products || []);

    // Adaptar dados do Supabase para o formato esperado pelo ClientHeader
    const adaptedClient: Client | null = useMemo(() => {
        if (!clientData) return null;

        return {
            id: clientData.id,
            name: clientData.name,
            primaryColor: clientData.primaryColor || generateColor(clientData.name),
            status: "onboarding" as ClientStatus,
            serviceType: "assessoria_completa" as ServiceType,
            serviceName: productBasedPhases.length > 0 ? productBasedPhases[0].title : undefined,
            progress: 0,
            financials: {
                fixedFee: clientData.fee_fixed || 0,
                variableFeePercentage: clientData.commission_rate || 0,
                currency: "BRL",
                contractStartDate: clientData.created_at || new Date().toISOString()
            },
            onboardingPhases: productBasedPhases.length > 0 ? productBasedPhases : [],
            assignedProductIds: (clientData as any)?.assigned_products || [],
            payment_due_day: (clientData as any)?.payment_due_day,
            workspace_id: clientData.workspace_id,
            client_type: (clientData as any)?.client_type || 'avulso',
            logo_url: (clientData as any)?.logo_url || null,
            whatsapp_group_jid: (clientData as any)?.whatsapp_group_jid || null,
            whatsapp_group_name: (clientData as any)?.whatsapp_group_name || null,
        } as Client;
    }, [clientData, productBasedPhases]);

    // Mostra loading enquanto carrega dados do cliente
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-100px)]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <span className="text-muted-foreground">Carregando projeto...</span>
                </div>
            </div>
        );
    }

    // Mostra erro se houver
    if (error) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-100px)]">
                <div className="flex flex-col items-center gap-3 text-destructive">
                    <AlertCircle className="w-10 h-10" />
                    <span>Erro ao carregar: {error.message}</span>
                    <Button variant="outline" onClick={() => navigate(clientsListPath)}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar para Clientes
                    </Button>
                </div>
            </div>
        );
    }

    // Cliente não encontrado
    if (!adaptedClient) {
        return (
            <div className="container mx-auto max-w-2xl pt-16">
                <Card className="border-dashed shadow-none">
                    <CardHeader className="text-center">
                        <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <CardTitle>Cliente não encontrado</CardTitle>
                        <CardDescription>
                            O cliente com ID "{id}" não existe ou foi removido.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <Button onClick={() => navigate(clientsListPath)} className="shadow-none">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Voltar para lista de clientes
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Página ÚNICA (2026-08): as abas Onboarding/Briefing/Documentos/Preços/
    // Conexões sairam — briefing e preços vivem no Briefing geral; a conexão
    // Shopify mora dentro do ClientSettingsView (ConnectionsHub onlyShopify).
    return (
        <div key={id} className="w-full">
            <div className="w-full px-10 py-6">
                <ClientHeader
                    client={adaptedClient}
                    clientId={clientData!.id}
                    onClientUpdate={() => setSelectedClient(id!)}
                    clientsList={(allClients || [])
                        .filter((c: any) => !c.is_archived)
                        .map((c: any) => ({ id: c.id, name: c.name }))
                    }
                />
            </div>

            <div className="w-full px-10 pb-10">
                <ClientSettingsView
                    client={adaptedClient}
                    clientId={clientData!.id}
                    onClientUpdate={() => setSelectedClient(id!)}
                />
            </div>
        </div>
    );
}
