import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { Task } from "@/types/lever-os";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, CalendarClock, Loader2, CheckCircle2, Pencil, Trash2, Search, Filter, X, ExternalLink, Clock, Plus, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useAgencyTeam } from "@/hooks/useAgencyTeam";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useSelectedClient } from "@/contexts/DashboardContext";
import { NewTaskModal } from "@/components/lever-os/NewTaskModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EditColumnModal } from "@/components/lever-os/EditColumnModal";
import { TaskDetailModal } from "@/components/lever-os/TaskDetailModal";
import { useTasks, TaskColumn } from "@/contexts/TasksContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface TasksViewProps {
    clientId?: string | null;
    title?: string;
    readOnly?: boolean;
    showClientName?: boolean;
    ignoreClientFilter?: boolean;
    headerTitle?: string;
    headerDescription?: string;
    projectTypeFilter?: 'fixo' | 'avulso';
}

export function TasksView({
    clientId: propClientId,
    title,
    readOnly = false,
    showClientName = true,
    ignoreClientFilter = false,
    headerTitle,
    headerDescription,
    projectTypeFilter
}: TasksViewProps) {
    const { selectedClientId, isLoading: clientLoading, clients } = useSelectedClient();
    const activeClientId = propClientId !== undefined ? propClientId : selectedClientId;

    const {
        tasks,
        columns,
        isLoading: tasksLoading,
        moveTask,
        openTaskDetail,
        closeTaskDetail,
        selectedTask,
        deleteTask,
        deleteColumn,
        updateColumn,
        moveColumn,
        addColumn,
        loadClientTasks
    } = useTasks();

    const { members: rawTeamMembers } = useAgencyTeam();
    const teamMembers = rawTeamMembers.map(m => ({
        id: m.user_id,
        name: m.profile?.full_name || 'Membro',
        avatarUrl: m.profile?.avatar_url || undefined
    })).filter(m => m.id && !m.id.startsWith('invited_'));

    // Add column inline state
    const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
    const [newColumnTitle, setNewColumnTitle] = useState("");
    const [isAddingColumn, setIsAddingColumn] = useState(false);

    const handleAddColumn = async () => {
        if (!newColumnTitle.trim()) return;
        setIsAddingColumn(true);
        try {
            await addColumn(newColumnTitle.trim(), 'bg-slate-500');
            toast.success("Coluna criada com sucesso!");
            setIsAddColumnOpen(false);
            setNewColumnTitle("");
        } catch (error) {
            toast.error("Erro ao criar coluna");
        } finally {
            setIsAddingColumn(false);
        }
    };

    const [localTasks, setLocalTasks] = useState<Task[]>([]);
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);

    // Filter states
    const [searchTerm, setSearchTerm] = useState("");
    const [filterPriority, setFilterPriority] = useState<string>("all");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [filterAssignee, setFilterAssignee] = useState<string>("all");
    // Ciclo de vida das concluídas: 'quadro' = board (Concluído ≤7d) | 'finalizadas' = aba (7-14d)
    const [boardView, setBoardView] = useState<'quadro' | 'finalizadas'>('quadro');

    const { canEdit, isAdmin } = usePermissions();
    const canEditDemands = canEdit('demands') && !readOnly;

    const isLoading = clientLoading || tasksLoading;

    // Sincronizar tasks do context com filtro do cliente e filtros locais
    // Extrair categorias únicas para os filtros (sem emojis)
    const stripEmojis = (str: string) => str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{FE0F}]/gu, '').trim();

    useEffect(() => {
        // Trigger load tasks based on mode
        loadClientTasks(ignoreClientFilter);
    }, [ignoreClientFilter, loadClientTasks]);

    // Mapa clientId → client_type, usado para herança quando a demanda tem projectType=null
    const clientTypeMap = useMemo(() => {
        const map = new Map<string, 'fixo' | 'avulso'>();
        for (const c of (clients as any[]) || []) {
            if (!c?.id) continue;
            map.set(c.id, c.client_type === 'fixo' ? 'fixo' : 'avulso');
        }
        return map;
    }, [clients]);

    useEffect(() => {
        let filtered = [...tasks];

        // 1. Filtragem por Cliente (Contexto Global) - ONLY if not ignored
        if (activeClientId && !ignoreClientFilter) {
            filtered = filtered.filter(t => t.clientId === activeClientId);
        }

        // 1.b. Filtragem por tipo de projeto (Fixo/Avulso) com herança do cliente
        if (projectTypeFilter) {
            filtered = filtered.filter(t => {
                if (t.projectType) return t.projectType === projectTypeFilter;
                // Herda do cliente: se cliente é fixo → demanda conta como fixo; senão avulso
                const inherited = clientTypeMap.get(t.clientId) || 'avulso';
                return inherited === projectTypeFilter;
            });
        }

        // 2. Filtragem por Termo de Busca
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(t =>
                t.title.toLowerCase().includes(term) ||
                t.description.toLowerCase().includes(term)
            );
        }

        // 3. Filtragem por Responsável (admin only)
        if (filterAssignee !== "all") {
            if (filterAssignee === "unassigned") {
                filtered = filtered.filter(t => !t.assigneeId);
            } else {
                filtered = filtered.filter(t => t.assigneeId === filterAssignee);
            }
        }

        // 4. Filtragem por Prioridade
        if (filterPriority !== "all") {
            filtered = filtered.filter(t => t.priority === filterPriority);
        }

        // 5. Filtragem por Categoria/Produto
        if (filterCategory !== "all") {
            filtered = filtered.filter(t =>
                (t.category && stripEmojis(t.category) === filterCategory) ||
                (t.productName && stripEmojis(t.productName) === filterCategory)
            );
        }

        setLocalTasks(filtered);
    }, [activeClientId, tasks, searchTerm, filterPriority, filterCategory, filterAssignee, ignoreClientFilter, projectTypeFilter, clientTypeMap]);
    const uniqueCategories = Array.from(new Set(tasks
        .map(t => t.category || t.productName)
        .filter(c => !!c)
        .map(c => stripEmojis(c!))
        .filter(c => c.length > 0)
    )) as string[];

    // Mapear localTasks para colunas, com defesa contra arrays vazios ou indefinidos
    const tasksByStatus = useMemo(() => {
        const acc: Record<string, Task[]> = {};

        // Inicializar todas as colunas existentes, mesmo que vazias
        if (Array.isArray(columns)) {
            columns.forEach(col => {
                if (col && col.id) {
                    acc[col.id] = [];
                }
            });
        }

        // Distribuir as tarefas
        if (Array.isArray(localTasks)) {
            localTasks.forEach(task => {
                if (task && task.status) {
                    if (!acc[task.status]) {
                        acc[task.status] = [];
                    }
                    acc[task.status].push(task);
                }
            });
        }

        // Ordenar tarefas dentro de cada coluna por order_position ou createdAt
        Object.keys(acc).forEach(status => {
            acc[status].sort((a, b) => {
                const posA = a?.order_position ?? Infinity;
                const posB = b?.order_position ?? Infinity;
                if (posA !== posB) return posA - posB;
                const dateA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateA - dateB;
            });
        });

        // Ciclo de vida das CONCLUÍDAS (sem cron, por completed_at):
        //   board "Concluído" = ≤7 dias · aba "Finalizadas" = 7-14 dias · >14 dias somem.
        //   archived_at (manual) esconde de tudo.
        const nowMs = Date.now();
        const ageDays = (t: Task) => t.completedAt ? (nowMs - new Date(t.completedAt).getTime()) / 86400000 : Infinity;
        const byCompletedDesc = (a: Task, b: Task) =>
            new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime();
        const concluidasVivas = (acc['concluido'] || []).filter(t => !t.archivedAt);
        acc['concluido'] = concluidasVivas.filter(t => ageDays(t) <= 7).sort(byCompletedDesc);
        acc['finalizadas'] = concluidasVivas.filter(t => { const d = ageDays(t); return d > 7 && d <= 14; }).sort(byCompletedDesc);

        return acc;
    }, [localTasks, columns]);

    // Colunas sintéticas pro ciclo de vida das concluídas (não dependem do flag hidden do DB).
    const SYNTH_CONCLUIDO = { id: 'concluido', title: 'Concluído', position: 90, color: 'bg-emerald-500' } as TaskColumn;
    const SYNTH_FINALIZADAS = { id: 'finalizadas', title: 'Finalizadas', position: 91, color: 'bg-teal-500' } as TaskColumn;
    const renderColumns: TaskColumn[] = boardView === 'finalizadas'
        ? [SYNTH_FINALIZADAS]
        : [...columns, SYNTH_CONCLUIDO];

    const [targetTask, setTargetTask] = useState<string | null>(null);
    const [dropSide, setDropSide] = useState<'top' | 'bottom' | null>(null);

    // Refs to track drag target without causing re-renders during rapid dragOver
    const targetTaskRef = useRef<string | null>(null);
    const dropSideRef = useRef<'top' | 'bottom' | null>(null);
    const rafRef = useRef<number | null>(null);

    // Store original card positions at drag start to avoid feedback loops
    const cardRectsRef = useRef<Map<string, { top: number; bottom: number; height: number }>>(new Map());
    const scrollContainerTopRef = useRef<number>(0);

    const syncDragState = () => {
        setTargetTask(targetTaskRef.current);
        setDropSide(dropSideRef.current);
        rafRef.current = null;
    };

    const scheduleDragSync = () => {
        if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(syncDragState);
        }
    };

    const handleDragStart = (e: React.DragEvent, task: Task) => {
        setDraggedTask(task);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData("text/plain", task.id);

        // Capture all card positions at drag start (before any layout shifts)
        const rects = new Map<string, { top: number; bottom: number; height: number }>();
        document.querySelectorAll('[data-task-id]').forEach(el => {
            const id = el.getAttribute('data-task-id');
            const rect = el.getBoundingClientRect();
            if (id) rects.set(id, { top: rect.top, bottom: rect.bottom, height: rect.height });
        });
        cardRectsRef.current = rects;

        // Store the scroll container top for relative calculations
        if (scrollContainerRef.current) {
            scrollContainerTopRef.current = scrollContainerRef.current.getBoundingClientRect().top;
        }
    };

    const handleDragOver = (e: React.DragEvent, targetStatus?: string, overTaskId?: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (overTaskId && overTaskId !== draggedTask?.id) {
            // Use stored rect from drag start to avoid feedback loops
            const storedRect = cardRectsRef.current.get(overTaskId);
            if (storedRect) {
                const relativeY = e.clientY - storedRect.top;
                const side = relativeY < storedRect.height / 2 ? 'top' : 'bottom';

                if (overTaskId !== targetTaskRef.current || side !== dropSideRef.current) {
                    targetTaskRef.current = overTaskId;
                    dropSideRef.current = side;
                    scheduleDragSync();
                }
            }
        }
        // Don't clear target when hovering gaps between cards
    };

    const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
        e.preventDefault();
        if (!canEditDemands || !draggedTask) return;
        // "finalizadas" é uma aba só-leitura (bucket por data), não um status real — não aceita drop.
        if (targetStatus === 'finalizadas') return;

        // Decide new position
        let newPosition = 0;
        const colTasks = localTasks
            .filter(t => t.status === targetStatus)
            .sort((a, b) => (a.order_position || 0) - (b.order_position || 0));

        if (targetTask) {
            const targetIdx = colTasks.findIndex(t => t.id === targetTask);
            if (targetIdx !== -1) {
                // Se soltar sobre o card, decide se vai antes ou depois baseado no dropSide
                const basePosition = (colTasks[targetIdx].order_position || 0);
                newPosition = dropSide === 'top' ? basePosition : basePosition + 0.5;
            }
        } else {
            // Se soltar na coluna vazia ou fora de cards, vai para o FINAL
            newPosition = colTasks.length > 0
                ? Math.max(...colTasks.map(t => t.order_position || 0)) + 1
                : 0;
        }

        moveTask(draggedTask.id, targetStatus as Task['status'], newPosition);

        setDraggedTask(null);
        setTargetTask(null);
        setDropSide(null);
        targetTaskRef.current = null;
        dropSideRef.current = null;
        cardRectsRef.current.clear();
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };

    const handleDragEnd = () => {
        setDraggedTask(null);
        setTargetTask(null);
        setDropSide(null);
        targetTaskRef.current = null;
        dropSideRef.current = null;
        cardRectsRef.current.clear();
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };

    const getTaskAssignee = (task: Task) => {
        if (!task || !task.id) return { id: '', name: 'Sem responsável', avatarUrl: undefined };

        // Resolve real assignee from team members
        if (task.assigneeId && teamMembers.length > 0) {
            const member = teamMembers.find(m => m.id === task.assigneeId);
            if (member) return member;
        }

        return { id: '', name: 'Sem responsável', avatarUrl: undefined };
    };

    const handleTaskCreated = (newTask: any) => {
        // Task sera adicionada via context
    };

    // Handler para clicar em uma task e abrir o modal
    const handleTaskClick = (task: Task) => {
        openTaskDetail(task);
    };

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
    const [columnToDelete, setColumnToDelete] = useState<{ id: string, title: string } | null>(null);

    // Handler para excluir task
    const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canEditDemands) return;
        setTaskToDelete(taskId);
        setDeleteConfirmOpen(true);
    };

    const confirmDeleteTask = async () => {
        if (!taskToDelete) return;
        try {
            await deleteTask(taskToDelete);
            // O toast agora é disparado dentro do context
        } catch (error) {
            console.error("Error deleting task:", error);
        } finally {
            setTaskToDelete(null);
            setDeleteConfirmOpen(false);
        }
    };

    const handleColumnDelete = (colId: string, colTitle: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canEditDemands) return;
        setColumnToDelete({ id: colId, title: colTitle });
    };

    const [columnToEdit, setColumnToEdit] = useState<TaskColumn | null>(null);

    const confirmDeleteColumn = async () => {
        if (!columnToDelete) return;
        try {
            await deleteColumn(columnToDelete.id);
            toast.success("Coluna excluída com sucesso");
        } catch (error) {
            console.error("Error deleting column:", error);
            toast.error("Erro ao excluir coluna");
        } finally {
            setColumnToDelete(null);
        }
    };

    // Drag to Scroll Logic
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDraggingScroll, setIsDraggingScroll] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return;
        // Só arrasta se clicar no fundo (não em cards ou botões)
        const target = e.target as HTMLElement;
        if (target !== scrollContainerRef.current && !target.classList.contains('kanban-column-container')) return;

        setIsDraggingScroll(true);
        setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
        setScrollLeft(scrollContainerRef.current.scrollLeft);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingScroll || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX) * 1.5;
        scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    };

    const handleMouseUp = () => {
        setIsDraggingScroll(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Carregando tarefas...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full">
            {(headerTitle || headerDescription) && (
                <div className="flex justify-between items-start mb-6">
                    <div>
                        {headerTitle && (
                            <h1 className="text-3xl font-black tracking-tight text-foreground">
                                {headerTitle}
                            </h1>
                        )}
                        {headerDescription && (
                            <p className="text-muted-foreground mt-1 max-w-2xl">
                                {headerDescription}
                            </p>
                        )}
                    </div>
                    {canEditDemands && !readOnly && (
                        <div className="flex items-center gap-2 mt-1">
                            <NewTaskModal onTaskCreated={handleTaskCreated} />
                        </div>
                    )}
                </div>
            )}

            {/* If no header was passed, just show the action buttons alone */}
            {!(headerTitle || headerDescription) && canEditDemands && !readOnly && (
                <div className="flex justify-end items-center mb-6">
                    <div className="flex items-center gap-2">
                        <NewTaskModal onTaskCreated={handleTaskCreated} />
                    </div>
                </div>
            )}

            {/* Barra de Filtros Premium */}
            <div className="flex flex-col md:flex-row gap-4 mb-8 items-end animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex-1 space-y-1.5 min-w-[300px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-1">Pesquisar Demanda</span>
                    <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                            <Search className="w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        </div>
                        <Input
                            placeholder="Título, descrição..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-11 bg-muted/20 border-border/50 focus:ring-1 focus:ring-primary shadow-none"
                            data-gramm="false"
                            data-1p-ignore="true"
                            spellCheck="false"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-muted/40 hover:bg-muted/60 p-0.5 rounded-full"
                            >
                                <X className="w-3 h-3 text-muted-foreground" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Dropdown Responsável (admin only) */}
                {isAdmin && (
                    <div className="space-y-1.5 w-[180px]">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-1">Responsável</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between h-11 bg-muted/20 border-border/50 shadow-none font-medium">
                                    <div className="flex items-center gap-2 truncate">
                                        {filterAssignee === "all" ? (
                                            <><Filter className="w-4 h-4 text-muted-foreground shrink-0" /><span>Todos</span></>
                                        ) : filterAssignee === "unassigned" ? (
                                            <span className="text-orange-400">Sem atribuição</span>
                                        ) : (
                                            <span className="truncate">{teamMembers.find(m => m.id === filterAssignee)?.name || 'Membro'}</span>
                                        )}
                                    </div>
                                    <MoreHorizontal className="w-3.5 h-3.5 opacity-40 shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[200px] p-2 max-h-[300px] overflow-y-auto">
                                <DropdownMenuItem onClick={() => setFilterAssignee("all")} className="rounded-md font-medium">Todos</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterAssignee("unassigned")} className="rounded-md text-orange-400 font-medium">
                                    Sem atribuição
                                </DropdownMenuItem>
                                <div className="h-px bg-border/50 my-1" />
                                {teamMembers.map(member => (
                                    <DropdownMenuItem
                                        key={member.id}
                                        onClick={() => setFilterAssignee(member.id)}
                                        className="rounded-md flex items-center gap-2"
                                    >
                                        <Avatar className="h-5 w-5">
                                            <AvatarImage src={member.avatarUrl} />
                                            <AvatarFallback className="text-[8px] font-bold bg-primary/10 text-primary">
                                                {member.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">{member.name}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}

                <div className="space-y-1.5 w-[160px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-1">Prioridade</span>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full justify-between h-11 bg-muted/20 border-border/50 shadow-none font-medium capitalize">
                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-muted-foreground" />
                                    {filterPriority === "all" ? "Todas" : filterPriority}
                                </div>
                                <MoreHorizontal className="w-3.5 h-3.5 opacity-40 shrink-0" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px] p-2">
                            <DropdownMenuItem onClick={() => setFilterPriority("all")} className="rounded-md">Todas</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFilterPriority("critical")} className="rounded-md text-red-600">Crítica</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFilterPriority("high")} className="rounded-md text-red-500">Alta</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFilterPriority("medium")} className="rounded-md text-orange-500">Média</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFilterPriority("low")} className="rounded-md text-green-500">Baixa</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>


                {(searchTerm || filterPriority !== "all" || filterCategory !== "all" || filterAssignee !== "all") && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 hover:bg-red-500/10 hover:text-red-500 group"
                        onClick={() => {
                            setSearchTerm("");
                            setFilterPriority("all");
                            setFilterCategory("all");
                            setFilterAssignee("all");
                        }}
                    >
                        <X className="w-5 h-5 opacity-40 group-hover:opacity-100" />
                    </Button>
                )}
            </div>

            <div className="flex items-center gap-1 mb-3">
                <Button
                    variant={boardView === 'quadro' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 rounded-lg text-xs font-semibold"
                    onClick={() => setBoardView('quadro')}
                >
                    Quadro
                </Button>
                <Button
                    variant={boardView === 'finalizadas' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 rounded-lg text-xs font-semibold"
                    onClick={() => setBoardView('finalizadas')}
                >
                    Finalizadas
                    <span className="ml-1.5 text-[10px] font-black text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {(tasksByStatus['finalizadas'] || []).length}
                    </span>
                </Button>
            </div>

            <div
                ref={scrollContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={cn(
                    "flex gap-4 items-stretch overflow-x-auto pb-4 custom-scrollbar kanban-column-container",
                    isDraggingScroll ? "cursor-grabbing" : "cursor-default"
                )}
            >
                {renderColumns.map((col, colIdx) => {
                    const colTasks = tasksByStatus[col.id] || [];
                    const isSynthetic = col.id === 'concluido' || col.id === 'finalizadas';

                    return (
                        <div
                            key={col.id}
                            className={cn(
                                "flex flex-col h-full min-w-[200px] flex-1 rounded-2xl bg-muted/20 border border-border/50 transition-all group/column shrink-0",
                                "shadow-[0_2px_10px_-3px_rgba(0,0,0,0.07)] hover:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.1)]",
                                draggedTask && "border-dashed border-primary/50"
                            )}
                            onDragOver={(e) => handleDragOver(e, col.id)}
                            onDragEnter={(e) => {
                                // Lógica extra para drag de colunas se implementado futuramente
                            }}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            <div
                                className="p-3 flex items-center justify-between border-b border-border/50 bg-muted/30 rounded-t-2xl cursor-grab active:cursor-grabbing"
                                draggable={canEditDemands && !isSynthetic}
                                onDragStart={(e) => {
                                    if (!canEditDemands || isSynthetic) return;
                                    e.dataTransfer.setData("columnId", col.id);
                                    e.dataTransfer.effectAllowed = "move";
                                    // Adicionar classe visual ou similar se desejar
                                }}
                                onDragOver={(e) => {
                                    if (!canEditDemands) return;
                                    e.preventDefault();
                                }}
                                onDrop={(e) => {
                                    if (!canEditDemands || isSynthetic) return;
                                    const sourceColId = e.dataTransfer.getData("columnId");
                                    if (sourceColId && sourceColId !== col.id) {
                                        moveColumn(sourceColId, colIdx);
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]", col.color)} />
                                    <span className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground/80 truncate max-w-[150px]">{col.title}</span>
                                    <span className="ml-1 text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                                        {colTasks.length}
                                    </span>
                                </div>
                                {canEditDemands && !isSynthetic && (
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover/column:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/5"
                                            onClick={(e) => { e.stopPropagation(); setColumnToEdit(col); }}
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                                            onClick={(e) => handleColumnDelete(col.id, col.title, e)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <div className="p-3 flex-1 overflow-y-auto space-y-4 min-h-[400px] max-h-[calc(100vh-320px)] custom-scrollbar">
                                {colTasks.map((task) => {
                                    const assignee = getTaskAssignee(task);
                                    const checklistProgress = task.checklist
                                        ? {
                                            completed: task.checklist.filter(c => c.isCompleted).length,
                                            total: task.checklist.length
                                        }
                                        : null;

                                    return (
                                        <Fragment key={task.id}>
                                            {targetTask === task.id && dropSide === 'top' && (
                                                <div className="h-16 border-2 border-dashed border-primary/30 rounded-2xl bg-primary/5 mx-0.5 shrink-0 pointer-events-none" />
                                            )}

                                            <div
                                                data-task-id={task.id}
                                                draggable={canEditDemands}
                                                onDragStart={(e) => canEditDemands && handleDragStart(e, task)}
                                                onDragEnd={handleDragEnd}
                                                onDragOver={(e) => {
                                                    if (canEditDemands) {
                                                        e.stopPropagation();
                                                        handleDragOver(e, col.id, task.id);
                                                    }
                                                }}
                                                onClick={() => !readOnly && handleTaskClick(task)}
                                                className={cn(
                                                    "bg-card text-card-foreground rounded-2xl border border-border/40 shadow-sm hover:shadow-md transition-all duration-300 group cursor-pointer overflow-hidden relative shrink-0",
                                                    draggedTask?.id === task.id && "opacity-40 ring-2 ring-primary scale-[0.98] rotate-2",
                                                    task.archivedAt && "opacity-60 border-green-500/30 bg-green-500/5"
                                                )}
                                            >
                                                {/* Invisible overlay to capture drag events and prevent child interference */}
                                                {draggedTask && draggedTask.id !== task.id && (
                                                    <div className="absolute inset-0 z-10" />
                                                )}
                                                {/* Cover Image */}
                                                {(task.coverImageUrl || task.images?.[0]) && (
                                                    <div className="relative w-full h-32 overflow-hidden border-b border-border/20">
                                                        <img
                                                            src={task.coverImageUrl || task.images![0]}
                                                            alt={task.title}
                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                )}

                                                <div className="p-3 space-y-3">
                                                    {/* Title & Menu */}
                                                    <div className="flex items-start justify-between gap-2 group/title">
                                                        <div className="space-y-1.5">
                                                            {showClientName && task.clientName && (
                                                                <span className="text-base font-black capitalize tracking-tight text-foreground block truncate">
                                                                    {task.clientName.toLowerCase()}
                                                                </span>
                                                            )}
                                                            <h4 className="text-sm font-medium leading-relaxed text-foreground/90 line-clamp-2 group-hover:text-primary transition-colors">
                                                                {task.title.replace(/^\[.*?\]\s*/, '')}
                                                            </h4>
                                                            {task.archivedAt && (
                                                                <div className="flex items-center gap-1 mt-1">
                                                                    <Archive className="w-3 h-3 text-green-500" />
                                                                    <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                                                                        Concluída {(() => {
                                                                            const days = Math.ceil((new Date(task.archivedAt).getTime() + 7 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000));
                                                                            return days > 0 ? `• arquiva em ${days}d` : '• arquivando...';
                                                                        })()}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {canEditDemands && (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 -mr-2 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-transparent"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <MoreHorizontal className="w-4 h-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-48 shadow-lg border-border">
                                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openTaskDetail(task); }}>
                                                                        <Pencil className="w-4 h-4 mr-2" />
                                                                        Editar Detalhes
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20"
                                                                        onClick={(e) => handleDeleteTask(task.id, e)}
                                                                    >
                                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                                        Excluir Demanda
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </div>

                                                    {/* Footer Info */}
                                                    <div className="flex items-center justify-between pt-2 border-t border-dashed border-border/40">
                                                        <div className="flex items-center gap-3 text-muted-foreground">
                                                            {/* Drive Link Shortcut */}
                                                            {task.drive_links && task.drive_links.length > 0 && (
                                                                <div
                                                                    className="flex items-center gap-1.5 text-[11px] text-blue-500 hover:text-blue-600 cursor-pointer transition-colors z-20"
                                                                    title={`Abrir: ${task.drive_links[0].title || 'Link Externo'}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        window.open(task.drive_links![0].url, '_blank');
                                                                    }}
                                                                >
                                                                    <svg className="w-3.5 h-3.5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="M6.6 66.85L3.3 61.35 29.05 17.15H57.65L31.3 61.35H6.6Z" fill="#0066DA" /><path d="M43.65 25.15L29.05 0H57.65L72.25 25.15H43.65Z" fill="#00AC47" /><path d="M72.25 25.15L87.3 53.75 61.55 53.75 43.65 25.15H72.25Z" fill="#EA4335" /><path d="M43.65 25.15L61.55 53.75 31.3 61.35 6.6 66.85Z" fill="#00832D" /><path d="M57.65 17.15L72.25 25.15 43.65 25.15 29.05 17.15H57.65Z" fill="#2684FC" /><path d="M87.3 53.75L72.25 25.15 84 61.35 80.65 66.85Z" fill="#FFBA00" /></svg>
                                                                </div>
                                                            )}

                                                            {/* Checklist Mini Status */}
                                                            {checklistProgress && checklistProgress.total > 0 && (
                                                                <div className="flex items-center gap-1.5 text-[11px]" title={`${checklistProgress.completed}/${checklistProgress.total} sub-tarefas concluídas`}>
                                                                    <CheckCircle2 className={cn("w-3 h-3", checklistProgress.completed === checklistProgress.total ? "text-green-500" : "text-muted-foreground")} />
                                                                    <span>{checklistProgress.completed}/{checklistProgress.total}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2.5">
                                                            {/* Created Date */}
                                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 font-medium">
                                                                <Clock className="w-2.5 h-2.5" />
                                                                <span>{(() => {
                                                                    if (!task.createdAt) return '-';
                                                                    const m = task.createdAt.match(/(\d{4})-(\d{2})-(\d{2})/);
                                                                    if (m) return `${m[3]}/${m[2]}`;
                                                                    return new Date(task.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                                                                })()}</span>
                                                            </div>

                                                            {/* Due Date */}
                                                            {task.dueDate && (
                                                                <div className={cn(
                                                                    "flex items-center gap-1.5 text-[11px] font-medium transition-colors",
                                                                    new Date(task.dueDate) < new Date() ? "text-red-500" : "text-muted-foreground font-semibold"
                                                                )}>
                                                                    <CalendarClock className="w-3 h-3" />
                                                                    <span>{(() => {
                                                                        const m = task.dueDate?.match(/(\d{4})-(\d{2})-(\d{2})/);
                                                                        if (m) {
                                                                            const months = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
                                                                            return `${parseInt(m[3])} de ${months[parseInt(m[2]) - 1]}`;
                                                                        }
                                                                        return new Date(task.dueDate!).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                                                                    })()}</span>
                                                                </div>
                                                            )}

                                                            {/* Priority Dot */}
                                                            <div className={cn(
                                                                "w-2 h-2 rounded-full",
                                                                task.priority === 'critical' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" :
                                                                    task.priority === 'high' ? "bg-orange-500" :
                                                                        task.priority === 'low' ? "bg-green-500" : "bg-slate-300"
                                                            )} />

                                                            {/* Assignee Avatar */}
                                                            <div className="pl-1">
                                                                <Avatar className="h-6 w-6 ring-2 ring-background transition-all hover:scale-110">
                                                                    <AvatarImage src={assignee.avatarUrl} />
                                                                    <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">
                                                                        {assignee.name.substring(0, 2).toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {targetTask === task.id && dropSide === 'bottom' && (
                                                <div className="h-16 border-2 border-dashed border-primary/30 rounded-2xl bg-primary/5 mx-0.5 shrink-0 pointer-events-none" />
                                            )}
                                        </Fragment>
                                    );

                                })}

                                {colTasks.length === 0 && (
                                    <div className={cn(
                                        "h-full flex items-center justify-center border-2 border-dashed border-muted rounded-md p-4 bg-muted/5 opacity-50 transition-all",
                                        draggedTask && "border-primary/50 bg-primary/5 opacity-100"
                                    )}>
                                        <p className="text-sm text-muted-foreground text-center">
                                            {draggedTask ? "Solte aqui" : "Sem tarefas"}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Add Column */}
                {canEditDemands && (
                    <div
                        className="flex flex-col h-full min-w-[200px] flex-1 rounded-2xl border-2 border-dashed border-border/20 hover:border-primary/30 hover:bg-primary/5 transition-all group/addcol shrink-0 cursor-pointer"
                        onClick={() => setIsAddColumnOpen(true)}
                    >
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[400px] max-h-[calc(100vh-320px)]">
                            <div className="p-3 bg-primary/10 rounded-full group-hover/addcol:scale-110 transition-transform">
                                <Plus className="h-5 w-5 text-primary" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 group-hover/addcol:text-primary transition-colors">Adicionar Coluna</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Dialog para Nova Coluna */}
            <Dialog open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
                <DialogContent className="rounded-[2rem] p-8 border-primary/20 bg-card/80 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Nova Coluna</DialogTitle>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="col-title-tasks" className="text-xs font-bold uppercase opacity-70">Nome da Coluna</Label>
                            <Input
                                id="col-title-tasks"
                                placeholder="Ex: Em Revisão, Arquivado..."
                                value={newColumnTitle}
                                onChange={(e) => setNewColumnTitle(e.target.value)}
                                className="h-12 rounded-xl bg-background/50 border-primary/10 focus:border-primary/40 focus:ring-primary/20"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAddColumnOpen(false)} className="rounded-xl h-12 font-bold uppercase tracking-widest text-[10px]">Cancelar</Button>
                        <Button onClick={handleAddColumn} disabled={isAddingColumn} className="rounded-xl h-12 px-8 font-black uppercase tracking-widest text-[11px] border border-slate-200">
                            {isAddingColumn ? "Criando..." : "Criar Coluna"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Detalhes da Tarefa */}
            {
                selectedTask && (
                    <TaskDetailModal
                        task={selectedTask}
                        isOpen={!!selectedTask}
                        onClose={closeTaskDetail}
                    />
                )
            }

            {/* Confirmação de Exclusão de Tarefa */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Demanda?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A demanda será removida permanentemente do banco de dados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteTask} className="bg-red-500 hover:bg-red-600">
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Confirmação de Exclusão de Coluna */}
            <AlertDialog open={!!columnToDelete} onOpenChange={(open) => !open && setColumnToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Coluna "{columnToDelete?.title}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Isso removerá a coluna. As tarefas vinculadas a ela não serão excluídas, mas podem ficar orfãs ou precisar ser movidas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteColumn} className="bg-red-500 hover:bg-red-600">
                            Excluir Coluna
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
