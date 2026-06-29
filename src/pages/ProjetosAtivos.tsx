import { useSelectedClient, useDashboard } from "@/contexts/DashboardContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewClientModal } from "@/components/clients/NewClientModal";
import { ActiveClientsColumnView } from "@/components/clients/ActiveClientsColumnView";

interface TasksByStatus {
    todo: number;
    in_progress: number;
    validation: number;
    revision: number;
    review: number;
    pending: number;
}

interface ActiveClient {
    id: string;
    name: string;
    project_name: string | null;
    logo_url: string | null;
    client_type: string | null;
    created_at: string;
    project_deadline: string | null;
    primaryColor?: string;
    activeTaskCount: number;
    latestDueDate: string | null;
    tasksByStatus?: TasksByStatus;
}

export default function ProjetosAtivos() {
    const { setSelectedClient, clients, isLoading: isLoadingClients } = useSelectedClient();
    const { workspaceId } = useDashboard();
    const navigate = useNavigate();
    const [activeClients, setActiveClients] = useState<ActiveClient[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchActiveProjects = async () => {
            setIsLoading(true);
            try {
                let taskQuery = (supabase as any)
                    .from('client_tasks')
                    .select('client_id, due_date, status, archived_at, workspace_id')
                    .in('status', ['pending', 'todo', 'in_progress', 'validation', 'revision', 'review'])
                    .is('archived_at', null);

                // Isolar por workspace — mesmo escopo do TasksView
                if (workspaceId) {
                    taskQuery = taskQuery.eq('workspace_id', workspaceId);
                }

                const { data: taskData } = await taskQuery;

                const emptyStatus = (): TasksByStatus => ({ todo: 0, in_progress: 0, validation: 0, revision: 0, review: 0, pending: 0 });
                const taskMap = new Map<string, { count: number; latestDue: string | null; byStatus: TasksByStatus }>();
                for (const t of (taskData || [])) {
                    if (!t.client_id) continue;
                    const existing = taskMap.get(t.client_id) || { count: 0, latestDue: null, byStatus: emptyStatus() };
                    existing.count++;
                    if (t.status && t.status in existing.byStatus) {
                        (existing.byStatus as any)[t.status]++;
                    }
                    if (t.due_date && (!existing.latestDue || t.due_date > existing.latestDue)) {
                        existing.latestDue = t.due_date;
                    }
                    taskMap.set(t.client_id, existing);
                }

                const result: ActiveClient[] = [];
                for (const client of clients) {
                    const c = client as any;
                    const taskInfo = taskMap.get(c.id);

                    result.push({
                        id: c.id,
                        name: c.name,
                        project_name: c.project_name || null,
                        logo_url: c.logo_url || null,
                        client_type: c.client_type || 'avulso',
                        created_at: c.created_at,
                        project_deadline: c.project_deadline || null,
                        primaryColor: c.primaryColor,
                        activeTaskCount: taskInfo?.count || 0,
                        latestDueDate: taskInfo?.latestDue || null,
                        tasksByStatus: taskInfo?.byStatus || emptyStatus(),
                    });
                }

                setActiveClients(result);
            } catch (err) {
                console.error('[ProjetosAtivos] Error fetching active projects:', err);
            } finally {
                setIsLoading(false);
            }
        };

        if (clients.length > 0) {
            fetchActiveProjects();
        } else if (!isLoadingClients) {
            setIsLoading(false);
        }
    }, [clients, isLoadingClients, workspaceId]);

    const onlyActive = useMemo(
        () => activeClients.filter(c => c.activeTaskCount > 0),
        [activeClients]
    );

    const location = useLocation();
    const handleSelectClient = (clientId: string) => {
        setSelectedClient(clientId);
        const client = activeClients.find(c => c.id === clientId);
        const type = client?.client_type === 'fixo' ? 'fixo' : 'avulso';
        // Detecta se está no layout do funcionário (/agency/*) e roteia correspondentemente
        const isAgencyLayout = location.pathname.startsWith('/agency/');
        const basePath = isAgencyLayout ? '/agency/general-board' : '/tasks';
        navigate(`${basePath}?type=${type}`);
    };

    if (isLoading || isLoadingClients) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">
                        Prazos de Entrega
                    </h1>
                    <p className="text-muted-foreground mt-1 max-w-2xl">
                        Clientes com demandas em andamento, ordenados por urgência do prazo — atrasados no topo.
                    </p>
                </div>
                <NewClientModal trigger={
                    <Button className="font-bold gap-2">
                        <Plus className="w-4 h-4" />
                        Novo Cliente
                    </Button>
                } />
            </div>

            {onlyActive.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center">
                        <FolderOpen className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-medium">
                        Nenhum projeto ativo no momento.
                    </p>
                </div>
            ) : (
                <ActiveClientsColumnView
                    clients={onlyActive}
                    onSelectClient={handleSelectClient}
                />
            )}
        </div>
    );
}
