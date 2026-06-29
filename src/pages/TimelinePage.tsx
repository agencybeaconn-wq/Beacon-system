import { useSelectedClient } from "@/contexts/DashboardContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowRight, Timer, ClipboardList, FolderOpen, Plus, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { NewClientModal } from "@/components/clients/NewClientModal";
import { cn } from "@/lib/utils";
import { fetchBatchOnboardingSummary } from "@/hooks/useBatchOnboardingSummary";

// Normaliza string para busca insensível a caixa e a acentos
const normalizeSearch = (s: string): string =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
    // Breakdown de demandas por status
    tasksByStatus?: TasksByStatus;
    // Dados de onboarding
    onboardingStatus?: string;
    currentPhaseName?: string | null;
    onboardingProgress?: number;
    onboardingTotalTasks?: number;
    onboardingCompletedTasks?: number;
    currentPhaseDueDate?: string | null;
}

export default function TimelinePage() {
    const { setSelectedClient, clients, isLoading: isLoadingClients } = useSelectedClient();
    const navigate = useNavigate();
    const location = useLocation();
    const isAgencyContext = location.pathname.startsWith('/agency');
    const [activeClients, setActiveClients] = useState<ActiveClient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<'all' | 'fixo' | 'avulso'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'priority' | 'tasks'>('name');
    const [searchTerm, setSearchTerm] = useState<string>('');

    useEffect(() => {
        const fetchActiveProjects = async () => {
            setIsLoading(true);
            try {
                // Only count truly active tasks (exclude completed, done, archived, backlog)
                const { data: taskData } = await (supabase as any)
                    .from('client_tasks')
                    .select('client_id, due_date, status, archived_at')
                    .in('status', ['pending', 'todo', 'in_progress', 'validation', 'revision', 'review'])
                    .is('archived_at', null);

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

                // Buscar dados de onboarding em batch
                const clientIds = clients.map((c: any) => c.id);
                const onbSummaryMap = await fetchBatchOnboardingSummary(clientIds);

                const result: ActiveClient[] = [];
                for (const client of clients) {
                    const c = client as any;
                    const taskInfo = taskMap.get(c.id);
                    const onbSummary = onbSummaryMap.get(c.id);

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
                        onboardingStatus: onbSummary?.onboardingStatus,
                        currentPhaseName: onbSummary?.currentPhaseName,
                        onboardingProgress: onbSummary?.progress,
                        onboardingTotalTasks: onbSummary?.totalTasks,
                        onboardingCompletedTasks: onbSummary?.completedTasks,
                        currentPhaseDueDate: onbSummary?.currentPhaseDueDate || null,
                    });
                }

                setActiveClients(result);
            } catch (err) {
                console.error('[Timeline] Error fetching active projects:', err);
            } finally {
                setIsLoading(false);
            }
        };

        if (clients.length > 0) {
            fetchActiveProjects();
        } else if (!isLoadingClients) {
            setIsLoading(false);
        }
    }, [clients, isLoadingClients]);

    // Filter and sort
    const filteredClients = useMemo(() => {
        let filtered = activeClients;
        if (typeFilter === 'fixo') {
            filtered = filtered.filter(c => c.client_type === 'fixo');
        } else if (typeFilter === 'avulso') {
            filtered = filtered.filter(c => !c.client_type || c.client_type === 'avulso');
        }

        // Busca por texto (nome + project_name), insensível a caixa e acentos
        if (searchTerm.trim()) {
            const q = normalizeSearch(searchTerm.trim());
            filtered = filtered.filter(c =>
                normalizeSearch(`${c.name || ''} ${c.project_name || ''}`).includes(q)
            );
        }

        // Sort
        if (sortBy === 'priority') {
            return [...filtered].sort((a, b) => {
                const getDeadlineMs = (c: ActiveClient) => {
                    if (c.project_deadline) return new Date(c.project_deadline).getTime();
                    if (c.latestDueDate) return new Date(c.latestDueDate).getTime();
                    return Infinity;
                };
                return getDeadlineMs(a) - getDeadlineMs(b);
            });
        }
        if (sortBy === 'tasks') {
            return [...filtered].sort((a, b) => b.activeTaskCount - a.activeTaskCount);
        }
        return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }, [activeClients, typeFilter, sortBy, searchTerm]);

    const countByType = useMemo(() => ({
        all: activeClients.length,
        fixo: activeClients.filter(c => c.client_type === 'fixo').length,
        avulso: activeClients.filter(c => !c.client_type || c.client_type === 'avulso').length,
    }), [activeClients]);

    const handleSelectClient = (clientId: string) => {
        setSelectedClient(clientId);
        navigate(isAgencyContext ? `/agency/clients/${clientId}` : `/clients/${clientId}`);
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
                        Clientes
                    </h1>
                    <p className="text-muted-foreground mt-1 max-w-2xl">
                        Gerencie todos os clientes e seus projetos.
                    </p>
                </div>
                <NewClientModal trigger={
                    <Button className="font-bold gap-2">
                        <Plus className="w-4 h-4" />
                        Novo Cliente
                    </Button>
                } />
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                            type="search"
                            placeholder="Buscar cliente ou projeto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-10 pl-9 pr-9"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-sm hover:bg-muted transition-colors"
                                aria-label="Limpar busca"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                    <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                        <TabsList className="h-10">
                            <TabsTrigger value="all">Todos ({countByType.all})</TabsTrigger>
                            <TabsTrigger value="fixo">Fixo / MRR ({countByType.fixo})</TabsTrigger>
                            <TabsTrigger value="avulso">Avulso ({countByType.avulso})</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={sortBy === 'priority' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSortBy(sortBy === 'priority' ? 'name' : 'priority')}
                        className={cn("gap-1.5 text-xs", sortBy === 'priority' && "bg-red-600 hover:bg-red-700 text-white")}
                    >
                        <Timer className="w-3.5 h-3.5" />
                        Prazo
                    </Button>
                    <Button
                        variant={sortBy === 'tasks' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSortBy(sortBy === 'tasks' ? 'name' : 'tasks')}
                        className={cn("gap-1.5 text-xs", sortBy === 'tasks' && "bg-red-600 hover:bg-red-700 text-white")}
                    >
                        <ClipboardList className="w-3.5 h-3.5" />
                        Demandas
                    </Button>
                </div>
            </div>

            {filteredClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center">
                        <FolderOpen className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-medium">
                        Nenhum projeto ativo no momento.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {filteredClients.map((client) => {
                        const initials = client.name
                            .split(' ')
                            .map((n: string) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase();

                        const clientType = client.client_type || 'avulso';
                        const displayName = client.project_name || client.name;

                        // Calculate deadline progress
                        const deadline = client.project_deadline
                            ? new Date(client.project_deadline)
                            : client.latestDueDate
                                ? new Date(client.latestDueDate)
                                : null;

                        let deadlineProgress = 0;
                        let daysRemaining = 0;
                        let isOverdue = false;

                        if (deadline) {
                            const created = new Date(client.created_at);
                            const now = new Date();
                            const totalMs = deadline.getTime() - created.getTime();
                            const elapsedMs = now.getTime() - created.getTime();
                            deadlineProgress = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 100;
                            daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                            isOverdue = now > deadline;
                        }

                        return (
                            <Card
                                key={client.id}
                                className="group flex flex-col h-full hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
                                onClick={() => handleSelectClient(client.id)}
                            >
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <Avatar className="h-12 w-12 border-2 border-border group-hover:border-primary transition-colors">
                                            <AvatarImage src={client.logo_url || ""} />
                                            <AvatarFallback className="font-bold bg-muted" style={{ backgroundColor: (client.primaryColor || '#666') + '20', color: client.primaryColor || '#666' }}>
                                                {initials}
                                            </AvatarFallback>
                                        </Avatar>
                                        <Badge
                                            className={cn(
                                                "text-[10px] font-bold uppercase tracking-wider border-0 px-2.5 py-0.5",
                                                clientType === 'fixo'
                                                    ? "bg-emerald-500/10 text-emerald-500"
                                                    : "bg-orange-500/10 text-orange-500"
                                            )}
                                        >
                                            {clientType === 'fixo' ? 'Fixo (MRR)' : 'Avulso'}
                                        </Badge>
                                    </div>
                                    <CardTitle className="mt-4 text-xl font-bold truncate">{displayName}</CardTitle>
                                    {client.project_name && (
                                        <p className="text-xs text-muted-foreground truncate">{client.name}</p>
                                    )}
                                </CardHeader>
                                <CardContent className="space-y-3 flex-1">
                                    {client.activeTaskCount > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <ClipboardList className="w-3.5 h-3.5" />
                                            <span>{client.activeTaskCount} demanda{client.activeTaskCount !== 1 ? 's' : ''} ativa{client.activeTaskCount !== 1 ? 's' : ''}</span>
                                        </div>
                                    )}

                                </CardContent>
                                <CardFooter className="mt-auto">
                                    <Button
                                        className="w-full font-bold group-hover:bg-primary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelectClient(client.id);
                                        }}
                                    >
                                        Ver Projeto
                                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
