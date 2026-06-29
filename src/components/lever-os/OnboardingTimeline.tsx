import { OnboardingPhase, ProcessStep } from "@/types/lever-os";
import { Check, Lock, Unlock, Loader2, AlertCircle, Pencil, Plus, CheckCircle2, Trash2, MoreVertical, Timer, CalendarClock, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MOCK_TEAM_MEMBERS } from "@/mocks/lever-os-data";
import { useAgencyTeam } from "@/hooks/useAgencyTeam";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { NewTaskModal } from "@/components/lever-os/NewTaskModal";
import { TaskDetailModal } from "@/components/lever-os/TaskDetailModal";
import { useTasks } from "@/contexts/TasksContext";
import { useSelectedClient } from "@/contexts/DashboardContext";

interface OnboardingTimelineProps {
    phases: OnboardingPhase[];
    completedConnections?: {
        meta: boolean;
        shopify: boolean;
        kartpanda: boolean;
    };
}

// Steps que são auto-completados por conexões
const CONNECTION_STEP_MAP: Record<string, 'meta' | 'shopify' | 'kartpanda'> = {
    'step_2_1': 'meta',    // Solicitar acesso está ligado ao Meta
    'step_2_2': 'meta',    // Configurar Pixel também
};

export function OnboardingTimeline({ phases: initialPhases, completedConnections }: OnboardingTimelineProps) {
    const [phases, setPhases] = useState(initialPhases);
    // Auto-expand: first unlocked phase that has pending/in_progress steps
    const activePhaseIndex = phases.findIndex((p, i) => {
        if (p.isLocked) return false;
        // Check if phase has active or pending work
        return p.steps.some(s => ['in_progress', 'pending', 'todo'].includes(s.status || 'pending'));
    });
    const firstUnlockedNotComplete = activePhaseIndex !== -1 ? activePhaseIndex : 0;
    const [openPahses, setOpenPhases] = useState<number[]>([firstUnlockedNotComplete]);
    const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
    const [editingStepId, setEditingStepId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [stepEditValue, setStepEditValue] = useState("");

    // Integracao com TasksContext
    const { selectedClientId } = useSelectedClient();
    const {
        createTaskFromStep,
        getTaskByStepId,
        setOnTaskStatusChange,
        selectedTask,
        openTaskDetail,
        closeTaskDetail,
        moveTask,
        deleteTask
    } = useTasks();

    // Get client data to compute deadline
    const { clientData, refreshClientData } = useSelectedClient();
    const { members: rawTeamMembers } = useAgencyTeam();

    // Normalize team members
    const teamMembers = rawTeamMembers.map(m => ({
        id: m.user_id,
        name: m.profile?.full_name || 'Membro',
        avatarUrl: m.profile?.avatar_url || undefined
    })).filter(m => m.id && !m.id.startsWith('invited_'));

    // Callback para sincronizar mudancas de status da task para o step
    const handleTaskStatusChange = useCallback((taskId: string, newStatus: string, stepId?: string) => {
        if (!stepId) return;

        // Mapear status da task para status do step
        const statusMap: Record<string, ProcessStep['status']> = {
            'backlog': 'blocked',
            'todo': 'pending',
            'in_progress': 'in_progress',
            'validation': 'in_progress',
            'done': 'completed',
        };

        const newStepStatus = statusMap[newStatus] || 'pending';
        const completedAt = newStatus === 'done' ? new Date().toISOString() : undefined;

        setPhases(prev => prev.map(phase => ({
            ...phase,
            steps: phase.steps.map(step =>
                step.id === stepId
                    ? {
                        ...step,
                        status: newStepStatus,
                        completedAt
                    }
                    : step
            )
        })));

        // Persistir no banco
        saveStepStatus(stepId, newStepStatus, completedAt);
    }, [selectedClientId]);

    const saveStepStatus = async (stepId: string, status: string, completedAt?: string) => {
        if (!selectedClientId) return;
        try {
            const { error } = await (supabase as any)
                .from('client_step_status')
                .upsert({
                    client_id: selectedClientId,
                    step_id: stepId,
                    status: status,
                    completed_at: completedAt,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'client_id,step_id' });

            if (error) console.error("Error saving step status:", error);
        } catch (err) {
            console.error("Failed to persist step status:", err);
        }
    };

    // Efeito para carregar statuses persistidos
    useEffect(() => {
        if (!selectedClientId) return;

        const loadStatuses = async () => {
            try {
                const { data, error } = await supabase
                    .from('client_step_status')
                    .select('*')
                    .eq('client_id', selectedClientId);

                if (error) throw error;

                if (data && data.length > 0) {
                    setPhases(currentPhases => {
                        const updated = currentPhases.map(phase => ({
                            ...phase,
                            steps: phase.steps.map(step => {
                                const saved = data.find(s => s.step_id === step.id);
                                return saved ? {
                                    ...step,
                                    status: saved.status as any,
                                    completedAt: saved.completed_at
                                } : step;
                            })
                        }));
                        // Recompute locks after loading persisted statuses
                        return recomputeLocks(updated);
                    });
                }
            } catch (err) {
                console.warn("Could not load persisted step statuses (table might be missing):", err);
            }
        };

        loadStatuses();
    }, [selectedClientId, initialPhases]);

    // Auto-expand newly unlocked phases and promote their backlog tasks
    useEffect(() => {
        phases.forEach((phase, idx) => {
            if (!phase.isLocked) {
                // Auto-expand if not already open and has incomplete steps
                const hasIncomplete = phase.steps.some(s => s.status !== 'completed');
                if (hasIncomplete && !openPahses.includes(idx)) {
                    // Check if all previous phases are complete (means this was just unlocked)
                    const prevComplete = idx === 0 || phases.slice(0, idx).every(p =>
                        p.steps.every(s => s.status === 'completed')
                    );
                    if (prevComplete) {
                        setOpenPhases(prev => prev.includes(idx) ? prev : [...prev, idx]);
                    }
                }
                // Promote backlog tasks to todo
                phase.steps.forEach(step => {
                    const task = getTaskByStepId(step.id);
                    if (task && task.status === 'backlog') {
                        moveTask(task.id, 'todo');
                    }
                });
            }
        });
    }, [phases]);

    // Registrar callback de sincronizacao
    useEffect(() => {
        setOnTaskStatusChange(handleTaskStatusChange);
    }, [setOnTaskStatusChange, handleTaskStatusChange]);

    // Handler para clicar em um step - abre modal de tarefa
    const handleStepClick = (phase: OnboardingPhase, step: ProcessStep) => {
        if (!selectedClientId || phase.isLocked) return;

        // Buscar task existente ou criar nova
        let task = getTaskByStepId(step.id);
        if (!task) {
            task = createTaskFromStep(selectedClientId, phase.id, step);
        }

        openTaskDetail(task);
    };

    // Handler para iniciar uma tarefa
    const handleStartStep = (e: React.MouseEvent, phase: OnboardingPhase, step: ProcessStep) => {
        e.stopPropagation();
        if (!selectedClientId) return;

        // Criar ou obter task
        let task = getTaskByStepId(step.id);
        if (!task) {
            task = createTaskFromStep(selectedClientId, phase.id, step);
        }

        // Mover task para in_progress no context (isso vai disparar a sincronizacao)
        moveTask(task.id, 'em_progresso');

        // Atualizar status local para in_progress
        const newStatus = 'in_progress' as const;
        setPhases(prev => prev.map(p => ({
            ...p,
            steps: p.steps.map(s =>
                s.id === step.id ? { ...s, status: newStatus } : s
            )
        })));

        // Persistir
        saveStepStatus(step.id, newStatus);

        // Abrir modal da tarefa
        openTaskDetail(task);
    };

    // Recompute lock states: phase N+1 unlocks when all steps in phase N are completed
    const recomputeLocks = (phasesData: OnboardingPhase[]): OnboardingPhase[] => {
        return phasesData.map((phase, idx) => {
            if (idx === 0) {
                // First phase is always unlocked
                return { ...phase, isLocked: false };
            }
            const previousPhase = phasesData[idx - 1];
            const previousComplete = previousPhase.steps.length > 0 && previousPhase.steps.every(s => s.status === 'completed');
            // Unlock if previous phase is complete OR if already manually unlocked (has in_progress/completed steps)
            const hasActivity = phase.steps.some(s => s.status === 'in_progress' || s.status === 'completed');
            return { ...phase, isLocked: !previousComplete && !hasActivity };
        });
    };

    // Handler para desbloquear manualmente uma fase
    const handleUnlockPhase = (e: React.MouseEvent, phaseIndex: number) => {
        e.stopPropagation();
        setPhases(prev => {
            const updated = prev.map((p, idx) =>
                idx === phaseIndex ? { ...p, isLocked: false } : p
            );
            return updated;
        });

        // Open the phase accordion
        if (!openPahses.includes(phaseIndex)) {
            setOpenPhases([...openPahses, phaseIndex]);
        }

        // Promote associated backlog tasks to todo
        const phase = phases[phaseIndex];
        if (phase) {
            phase.steps.forEach(step => {
                const task = getTaskByStepId(step.id);
                if (task && task.status === 'backlog') {
                    moveTask(task.id, 'todo');
                }
            });
        }
    };

    // Handler para concluir uma tarefa
    const handleCompleteStep = (e: React.MouseEvent, phase: OnboardingPhase, step: ProcessStep) => {
        e.stopPropagation();
        if (!selectedClientId) return;

        // Mover task para done no context se existir
        const task = getTaskByStepId(step.id);
        if (task) {
            moveTask(task.id, 'concluido');
        }

        // Atualizar status local e recomputar locks
        const newStatus = 'completed' as const;
        const completedAt = new Date().toISOString();
        setPhases(prev => {
            const updated = prev.map(p => ({
                ...p,
                steps: p.steps.map(s =>
                    s.id === step.id
                        ? { ...s, status: newStatus, completedAt }
                        : s
                )
            }));
            return recomputeLocks(updated);
        });

        // Persistir
        saveStepStatus(step.id, newStatus, completedAt);
    };

    // Handler para excluir um step
    const handleDeleteStep = (e: React.MouseEvent, phaseId: string, stepId: string) => {
        e.stopPropagation();
        if (!window.confirm("Deseja excluir este step da timeline?")) return;

        // 1. Excluir task vinculada se existir
        const task = getTaskByStepId(stepId);
        if (task) {
            deleteTask(task.id);
        }

        // 2. Remover do estado local
        setPhases(prev => prev.map(p =>
            p.id === phaseId
                ? { ...p, steps: p.steps.filter(s => s.id !== stepId) }
                : p
        ));
    };

    const handleDeletePhase = (e: React.MouseEvent, phaseId: string) => {
        e.stopPropagation();
        if (!window.confirm("Deseja excluir este grupo completo (fase) da timeline? Todas as tarefas vinculadas serão afetadas.")) return;

        // 1. Opcional: Excluir todas as tasks vinculadas aos steps desta fase
        const phase = phases.find(p => p.id === phaseId);
        if (phase) {
            phase.steps.forEach(step => {
                const task = getTaskByStepId(step.id);
                if (task) deleteTask(task.id);
            });
        }

        // 2. Remover do estado local
        setPhases(prev => prev.filter(p => p.id !== phaseId));
    };

    const togglePhase = (index: number) => {
        if (openPahses.includes(index)) {
            setOpenPhases(openPahses.filter(i => i !== index));
        } else {
            setOpenPhases([...openPahses, index]);
        }
    };

    const startEditingTitle = (phase: OnboardingPhase, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingPhaseId(phase.id);
        setEditValue(phase.title);
    };

    const saveTitle = (phaseId: string) => {
        setPhases(prev => prev.map(p =>
            p.id === phaseId ? { ...p, title: editValue } : p
        ));
        setEditingPhaseId(null);
    };

    const startEditingStep = (step: ProcessStep, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingStepId(step.id);
        setStepEditValue(step.title);
    };

    const saveStepTitle = (phaseId: string, stepId: string) => {
        setPhases(prev => prev.map(p =>
            p.id === phaseId
                ? {
                    ...p,
                    steps: p.steps.map(s =>
                        s.id === stepId ? { ...s, title: stepEditValue } : s
                    )
                }
                : p
        ));
        setEditingStepId(null);
    };

    const getStatusIcon = (status: ProcessStep['status']) => {
        switch (status) {
            case 'completed': return <Check className="w-4 h-4 text-green-500" />;
            case 'in_progress': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'blocked': return <AlertCircle className="w-4 h-4 text-red-500" />;
            default: return <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />;
        }
    };

    const getRoleBadge = (role: ProcessStep['assigneeRole'], linkedTask?: any) => {
        // Try to resolve the real assignee from the linked task
        let memberName = '';
        let memberAvatar = '';

        if (linkedTask?.assigneeId && teamMembers.length > 0) {
            const realMember = teamMembers.find(m => m.id === linkedTask.assigneeId);
            if (realMember) {
                memberName = realMember.name;
                memberAvatar = realMember.avatarUrl || '';
            }
        }

        if (memberName) {
            return (
                <div className="flex items-center gap-1.5 bg-red-600 dark:bg-red-500/20 border border-red-600 dark:border-red-500/40 rounded-[12px] pl-2.5 pr-1 py-0.5">
                    <span className="text-xs font-medium text-white dark:text-red-400">{memberName.split(' ')[0]}</span>
                    <Avatar className="h-6 w-6 border-0">
                        <AvatarImage src={memberAvatar} alt={memberName} />
                        <AvatarFallback className="text-[10px] font-bold bg-red-700 text-white dark:bg-red-500/30 dark:text-red-300">{memberName.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                </div>
            );
        }

        // Fallback to "Sem responsável" if no real member found
        return (
            <div className="flex items-center gap-1.5 bg-muted/30 border border-dashed border-muted-foreground/30 rounded-full pl-2.5 pr-1 py-0.5 opacity-60">
                <span className="text-[11px] text-muted-foreground">Sem responsável</span>
                <Avatar className="h-6 w-6 border border-dashed border-muted-foreground/40 bg-muted/20">
                    <AvatarFallback className="text-[10px] text-muted-foreground">?</AvatarFallback>
                </Avatar>
            </div>
        );
    };

    // Compute 20-day implementation deadline
    const totalImplementationDays = 20;
    const createdDate = clientData?.created_at ? new Date(clientData.created_at) : null;
    const now = new Date();
    const daysSinceCreation = createdDate ? Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const daysRemaining = Math.max(0, totalImplementationDays - daysSinceCreation);
    const deadlineProgress = Math.min(100, (daysSinceCreation / totalImplementationDays) * 100);
    const isOverdue = daysSinceCreation > totalImplementationDays;
    const deadlineDate = createdDate ? new Date(createdDate.getTime() + totalImplementationDays * 24 * 60 * 60 * 1000) : null;

    // Overall onboarding progress
    const totalSteps = phases.reduce((acc, p) => acc + p.steps.length, 0);
    const completedSteps = phases.reduce((acc, p) => acc + p.steps.filter(s => s.status === 'completed').length, 0);
    const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    const allStepsDone = totalSteps > 0 && completedSteps === totalSteps;
    const isDelivered = !!clientData?.delivered_at;

    const handleMarkDelivered = async () => {
        if (!selectedClientId) return;
        try {
            await (supabase as any)
                .from('agency_clients')
                .update({ delivered_at: new Date().toISOString() })
                .eq('id', selectedClientId);
            // Refresh client data to update UI
            await refreshClientData();
        } catch (err) {
            console.error("Failed to mark as delivered:", err);
        }
    };

    return (
        <div className="relative space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Deadline / Delivery Status Card */}
            {createdDate && totalSteps > 0 && isDelivered ? (
                /* STATE: PROJECT DELIVERED */
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <PartyPopper className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm text-emerald-600">Projeto Entregue</h3>
                                <p className="text-xs text-muted-foreground">
                                    Entregue em {new Date(clientData.delivered_at!).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Progresso Final</span>
                            <span className="font-semibold text-emerald-600">{completedSteps}/{totalSteps} etapas</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${overallProgress}%` }} />
                        </div>
                    </div>
                </div>
            ) : createdDate && totalSteps > 0 && (
                /* STATE: ACTIVE COUNTDOWN (or all steps done - awaiting delivery mark) */
                <div className={cn(
                    "rounded-xl border p-5 space-y-4",
                    allStepsDone ? "border-emerald-500/30 bg-emerald-500/5" :
                        isOverdue ? "border-red-500/30 bg-red-500/5" : daysRemaining <= 5 ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-card"
                )}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                allStepsDone ? "bg-emerald-500/10" :
                                    isOverdue ? "bg-red-500/10" : daysRemaining <= 5 ? "bg-orange-500/10" : "bg-primary/10"
                            )}>
                                {allStepsDone ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                ) : (
                                    <Timer className={cn("w-5 h-5", isOverdue ? "text-red-500" : daysRemaining <= 5 ? "text-orange-500" : "text-primary")} />
                                )}
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm text-foreground">
                                    {allStepsDone ? "Todas as etapas concluídas!" : "Prazo de Implementação"}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {allStepsDone
                                        ? "Todas as demandas foram finalizadas. Marque como entregue."
                                        : `${totalImplementationDays} dias a partir de ${createdDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="text-right">
                            {allStepsDone ? (
                                <Button
                                    size="sm"
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs"
                                    onClick={handleMarkDelivered}
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                    Marcar como Entregue
                                </Button>
                            ) : isOverdue ? (
                                <div className="text-red-500">
                                    <span className="text-2xl font-black">+{daysSinceCreation - totalImplementationDays}</span>
                                    <span className="text-xs block font-medium">dias atrasado</span>
                                </div>
                            ) : (
                                <div className={cn(daysRemaining <= 5 ? "text-orange-500" : "text-primary")}>
                                    <span className="text-2xl font-black">{daysRemaining}</span>
                                    <span className="text-xs block font-medium">dias restantes</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Progress bars */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Prazo</span>
                                <span className="font-semibold">{daysSinceCreation}/{totalImplementationDays} dias</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all duration-500",
                                        allStepsDone ? "bg-emerald-500" :
                                            isOverdue ? "bg-red-500" : daysRemaining <= 5 ? "bg-orange-500" : "bg-primary"
                                    )}
                                    style={{ width: `${deadlineProgress}%` }}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Progresso</span>
                                <span className="font-semibold">{completedSteps}/{totalSteps} etapas</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500 bg-emerald-500"
                                    style={{ width: `${overallProgress}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Deadline date + manual delivery button */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                        {deadlineDate && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <CalendarClock className="w-3.5 h-3.5" />
                                <span>Entrega prevista: <strong className="text-foreground">{deadlineDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></span>
                            </div>
                        )}
                        {!allStepsDone && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs text-muted-foreground hover:text-foreground h-7"
                                onClick={handleMarkDelivered}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Marcar como Entregue
                            </Button>
                        )}
                    </div>
                </div>
            )}


            <div className="grid gap-6">
                {phases.map((phase, index) => {
                    const isCompleted = phase.steps.every(s => s.status === 'completed');
                    const isInProgress = phase.steps.some(s => s.status === 'in_progress');
                    const isLocked = phase.isLocked;
                    const isEditing = editingPhaseId === phase.id;

                    return (
                        <div key={phase.id} className={cn("group relative pl-8 border-l-2 transition-all", isCompleted ? "border-green-500/50" : isInProgress ? "border-blue-500" : "border-muted")}>
                            {/* Marcador da Fase na Linha */}
                            <div className={cn(
                                "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 bg-background flex items-center justify-center transition-all",
                                isCompleted ? "border-green-500 text-green-500" :
                                    isInProgress ? "border-blue-500" :
                                        "border-muted bg-muted"
                            )}>
                                {isCompleted && <Check className="w-2.5 h-2.5" />}
                                {isLocked && <Lock className="w-2.5 h-2.5 text-muted-foreground" />}
                            </div>

                            <Collapsible
                                open={openPahses.includes(index)}
                                onOpenChange={() => !isLocked && togglePhase(index)}
                                className={cn("bg-card border rounded-lg overflow-hidden transition-all shadow-none", isInProgress ? "border-blue-500/30" : "border-border/50")}
                            >
                                <CollapsibleTrigger className={cn("w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors", isLocked ? "cursor-default" : "cursor-pointer")}>
                                    <div className="flex flex-col items-start gap-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className={cn("font-semibold text-base", isLocked ? "text-muted-foreground" : "text-foreground")}>
                                                {index + 1}. {phase.title}
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{phase.steps.filter(s => s.status === 'completed').length}/{phase.steps.length} Steps</span>
                                            {isInProgress && <span className="text-blue-500 font-medium">• Em Andamento</span>}
                                        </div>
                                    </div>
                                    {isLocked ? (
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                                                onClick={(e) => handleUnlockPhase(e, index)}
                                            >
                                                <Unlock className="w-3 h-3" />
                                                Desbloquear
                                            </Button>
                                            <Lock className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                            {openPahses.includes(index) ? "−" : "+"}
                                        </Button>
                                    )}
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                    <div className="p-4 pt-0 space-y-2">
                                        {phase.steps.map((step) => {
                                            const linkedTask = getTaskByStepId(step.id);
                                            const checklistProgress = linkedTask?.checklist
                                                ? `${linkedTask.checklist.filter(c => c.isCompleted).length}/${linkedTask.checklist.length}`
                                                : null;

                                            return (
                                                <div
                                                    key={step.id}
                                                    onClick={() => handleStepClick(phase, step)}
                                                    className={cn(
                                                        "flex items-center justify-between p-3 rounded-md transition-all cursor-pointer group",
                                                        step.status === 'completed' ? "bg-green-500/5 border border-green-500/10 hover:bg-green-500/10" :
                                                            step.status === 'in_progress' ? "bg-background border border-blue-500/20 hover:border-blue-500/40" :
                                                                "bg-muted/30 border border-transparent hover:bg-muted/50 hover:border-muted",
                                                        phase.isLocked && "cursor-not-allowed opacity-60"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn("flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-background border", step.status === 'completed' ? "border-green-500/30 text-green-500" : "border-muted")}>
                                                            {getStatusIcon(step.status)}
                                                        </div>
                                                        <div className="flex flex-col flex-1">
                                                            <span className={cn("text-sm font-medium", step.status === 'completed' ? "text-muted-foreground line-through" : "text-foreground")}>
                                                                {step.title}
                                                            </span>
                                                            {step.description && (
                                                                <span className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                                                                    <AlertCircle className="w-3 h-3" /> {step.description}
                                                                </span>
                                                            )}
                                                            {/* Mostrar progresso do checklist se houver task vinculada */}
                                                            {checklistProgress && step.status !== 'completed' && (
                                                                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                    <CheckCircle2 className="w-3 h-3" /> {checklistProgress} processos
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {getRoleBadge(step.assigneeRole, linkedTask)}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        </div>
                    );
                })}
            </div>

            {/* Modal de detalhes da tarefa */}
            <TaskDetailModal
                task={selectedTask}
                isOpen={!!selectedTask}
                onClose={closeTaskDetail}
            />
        </div >
    );
}
