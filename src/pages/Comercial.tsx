import { useState, useEffect } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Plus, Trash2, AlertTriangle, Trophy, TrendingUp, Settings, Phone, Check } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LeadKanban } from "@/components/crm/LeadKanban";
import { LeadModal } from "@/components/crm/LeadModal";
import { ClientRankingModal } from "@/components/financial/ClientRankingModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface KanbanColumn {
    id: string;
    workspace_id: string;
    title: string;
    color: string | null;
    order_index: number;
}

export interface CrmLead {
    id: string;
    created_at: string;
    workspace_id: string;
    name: string;
    store_name: string | null;
    phone: string | null;
    email: string | null;
    lead_status: string; // Changed from enum to string to support dynamic titles
    lead_score: string | null;
    product_interest: string | null;
    observations: string | null;
    site_url?: string | null;
    column_id?: string;
    revenue?: string | null;
    offer_detail?: string | null;
    project_type?: string | null;
    project_timeline?: string | null;
    budget_range?: string | null;
    gclid?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
    landing_page?: string | null;
    referrer?: string | null;
}

export default function Comercial() {
    const { workspaceId } = useDashboard();
    const { canView, canEdit } = usePermissions();
    const [leads, setLeads] = useState<CrmLead[]>([]);
    const [columns, setColumns] = useState<KanbanColumn[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
    const [isRankingOpen, setIsRankingOpen] = useState(false);
    const [comercialPhone, setComercialPhone] = useState(() => localStorage.getItem('lever_comercial_phone') || '+55 31 99519-4872');
    const [phoneEditing, setPhoneEditing] = useState(false);

    const handleSavePhone = () => {
        localStorage.setItem('lever_comercial_phone', comercialPhone);
        toast.success('Número do comercial atualizado!');
        setPhoneEditing(false);
    };

    const fetchData = async (showLoading = true) => {
        if (!workspaceId) return;
        if (showLoading) setIsLoading(true);
        try {
            // Fetch Columns first
            const { data: colsData, error: colsError } = await supabase
                .from('crm_kanban_columns' as any)
                .select('*')
                .eq('workspace_id', workspaceId)
                .order('order_index', { ascending: true });

            if (colsError) throw colsError;
            setColumns((colsData as unknown as KanbanColumn[]) || []);

            // Fetch Leads (somente nao arquivados; os arquivados ficam em /settings)
            const { data: leadsData, error: leadsError } = await supabase
                .from('crm_leads')
                .select('*')
                .eq('workspace_id', workspaceId)
                .is('archived_at', null)
                .order('created_at', { ascending: false });

            if (leadsError) throw leadsError;
            setLeads(leadsData || []);
        } catch (error: any) {
            console.error('[Comercial] Error fetching data:', error);
            toast.error("Erro ao carregar dados: " + error.message);
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [workspaceId]);

    const handleAddLead = () => {
        setSelectedLead(null);
        setIsModalOpen(true);
    };

    const handleEditLead = (lead: CrmLead) => {
        setSelectedLead(lead);
        setIsModalOpen(true);
    };

    const handleLeadSaved = () => {
        setIsModalOpen(false);
        fetchData(false);
    };

    const confirmDeleteLead = (leadId: string) => {
        setLeadToDelete(leadId);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteLead = async () => {
        if (!leadToDelete) return;

        try {
            const { error } = await supabase
                .from('crm_leads')
                .delete()
                .eq('id', leadToDelete);

            if (error) throw error;
            toast.success("Lead excluído com sucesso!");
            fetchData(false);
        } catch (error: any) {
            toast.error("Erro ao excluir lead: " + error.message);
        } finally {
            setIsDeleteDialogOpen(false);
            setLeadToDelete(null);
        }
    };

    // Arquivar lead: marca archived_at, lead some do kanban e aparece em
    // /settings -> aba "Leads Arquivados". Restaurar limpa archived_at.
    const handleArchiveLead = async (leadId: string) => {
        try {
            const { error } = await supabase
                .from('crm_leads')
                .update({ archived_at: new Date().toISOString() } as any)
                .eq('id', leadId);

            if (error) throw error;
            toast.success("Lead arquivado", {
                description: "Disponível em Configurações → Leads Arquivados.",
            });
            setIsModalOpen(false);
            fetchData(false);
        } catch (error: any) {
            toast.error("Erro ao arquivar lead: " + error.message);
        }
    };

    const handleColumnsReordered = async (newColumns: KanbanColumn[]) => {
        setColumns(newColumns);

        try {
            // Update each column's order_index in Supabase
            const updates = newColumns.map((col, index) => ({
                id: col.id,
                workspace_id: workspaceId,
                title: col.title,
                color: col.color,
                order_index: index
            }));

            const { error } = await supabase
                .from('crm_kanban_columns' as any)
                .upsert(updates);

            if (error) throw error;
        } catch (error: any) {
            console.error('[Comercial] Error reordering columns:', error);
            toast.error("Erro ao salvar nova ordem das colunas");
        }
    };

    const handleUpdateColumn = async (updatedColumn: KanbanColumn) => {
        // Optimistic update
        setColumns(prev => prev.map(c => c.id === updatedColumn.id ? updatedColumn : c));

        try {
            const { error } = await supabase
                .from('crm_kanban_columns' as any)
                .update({
                    title: updatedColumn.title,
                    color: updatedColumn.color
                })
                .eq('id', updatedColumn.id);

            if (error) throw error;
            toast.success("Coluna atualizada!");
        } catch (error: any) {
            console.error('[Comercial] Error updating column:', error);
            toast.error("Erro ao atualizar coluna");
            fetchData(false); // Revert on error
        }
    };

    if (!canView('crm')) {
        return <div className="p-8 text-center text-muted-foreground">Acesso negado.</div>;
    }

    return (
        <div className="p-10 h-full min-h-screen flex flex-col bg-background/30 backdrop-blur-sm">
            <div className="flex items-start justify-between shrink-0 mb-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground capitalize">Comercial (CRM)</h1>
                    <p className="text-muted-foreground mt-1 max-w-2xl">Gerencie seus leads e acompanhe o funil de vendas com inteligência.</p>
                </div>
                {canEdit('crm') && (
                    <div className="flex items-center gap-3">
                        <Popover>
                            <PopoverTrigger asChild>
                                <button
                                    className="flex items-center gap-2.5 h-11 px-4 bg-secondary/50 border border-border rounded-xl hover:bg-secondary transition-all cursor-pointer group shadow-none"
                                >
                                    <Settings className="h-4 w-4 text-muted-foreground group-hover:rotate-90 transition-transform" strokeWidth={2.5} />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4" align="end">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-green-500" />
                                        <span className="text-sm font-semibold">WhatsApp do Comercial</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Número que recebe as notificações de novos leads do site.
                                    </p>
                                    <div className="flex gap-2">
                                        <Input
                                            value={comercialPhone}
                                            onChange={(e) => setComercialPhone(e.target.value)}
                                            placeholder="+55 31 99999-9999"
                                            className="text-sm"
                                        />
                                        <button
                                            onClick={handleSavePhone}
                                            className="flex items-center justify-center h-10 w-10 shrink-0 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                                        >
                                            <Check className="h-4 w-4 text-white" />
                                        </button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <button
                            onClick={() => setIsRankingOpen(true)}
                            className="flex items-center gap-2.5 h-11 px-4 bg-secondary/50 border border-border rounded-xl hover:bg-secondary transition-all cursor-pointer group shadow-none"
                        >
                            <Trophy className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                            <span className="font-bold text-[11px] uppercase tracking-widest text-muted-foreground">Ranking</span>
                        </button>

                        <button
                            onClick={handleAddLead}
                            className="flex items-center gap-2.5 h-11 px-5 rounded-xl transition-all cursor-pointer group bg-amber-500 hover:bg-amber-400 border border-amber-400/30"
                        >
                            <Plus className="h-4 w-4 text-black group-hover:rotate-90 transition-transform" strokeWidth={3} />
                            <span className="font-bold text-[11px] uppercase tracking-widest text-black">Novo Lead</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden pb-6">
                <LeadKanban
                    leads={leads}
                    columns={columns}
                    isLoading={isLoading}
                    onEditLead={handleEditLead}
                    onDeleteLead={confirmDeleteLead}
                    onArchiveLead={handleArchiveLead}
                    onLeadMoved={() => fetchData(false)}
                    onColumnsChanged={() => fetchData(false)}
                    onColumnsReordered={handleColumnsReordered}
                    onEditColumn={handleUpdateColumn}
                />
            </div>

            <LeadModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                leadToEdit={selectedLead}
                columns={columns}
                onSaved={handleLeadSaved}
                onArchive={handleArchiveLead}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="rounded-[2.5rem] p-8 border-primary/20 bg-card/80 backdrop-blur-xl shadow-2xl">
                    <AlertDialogHeader className="space-y-4">
                        <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center border border-destructive/20">
                            <AlertTriangle className="h-8 w-8 text-destructive" />
                        </div>
                        <AlertDialogTitle className="text-2xl font-bold text-center">Tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription className="text-center text-muted-foreground text-base">
                            Esta ação não pode ser desfeita. O lead será removido permanentemente do seu funil comercial.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 sm:gap-3 mt-8">
                        <AlertDialogCancel className="h-12 flex-1 rounded-2xl font-bold border-border/50 hover:bg-muted shadow-none">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteLead}
                            className="h-12 flex-1 rounded-2xl font-bold bg-destructive hover:bg-destructive/90 transition-all active:scale-95 shadow-none"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir Lead
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <ClientRankingModal
                isOpen={isRankingOpen}
                onOpenChange={setIsRankingOpen}
            />
        </div>
    );
}
