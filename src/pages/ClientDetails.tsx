import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { ClientHeader } from "@/components/lever-os/ClientHeader";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Loader2, AlertCircle, ArrowLeft, Package, Folder, LayoutGrid, Layers } from "lucide-react";
import { AccessVault } from "@/components/lever-os/AccessVault";
import { ConnectionsHub } from "@/components/lever-os/ConnectionsHub";
import { ClientBriefingTab } from "@/components/lever-os/ClientBriefingTab";
import { OrdersTab } from "@/components/lever-os/OrdersTab";
import { DocumentsView } from "@/components/lever-os/DocumentsView";
import { ClientFormsView } from "@/components/lever-os/ClientFormsView";
import { ClientSettingsView } from "@/components/lever-os/ClientSettingsView";
import { SmartDataVizView } from "@/components/smart-data-viz/SmartDataVizView";
import { ClientPricingView } from "@/components/lever-os/ClientPricingView";
import { ClientOnboardingTab } from "@/components/lever-os/ClientOnboardingTab";
import { useSelectedClient, useDashboard } from "@/contexts/DashboardContext";
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
    const [searchParams, setSearchParams] = useSearchParams();
    const { setSelectedClient, clientData, isLoading, error, clients: allClients } = useSelectedClient();

    // Estado para rastrear conexões feitas
    const [connections, setConnections] = useState<{
        meta: boolean;
        shopify: boolean;
        kartpanda: boolean;
    }>({ meta: false, shopify: false, kartpanda: false });

    // Sincronizar o contexto global quando a página carregar com ID da URL
    useEffect(() => {
        if (id) {
            console.log('[ClientDetails] Setting selected client from URL:', id);
            setSelectedClient(id);
        }
    }, [id, setSelectedClient]);

    const handleConnectionChange = (type: 'meta' | 'shopify' | 'kartpanda', connected: boolean) => {
        setConnections(prev => ({ ...prev, [type]: connected }));
    };

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
            credentials: [],
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

    const assignedProductIds = (clientData as any)?.assigned_products || [];

    // Tab state - using searchParams that was defined at the top (hooks must be called unconditionally)
    const currentTab = searchParams.get("tab") || "onboarding";

    const handleTabChange = (value: string) => {
        setSearchParams({ tab: value });
    };

    const tabTitles: Record<string, { title: string, desc: string }> = {
        onboarding: {
            title: "Onboarding",
            desc: "Acompanhe o checklist e progresso de onboarding deste cliente."
        },
        briefing: { title: "Briefing", desc: "Visualize o briefing e dados coletados deste cliente." },
        connections: { title: "Conexões", desc: "Gerencie as integrações deste cliente." },
        files: { title: "Documentos", desc: "Acesse os arquivos e pastas deste cliente." },
        forms: { title: "Formulários", desc: "Gerencie os formulários recebidos." },
        "data-viz": { title: "Smart Data Viz", desc: "Métricas globais do projeto." },
        settings: { title: "Configurações", desc: "Gerencie os detalhes e o escopo deste cliente." }
    };


    return (
        <Tabs key={id} value={currentTab} onValueChange={handleTabChange} className="w-full">
            {/* Sticky header — stays at top when scrolling */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm">
                <div className="w-full px-10 py-6">
                    <ClientHeader
                        client={adaptedClient}
                        clientId={clientData!.id}
                        onClientUpdate={() => setSelectedClient(id!)}
                        activeTab={currentTab}
                        onTabChange={handleTabChange}
                        clientsList={(allClients || [])
                            .filter((c: any) => !c.is_archived)
                            .map((c: any) => ({ id: c.id, name: c.name }))
                        }
                        pageTitle={tabTitles[currentTab]?.title}
                        pageDescription={tabTitles[currentTab]?.desc}
                    />
                </div>
            </div>

            <div className="w-full px-10">

                <TabsContent value="onboarding" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <ClientOnboardingTab clientId={clientData!.id} />
                </TabsContent>

                <TabsContent value="briefing" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <ClientBriefingTab clientId={clientData!.id} clientName={clientData!.name} />
                </TabsContent>

                <TabsContent value="connections" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <ConnectionsHub onConnectionChange={handleConnectionChange} />
                </TabsContent>

                <TabsContent value="files" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <DocumentsView clientId={clientData!.id} />
                </TabsContent>

                <TabsContent value="pricing" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <ClientPricingView clientId={clientData!.id} />
                </TabsContent>

                <TabsContent value="forms" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <ClientFormsView />
                </TabsContent>

                <TabsContent value="data-viz" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <SmartDataVizView />
                </TabsContent>

                <TabsContent value="settings" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <ClientSettingsView
                        client={adaptedClient}
                        clientId={clientData!.id}
                        onClientUpdate={() => setSelectedClient(id!)}
                    />
                </TabsContent>
            </div>
        </Tabs>
    );
}
