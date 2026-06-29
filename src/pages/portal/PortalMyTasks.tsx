import { useState, useEffect, useCallback } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ClipboardCheck, ArrowRight, CheckCircle2, Clock, AlertCircle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink } from "lucide-react";

interface AssignedTask {
    id: string;
    title: string;
    description: string | null;
    status: 'pending' | 'in_progress' | 'done';
    priority: string;
    category: string | null;
    due_date: string | null;
    assigned_at: string;
    completed_at: string | null;
}

const COLUMNS = [
    { key: 'pending' as const, title: 'Pendente', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', borderColor: 'border-amber-500/30' },
    { key: 'in_progress' as const, title: 'Em Andamento', icon: ArrowRight, color: 'text-blue-500', bg: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
    { key: 'done' as const, title: 'Concluído', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' },
];

const PRIORITY_COLORS: Record<string, string> = {
    low: 'bg-slate-500/10 text-slate-500',
    medium: 'bg-blue-500/10 text-blue-500',
    high: 'bg-orange-500/10 text-orange-500',
    critical: 'bg-red-500/10 text-red-500',
};

const PRIORITY_LABELS: Record<string, string> = {
    low: 'Baixa',
    medium: 'Normal',
    high: 'Alta',
    critical: 'Urgente',
};

export default function PortalMyTasks() {
    const { clientData } = useDashboard();
    const { linkedClientId, linkedClientName } = usePermissions();
    const activeClientId = linkedClientId || clientData?.id;

    const [tasks, setTasks] = useState<AssignedTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
    const [selectedTask, setSelectedTask] = useState<AssignedTask | null>(null);

    const renderDescription = (text: string | null) => {
        if (!text) return null;

        // Regex to find URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = text.split(urlRegex);

        return parts.map((part, i) => {
            if (part.match(urlRegex)) {
                return (
                    <a
                        key={i}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1 font-bold"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {part} <ExternalLink className="h-3 w-3" />
                    </a>
                );
            }
            return part;
        });
    };

    const loadTasks = useCallback(async () => {
        if (!activeClientId) return;
        try {
            const { data, error } = await (supabase as any)
                .from('client_assigned_tasks')
                .select('*')
                .eq('client_id', activeClientId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTasks(data || []);
        } catch (error: any) {
            console.error('[PortalMyTasks] Error loading tasks:', error);
            toast.error("Erro ao carregar tarefas");
        } finally {
            setIsLoading(false);
        }
    }, [activeClientId]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    const moveTask = async (taskId: string, newStatus: AssignedTask['status']) => {
        setMovingTaskId(taskId);
        try {
            const updates: any = {
                status: newStatus,
                updated_at: new Date().toISOString(),
            };
            if (newStatus === 'done') {
                updates.completed_at = new Date().toISOString();
            } else {
                updates.completed_at = null;
            }

            const { error } = await (supabase as any)
                .from('client_assigned_tasks')
                .update(updates)
                .eq('id', taskId);

            if (error) throw error;

            // Optimistic update
            setTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, status: newStatus, completed_at: updates.completed_at, updated_at: updates.updated_at } : t
            ));

            if (newStatus === 'done') {
                toast.success("Tarefa concluída! ✅");
            } else {
                toast.success("Status atualizado!");
            }
        } catch (error: any) {
            console.error('[PortalMyTasks] Error moving task:', error);
            toast.error("Erro ao atualizar tarefa");
            loadTasks(); // Revert on error
        } finally {
            setMovingTaskId(null);
        }
    };

    const getNextStatus = (current: AssignedTask['status']): AssignedTask['status'] | null => {
        if (current === 'pending') return 'in_progress';
        if (current === 'in_progress') return 'done';
        return null;
    };

    const getPrevStatus = (current: AssignedTask['status']): AssignedTask['status'] | null => {
        if (current === 'done') return 'in_progress';
        if (current === 'in_progress') return 'pending';
        return null;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="space-y-2">
                <h1 className="text-4xl font-black tracking-tight italic">
                    Minhas Tarefas
                </h1>
                <p className="text-muted-foreground text-lg">
                    Tarefas atribuídas pela agência para <span className="text-primary font-bold">{linkedClientName || clientData?.name || "seu projeto"}</span>.
                </p>
            </div>

            {tasks.length === 0 ? (
                <Card className="p-12 text-center bg-card border-border/50 border-dashed">
                    <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                    <h3 className="text-lg font-medium text-foreground">Nenhuma tarefa atribuída</h3>
                    <p className="text-muted-foreground max-w-xs mx-auto mt-2">
                        Ainda não há tarefas atribuídas pela agência. Quando houver, elas aparecerão aqui.
                    </p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {COLUMNS.map(col => {
                        const Icon = col.icon;
                        const columnTasks = tasks.filter(t => t.status === col.key);

                        return (
                            <div key={col.key} className="space-y-3">
                                {/* Column Header */}
                                <div className={cn("flex items-center gap-2 p-3 rounded-lg border", col.bg, col.borderColor)}>
                                    <Icon className={cn("h-4 w-4", col.color)} />
                                    <span className={cn("text-sm font-bold", col.color)}>{col.title}</span>
                                    <Badge variant="secondary" className="ml-auto text-[10px] font-bold">
                                        {columnTasks.length}
                                    </Badge>
                                </div>

                                {/* Column Tasks */}
                                <div className="space-y-3 min-h-[100px]">
                                    {columnTasks.length === 0 ? (
                                        <div className="p-6 text-center text-muted-foreground text-xs border border-dashed border-border/50 rounded-lg">
                                            Nenhuma tarefa
                                        </div>
                                    ) : (
                                        columnTasks.map(task => {
                                            const nextStatus = getNextStatus(task.status);
                                            const prevStatus = getPrevStatus(task.status);
                                            const isMoving = movingTaskId === task.id;

                                            return (
                                                <Card
                                                    key={task.id}
                                                    className={cn(
                                                        "p-4 bg-card border-border/50 hover:border-primary/40 transition-all shadow-sm group cursor-pointer",
                                                        task.status === 'done' && "opacity-70"
                                                    )}
                                                    onClick={() => setSelectedTask(task)}
                                                >
                                                    <div className="space-y-3">
                                                        {/* Title + Priority */}
                                                        <div className="flex items-start justify-between gap-2">
                                                            <h4 className={cn(
                                                                "font-bold text-sm leading-tight",
                                                                task.status === 'done' && "line-through text-muted-foreground"
                                                            )}>
                                                                {task.title}
                                                            </h4>
                                                            <Badge className={cn("text-[10px] font-bold shrink-0", PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium)}>
                                                                {PRIORITY_LABELS[task.priority] || task.priority}
                                                            </Badge>
                                                        </div>

                                                        {/* Description */}
                                                        {task.description && (
                                                            <p className="text-xs text-muted-foreground line-clamp-2" style={{ whiteSpace: 'pre-wrap' }}>
                                                                {task.description}
                                                            </p>
                                                        )}

                                                        {/* Meta Info */}
                                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                                            {task.due_date && (
                                                                <div className="flex items-center gap-1">
                                                                    <Calendar className="h-3 w-3" />
                                                                    <span>{new Date(task.due_date).toLocaleDateString('pt-BR')}</span>
                                                                </div>
                                                            )}
                                                            {task.category && (
                                                                <span className="px-1.5 py-0.5 bg-muted/50 rounded text-[10px]">
                                                                    {task.category}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Action Buttons */}
                                                        <div className="flex gap-2 pt-1">
                                                            {prevStatus && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 text-[11px] text-muted-foreground hover:text-foreground flex-1"
                                                                    disabled={isMoving}
                                                                    onClick={() => moveTask(task.id, prevStatus)}
                                                                >
                                                                    ← Voltar
                                                                </Button>
                                                            )}
                                                            {nextStatus && (
                                                                <Button
                                                                    size="sm"
                                                                    className={cn(
                                                                        "h-7 text-[11px] font-bold flex-1",
                                                                        nextStatus === 'done'
                                                                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                            : "bg-blue-600 hover:bg-blue-700 text-white"
                                                                    )}
                                                                    disabled={isMoving}
                                                                    onClick={() => moveTask(task.id, nextStatus)}
                                                                >
                                                                    {isMoving ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                    ) : nextStatus === 'done' ? (
                                                                        <>Concluir ✓</>
                                                                    ) : (
                                                                        <>Iniciar →</>
                                                                    )}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Card>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Task Detail Modal */}
            <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
                <DialogContent className="max-w-2xl bg-card border-border shadow-2xl">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <Badge className={cn("text-xs font-bold", selectedTask && (PRIORITY_COLORS[selectedTask.priority] || PRIORITY_COLORS.medium))}>
                                {selectedTask && (PRIORITY_LABELS[selectedTask.priority] || selectedTask.priority)}
                            </Badge>
                            {selectedTask && (
                                <Badge variant="outline" className="text-xs uppercase tracking-wider font-bold border-muted-foreground/30">
                                    {COLUMNS.find(c => c.key === selectedTask.status)?.title}
                                </Badge>
                            )}
                        </div>
                        <DialogTitle className="text-2xl font-black italic tracking-tight leading-tight">
                            {selectedTask?.title}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 pt-4">
                        {/* Description Section */}
                        <div className="space-y-2">
                            <h5 className="text-xs font-black uppercase tracking-widest text-muted-foreground italic">Descrição da Demanda</h5>
                            <div className="bg-muted/30 rounded-xl p-5 border border-border/50">
                                <p className="text-sm leading-relaxed text-foreground" style={{ whiteSpace: 'pre-wrap' }}>
                                    {selectedTask && renderDescription(selectedTask.description)}
                                </p>
                            </div>
                        </div>

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted/20 p-4 rounded-lg border border-border/30">
                                <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Prazo de Entrega</span>
                                <div className="flex items-center gap-2 text-foreground font-bold">
                                    <Calendar className="h-4 w-4 text-primary" />
                                    <span>{selectedTask?.due_date ? new Date(selectedTask.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Sem prazo'}</span>
                                </div>
                            </div>
                            <div className="bg-muted/20 p-4 rounded-lg border border-border/30">
                                <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Categoria</span>
                                <div className="flex items-center gap-2 text-foreground font-bold">
                                    <ClipboardCheck className="h-4 w-4 text-primary" />
                                    <span>{selectedTask?.category || 'Geral'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer Info */}
                        <div className="text-[10px] text-muted-foreground/60 border-t border-border/50 pt-4 flex justify-between">
                            <span>Atribuída em: {selectedTask?.assigned_at && new Date(selectedTask.assigned_at).toLocaleString('pt-BR')}</span>
                            {selectedTask?.completed_at && (
                                <span className="text-emerald-500 font-bold">Concluída em: {new Date(selectedTask.completed_at).toLocaleString('pt-BR')}</span>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
