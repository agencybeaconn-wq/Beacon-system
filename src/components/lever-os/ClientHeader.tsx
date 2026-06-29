import { Client } from "@/types/lever-os";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Settings, Link2, ShoppingCart, FolderOpen, History, ClipboardList, Mail, BarChart3, ChevronLeft, ChevronRight, DollarSign, FileText, ListChecks } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InlineEditableName, EditableAvatar } from "@/components/clients/InlineEditing";
import { useAgencyProducts, AgencyProduct } from "@/hooks/useAgencyProducts";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Archive, Trash2, Loader2, MoreVertical, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDashboard } from "@/contexts/DashboardContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


interface ClientHeaderProps {
    client: Client;
    clientId?: string;
    onClientUpdate?: () => void;
    activeTab?: string;
    onTabChange?: (value: string) => void;
    clientsList?: Array<{ id: string; name: string }>;
    pageTitle?: React.ReactNode;
    pageDescription?: React.ReactNode;
}

export function ClientHeader({ client, clientId, onClientUpdate, activeTab, onTabChange, clientsList = [], pageTitle, pageDescription }: ClientHeaderProps) {
    const { products: allProducts } = useAgencyProducts();
    const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();
    const { refreshClients } = useDashboard();

    // Linked email state
    const [linkedEmail, setLinkedEmail] = useState<string | null>(null);
    const { isAdmin } = usePermissions();
    const canManageClient = isAdmin;

    useEffect(() => {
        const fetchLinkedEmail = async () => {
            const id = clientId || client.id;
            if (!id) return;
            const { data } = await (supabase as any)
                .from('team_members')
                .select('email')
                .eq('linked_client_id', id)
                .limit(1)
                .maybeSingle();
            setLinkedEmail(data?.email || null);
        };
        fetchLinkedEmail();
    }, [clientId, client.id]);

    const handleArchiveClient = async () => {
        setIsArchiving(true);
        try {
            const { error } = await (supabase as any)
                .from('agency_clients')
                .update({ is_archived: true })
                .eq('id', clientId || client.id);

            if (error) throw error;
            toast({ title: "Cliente arquivado", description: `${client.name} foi movido para os arquivos.` });
            await refreshClients();
            navigate('/clients');
        } catch (error: any) {
            console.error("Erro ao arquivar:", error);
        } finally {
            setIsArchiving(false);
        }
    };

    const handleDeleteClient = async () => {
        setIsDeleting(true);
        try {
            const { error } = await (supabase as any)
                .from('agency_clients')
                .delete()
                .eq('id', clientId || client.id);

            if (error) throw error;
            toast({ title: "Cliente excluído", description: `${client.name} foi removido permanentemente.` });
            await refreshClients();
            navigate('/clients');
        } catch (error: any) {
            console.error("Erro ao excluir:", error);
        } finally {
            setIsDeleting(false);
        }
    };

    const assignedProducts = useMemo(() => {
        if (!client.assignedProductIds || !allProducts) return [];
        return allProducts.filter((p: AgencyProduct) => client.assignedProductIds?.includes(p.id));
    }, [client.assignedProductIds, allProducts]);

    const navigate = useNavigate();

    const statusConfig = {
        onboarding: { label: "Onboarding", color: "bg-blue-500", bgLight: "bg-blue-500/10", text: "text-blue-500" },
        implementation: { label: "Implementação", color: "bg-amber-500", bgLight: "bg-amber-500/10", text: "text-amber-500" },
        growth: { label: "Escala & Growth", color: "bg-emerald-500", bgLight: "bg-emerald-500/10", text: "text-emerald-500" },
        churned: { label: "Encerrado", color: "bg-red-500", bgLight: "bg-red-500/10", text: "text-red-500" }
    };

    const currentStatus = statusConfig[client.status] || statusConfig.onboarding;

    const handleNameChange = (newName: string) => {
        onClientUpdate?.();
    };

    const safeFinancials = client.financials || { fixedFee: 0 };

    // Compute prev/next client for navigation
    const currentIndex = clientsList.findIndex(c => c.id === (clientId || client.id));
    const prevClient = currentIndex > 0 ? clientsList[currentIndex - 1] : null;
    const nextClient = currentIndex < clientsList.length - 1 ? clientsList[currentIndex + 1] : null;

    return (
        <div className="w-full space-y-4">
            {/* Top Nav */}
            <div className="flex items-center justify-between px-1">
                <div className="flex-1">
                    {pageTitle && <h2 className="text-2xl font-bold tracking-tight">{pageTitle}</h2>}
                    {pageDescription && <p className="text-muted-foreground text-sm">{pageDescription}</p>}
                </div>

                {/* Navigation Tabs Moved to Right Side */}
                {onTabChange && (
                    <div className="overflow-x-auto no-scrollbar">
                        <TabsList className="h-10 w-max shrink-0">
                            <TabsTrigger value="onboarding" className="gap-2">
                                <ListChecks className="w-4 h-4" />
                                <span className="font-semibold text-sm">Onboarding</span>
                            </TabsTrigger>
                            <TabsTrigger value="briefing" className="gap-2">
                                <FileText className="w-4 h-4" />
                                <span className="font-semibold text-sm">Briefing</span>
                            </TabsTrigger>
                            <TabsTrigger value="files" className="gap-2">
                                <FolderOpen className="w-4 h-4" />
                                <span className="font-semibold text-sm">Documentos</span>
                            </TabsTrigger>
                            <TabsTrigger value="pricing" className="gap-2">
                                <DollarSign className="w-4 h-4" />
                                <span className="font-semibold text-sm">Preços</span>
                            </TabsTrigger>
                            <TabsTrigger value="connections" className="gap-2">
                                <Link2 className="w-4 h-4" />
                                <span className="font-semibold text-sm">Conexões</span>
                            </TabsTrigger>
                            <TabsTrigger value="settings" className="gap-2">
                                <Settings className="w-4 h-4" />
                                <span className="font-semibold text-sm">Configurações</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>
                )}
            </div>
        </div>
    );
}
