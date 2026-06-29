/**
 * ClientOnboardingTab — Aba de Onboarding por Checklist dentro do cliente
 * Layout: Fases (esquerda) | Timeline (direita lateral)
 */

import { useState, useRef, useMemo } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingAutoDetection } from '@/hooks/useOnboardingAutoDetection';
import { useDashboard } from '@/contexts/DashboardContext';
import { useAgencyTeam } from '@/hooks/useAgencyTeam';
import {
  ONBOARDING_TYPE_LABELS,
  ONBOARDING_STATUS_LABELS,
  REQUIRES_WHATSAPP,
  REQUIRES_PORTAL,
  REQUIRES_BRIEFING,
  OnboardingType,
} from '@/types/onboarding';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Lock,
  MessageCircle,
  Pause,
  Pencil,
  Play,
  Plus,
  Send,
  Shield,
  FileText,
  SkipForward,
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Unlock,
  X,
  ArrowRightLeft,
  UserCircle,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ClientOnboardingTabProps {
  clientId: string;
}

export function ClientOnboardingTab({ clientId }: ClientOnboardingTabProps) {
  const {
    onboarding,
    isLoading,
    createOnboarding,
    changeOnboardingType,
    completeTask,
    uncheckTask,
    startPhase,
    forceUnlockPhase,
    completeAllTasks,
    uncheckAllTasks,
    pauseOnboarding,
    resumeOnboarding,
    toggleWhatsapp,
    togglePortalAccess,
    addCustomTask,
    deleteTask,
    updateTaskName,
    updateTaskEstimate,
    updateTaskAssignee,
    updatePhaseName,
    updatePhaseDaysLimit,
    addNote,
    totalTasks,
    completedTasks,
    progress,
    isPhaseUnlocked,
  } = useOnboarding(clientId, useDashboard().workspaceId);

  const { clientData } = useDashboard();
  const { members: teamMembers } = useAgencyTeam();
  const memberMap = useMemo(() => new Map(teamMembers.map((m: any) => [m.user_id, m])), [teamMembers]);

  // Auto-detecção: marca tasks automaticamente baseado no estado do sistema
  useOnboardingAutoDetection({ onboarding, clientId, clientData, completeTask });

  const [collapsedPhases, setCollapsedPhases] = useState<string[]>([]);
  const [noteText, setNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [selectedType, setSelectedType] = useState<OnboardingType | ''>('');
  const [isCreating, setIsCreating] = useState(false);

  // Inline editing states
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName] = useState('');
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [editingPhaseName, setEditingPhaseName] = useState('');
  const [addingTaskPhaseId, setAddingTaskPhaseId] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  // Time editing states
  const [editingTimeTaskId, setEditingTimeTaskId] = useState<string | null>(null);
  const [editingTimeHours, setEditingTimeHours] = useState(0);
  const [editingTimeMinutes, setEditingTimeMinutes] = useState(0);

  const formatTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const startEditingTime = (task: { id: string; estimated_minutes: number | null }) => {
    setEditingTimeTaskId(task.id);
    setEditingTimeHours(task.estimated_minutes ? Math.floor(task.estimated_minutes / 60) : 0);
    setEditingTimeMinutes(task.estimated_minutes ? task.estimated_minutes % 60 : 0);
  };

  const handleSaveTime = async (taskId: string, taskKey: string) => {
    const totalMinutes = editingTimeHours * 60 + editingTimeMinutes;
    await updateTaskEstimate(taskId, taskKey, totalMinutes || null);
    setEditingTimeTaskId(null);
  };

  // Change type states
  const [showChangeType, setShowChangeType] = useState(false);
  const [pendingNewType, setPendingNewType] = useState<OnboardingType | null>(null);
  const [isChangingType, setIsChangingType] = useState(false);

  // All hooks declared above — safe to early return below

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!onboarding) {
    return (
      <Card className="border-dashed shadow-none">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Plus className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-lg">Iniciar Onboarding</CardTitle>
          <CardDescription>
            Selecione o tipo de onboarding para gerar automaticamente o checklist de fases e tarefas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Select value={selectedType} onValueChange={(v) => setSelectedType(v as OnboardingType)}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Selecione o tipo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mrr_start">MRR Start</SelectItem>
              <SelectItem value="mrr_growth">MRR Growth</SelectItem>
              <SelectItem value="avulso_tema">Avulso — Tema Beacon</SelectItem>
              <SelectItem value="avulso_reformulacao">Avulso — Reformulação</SelectItem>
              <SelectItem value="avulso_arte">Avulso — Arte/Design</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={async () => {
              if (!selectedType) return;
              setIsCreating(true);
              try { await createOnboarding(selectedType); } finally { setIsCreating(false); }
            }}
            disabled={!selectedType || isCreating}
            className="gap-2"
          >
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Criar Onboarding
          </Button>
        </CardContent>
      </Card>
    );
  }

  // --- Onboarding exists ---
  const type = onboarding.type;
  const showWhatsapp = REQUIRES_WHATSAPP.includes(type);
  const showPortal = REQUIRES_PORTAL.includes(type);
  const showBriefing = REQUIRES_BRIEFING.includes(type);
  const sortedPhases = [...onboarding.phases].sort((a, b) => a.phase_order - b.phase_order);
  const isPaused = onboarding.status === 'pausado';

  const toggleCollapse = (phaseId: string) => {
    setCollapsedPhases((prev) =>
      prev.includes(phaseId) ? prev.filter((id) => id !== phaseId) : [...prev, phaseId]
    );
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setIsAddingNote(true);
    await addNote(noteText.trim());
    setNoteText('');
    setIsAddingNote(false);
  };

  const handleSaveTaskName = async (taskId: string) => {
    if (editingTaskName.trim()) {
      await updateTaskName(taskId, editingTaskName.trim());
    }
    setEditingTaskId(null);
    setEditingTaskName('');
  };

  const handleSavePhaseName = async (phaseId: string) => {
    if (editingPhaseName.trim()) {
      await updatePhaseName(phaseId, editingPhaseName.trim());
    }
    setEditingPhaseId(null);
    setEditingPhaseName('');
  };

  const handleAddTask = async (phaseId: string) => {
    if (newTaskName.trim()) {
      await addCustomTask(phaseId, newTaskName.trim());
    }
    setNewTaskName('');
    setAddingTaskPhaseId(null);
  };

  // Filter timeline: only show "active" events (completed tasks, completed phases, notes, quick actions, status changes)
  // Exclude task_unchecked events
  const activeTimeline = onboarding.timeline.filter(
    (e) => e.event_type !== 'task_unchecked'
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* HEADER */}
      <Card className="border shadow-none">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                onboarding.status === 'concluido' ? "bg-emerald-500/10" :
                onboarding.status === 'pausado' ? "bg-red-500/10" :
                onboarding.status === 'em_andamento' ? "bg-blue-500/10" : "bg-muted"
              )}>
                {onboarding.status === 'concluido' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> :
                 onboarding.status === 'pausado' ? <Pause className="w-5 h-5 text-red-500" /> :
                 onboarding.status === 'em_andamento' ? <Play className="w-5 h-5 text-blue-500" /> :
                 <Clock className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{ONBOARDING_TYPE_LABELS[type]}</h3>
                  <Badge variant="outline" className={cn(
                    "text-xs",
                    onboarding.status === 'concluido' ? "border-emerald-500/40 text-emerald-600" :
                    onboarding.status === 'pausado' ? "border-red-500/40 text-red-600" :
                    onboarding.status === 'em_andamento' ? "border-blue-500/40 text-blue-600" :
                    "border-muted text-muted-foreground"
                  )}>
                    {ONBOARDING_STATUS_LABELS[onboarding.status]}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowChangeType(true)}
                    title="Alterar tipo de onboarding"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Iniciado em {new Date(onboarding.started_at).toLocaleDateString('pt-BR')}
                  {onboarding.completed_at && (
                    <> — Concluído em {new Date(onboarding.completed_at).toLocaleDateString('pt-BR')}</>
                  )}
                </p>
              </div>
            </div>
            {onboarding.status !== 'concluido' && (
              onboarding.status === 'pausado' ? (
                <Button size="sm" variant="outline" onClick={resumeOnboarding} className="gap-1.5 text-xs">
                  <Play className="w-3.5 h-3.5" /> Retomar
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={pauseOnboarding} className="gap-1.5 text-xs text-red-600 border-red-500/30 hover:bg-red-500/10">
                  <Pause className="w-3.5 h-3.5" /> Pausar
                </Button>
              )
            )}
          </div>

          {/* Progress — segmented by phase */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progresso geral</span>
              <span className="font-semibold">{completedTasks}/{totalTasks} tarefas — {progress}%</span>
            </div>
            {/* Segmented bar: one segment per phase */}
            <div className="flex gap-1 h-2.5 rounded-full overflow-hidden">
              {sortedPhases.map((phase) => {
                const pTasks = phase.tasks;
                const pTotal = pTasks.length;
                const pDone = pTasks.filter((t) => t.status === 'concluido').length;
                const pPct = pTotal > 0 ? Math.round((pDone / pTotal) * 100) : 0;
                const pCompleted = pTotal > 0 && pDone === pTotal;
                return (
                  <div
                    key={phase.id}
                    className="flex-1 bg-muted rounded-sm overflow-hidden relative group/seg"
                    title={`${phase.phase_name}: ${pDone}/${pTotal}`}
                  >
                    <div
                      className={cn(
                        "h-full rounded-sm transition-all duration-500",
                        pCompleted ? "bg-emerald-500" : pPct > 0 ? "bg-blue-500" : "bg-transparent"
                      )}
                      style={{ width: `${pPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            {/* Phase labels under the bar */}
            <div className="flex gap-1">
              {sortedPhases.map((phase) => {
                const pTasks = phase.tasks;
                const pTotal = pTasks.length;
                const pDone = pTasks.filter((t) => t.status === 'concluido').length;
                const pCompleted = pTotal > 0 && pDone === pTotal;
                return (
                  <div key={phase.id} className="flex-1 min-w-0">
                    <p className={cn(
                      "text-[9px] truncate text-center",
                      pCompleted ? "text-emerald-600 font-medium" : "text-muted-foreground"
                    )}>
                      {phase.phase_name}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions — toggleable */}
          <div className="flex flex-wrap gap-2 pt-1">
            {showWhatsapp && (
              <button
                type="button"
                onClick={toggleWhatsapp}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs border rounded-full px-3 py-1 transition-colors",
                  onboarding.whatsapp_group_created
                    ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/5 hover:bg-emerald-500/10"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                )}
              >
                {onboarding.whatsapp_group_created ? <Check className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                WhatsApp criado
              </button>
            )}
            {showPortal && (
              <button
                type="button"
                onClick={togglePortalAccess}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs border rounded-full px-3 py-1 transition-colors",
                  onboarding.portal_access_granted
                    ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/5 hover:bg-emerald-500/10"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                )}
              >
                {onboarding.portal_access_granted ? <Check className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                Portal concedido
              </button>
            )}
            {showBriefing && (
              <Badge variant="outline" className="text-xs gap-1">
                <FileText className="w-3 h-3" /> Briefing vinculado
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* MAIN CONTENT: Phases (left) + Timeline (right) */}
      <div className="flex gap-6 items-start">
        {/* LEFT: ALL PHASES */}
        <div className="flex-1 min-w-0 space-y-3">
          {sortedPhases.map((phase, index) => {
            const unlocked = isPhaseUnlocked(phase, onboarding.phases);
            const phaseTasks = [...phase.tasks].sort((a, b) => a.task_order - b.task_order);
            const doneCount = phaseTasks.filter((t) => t.status === 'concluido').length;
            const totalCount = phaseTasks.length;
            const phaseProgress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
            const allDoneInPhase = totalCount > 0 && doneCount === totalCount;
            const isCompleted = phase.status === 'concluido' || allDoneInPhase;
            const isActive = phase.status === 'em_andamento';
            const isSkipped = phase.status === 'pulado';
            const isCollapsed = collapsedPhases.includes(phase.id);
            const isEditingThisPhase = editingPhaseId === phase.id;

            return (
              <div
                key={phase.id}
                className={cn(
                  "rounded-lg border overflow-hidden transition-all",
                  isCompleted ? "border-emerald-500/30" :
                  isActive ? "border-blue-500/30" :
                  isSkipped ? "border-muted opacity-60" :
                  !unlocked ? "border-muted opacity-50" :
                  "border-border"
                )}
              >
                {/* Phase Header */}
                <div
                  className={cn(
                    "flex items-center justify-between p-4 transition-colors",
                    isCompleted ? "bg-emerald-500/5 hover:bg-emerald-500/10" :
                    isActive ? "bg-blue-500/5 hover:bg-blue-500/10" :
                    "bg-card hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => toggleCollapse(phase.id)}>
                    {/* Phase status icon */}
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                      isCompleted ? "bg-emerald-500 text-white" :
                      isActive ? "bg-blue-500 text-white" :
                      isSkipped ? "bg-muted text-muted-foreground" :
                      !unlocked ? "bg-muted text-muted-foreground" :
                      "bg-muted text-foreground"
                    )}>
                      {isCompleted ? <Check className="w-4 h-4" /> :
                       isSkipped ? <SkipForward className="w-3.5 h-3.5" /> :
                       !unlocked ? <Lock className="w-3.5 h-3.5" /> :
                       <span>{index + 1}</span>}
                    </div>

                    <div className="flex-1 min-w-0">
                      {isEditingThisPhase ? (
                        <Input
                          value={editingPhaseName}
                          onChange={(e) => setEditingPhaseName(e.target.value)}
                          onBlur={() => handleSavePhaseName(phase.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSavePhaseName(phase.id);
                            if (e.key === 'Escape') { setEditingPhaseId(null); setEditingPhaseName(''); }
                          }}
                          autoFocus
                          className="h-7 text-sm font-semibold px-2"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-semibold text-sm truncate",
                            isCompleted ? "text-emerald-600" :
                            !unlocked ? "text-muted-foreground" : "text-foreground"
                          )}>
                            {phase.phase_name}
                          </span>
                          {phase.parallel_group && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">paralelo</Badge>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium">{doneCount}/{totalCount}</span>
                        {(() => {
                          const phaseMinutes = phaseTasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
                          return phaseMinutes > 0 ? (
                            <span className="flex items-center gap-1 text-primary/70">
                              <Clock className="w-3 h-3" />
                              {formatTime(phaseMinutes)}
                            </span>
                          ) : null;
                        })()}
                        <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <CalendarClock className="w-3 h-3" />
                          <input
                            type="number"
                            min={0}
                            className="w-8 h-5 text-center text-xs bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            defaultValue={phase.due_days_limit ?? ''}
                            placeholder="—"
                            onBlur={(e) => {
                              const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                              if (val !== phase.due_days_limit) {
                                updatePhaseDaysLimit(phase.id, phase.phase_key, val);
                              }
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          />
                          <span className="text-[10px] text-muted-foreground/60">d</span>
                          {phase.due_date && (
                            <span className="text-muted-foreground/40 text-[10px]">
                              ({new Date(phase.due_date).toLocaleDateString('pt-BR')})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Edit phase name */}
                    {!isEditingThisPhase && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPhaseId(phase.id);
                          setEditingPhaseName(phase.phase_name);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {/* Unlock button for locked phases */}
                    {!unlocked && !isPaused && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                        onClick={(e) => { e.stopPropagation(); forceUnlockPhase(phase.id); }}
                      >
                        <Unlock className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {/* Mini progress */}
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isCompleted ? "bg-emerald-500" : "bg-blue-500"
                        )}
                        style={{ width: `${phaseProgress}%` }}
                      />
                    </div>
                    <button type="button" onClick={() => toggleCollapse(phase.id)} className="p-1">
                      {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                {/* Tasks */}
                {!isCollapsed && (
                  <div className="px-4 pb-3 pt-1 space-y-0.5">
                    {/* Select All row */}
                    {(unlocked || phase.status === 'em_andamento') && !isPaused && !isSkipped && totalCount > 0 && (
                      <div
                        className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/50 cursor-pointer border-b border-border/40 mb-1"
                        onClick={() => {
                          if (allDoneInPhase) uncheckAllTasks(phase.id);
                          else completeAllTasks(phase.id);
                        }}
                      >
                        <Checkbox
                          checked={allDoneInPhase}
                          onCheckedChange={(checked) => {
                            if (checked) completeAllTasks(phase.id);
                            else uncheckAllTasks(phase.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "h-5 w-5 rounded border-2 transition-colors shrink-0",
                            allDoneInPhase
                              ? "border-emerald-500 bg-emerald-500 text-white data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                              : "border-muted-foreground/40"
                          )}
                        />
                        <span className="text-sm font-medium text-muted-foreground select-none">
                          Selecionar todas
                        </span>
                      </div>
                    )}

                    {/* Task rows */}
                    {phaseTasks.map((task) => {
                      const isDone = task.status === 'concluido';
                      const isTaskSkipped = task.status === 'pulado';
                      const canInteract = (unlocked || phase.status === 'em_andamento') && !isPaused && !isTaskSkipped;
                      const isEditingThisTask = editingTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center gap-3 py-2 px-2 rounded-md transition-colors group/task",
                            isDone ? "bg-emerald-500/5" :
                            isTaskSkipped ? "opacity-50" :
                            canInteract ? "hover:bg-muted/50 cursor-pointer" : ""
                          )}
                          onClick={() => {
                            if (isEditingThisTask) return;
                            if (!canInteract) return;
                            if (isDone) uncheckTask(task.id);
                            else completeTask(task.id);
                          }}
                        >
                          <Checkbox
                            checked={isDone}
                            disabled={!canInteract}
                            onCheckedChange={(checked) => {
                              if (!canInteract) return;
                              if (checked) completeTask(task.id);
                              else uncheckTask(task.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "h-5 w-5 rounded border-2 transition-colors shrink-0",
                              isDone
                                ? "border-emerald-500 bg-emerald-500 text-white data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                : "border-muted-foreground/40"
                            )}
                          />

                          {/* Task name — editable */}
                          {isEditingThisTask ? (
                            <Input
                              value={editingTaskName}
                              onChange={(e) => setEditingTaskName(e.target.value)}
                              onBlur={() => handleSaveTaskName(task.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveTaskName(task.id);
                                if (e.key === 'Escape') { setEditingTaskId(null); setEditingTaskName(''); }
                              }}
                              autoFocus
                              className="h-7 text-sm flex-1 px-2"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className={cn(
                              "text-sm flex-1 select-none",
                              isDone && "line-through text-muted-foreground",
                              isTaskSkipped && "line-through text-muted-foreground",
                              !canInteract && !isDone && "text-muted-foreground"
                            )}>
                              {task.task_name}
                            </span>
                          )}

                          {/* Tempo estimado — coluna fixa */}
                          {!isEditingThisTask && (
                            <div className="w-20 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {editingTimeTaskId === task.id ? (
                                <div className="flex items-center gap-0.5">
                                  <input
                                    type="number"
                                    min={0}
                                    max={99}
                                    value={editingTimeHours}
                                    onChange={(e) => setEditingTimeHours(Math.max(0, parseInt(e.target.value) || 0))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveTime(task.id, task.task_key);
                                      if (e.key === 'Escape') setEditingTimeTaskId(null);
                                    }}
                                    autoFocus
                                    className="h-6 w-9 text-xs text-center rounded border border-border bg-background px-0.5"
                                  />
                                  <span className="text-[10px] text-muted-foreground">h</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={59}
                                    value={editingTimeMinutes}
                                    onChange={(e) => setEditingTimeMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveTime(task.id, task.task_key);
                                      if (e.key === 'Escape') setEditingTimeTaskId(null);
                                    }}
                                    onBlur={() => handleSaveTime(task.id, task.task_key)}
                                    className="h-6 w-9 text-xs text-center rounded border border-border bg-background px-0.5"
                                  />
                                  <span className="text-[10px] text-muted-foreground">m</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditingTime(task)}
                                  className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded hover:bg-muted/50"
                                >
                                  <Clock className="w-3 h-3" />
                                  {task.estimated_minutes ? (
                                    <span className="font-medium">{formatTime(task.estimated_minutes)}</span>
                                  ) : null}
                                </button>
                              )}
                            </div>
                          )}

                          {/* Responsável — coluna fixa */}
                          {!isEditingThisTask && (
                            <div className="w-24 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <AssigneePopover
                                taskId={task.id}
                                taskKey={task.task_key}
                                assignedTo={task.assigned_to}
                                memberMap={memberMap}
                                teamMembers={teamMembers}
                                onAssign={updateTaskAssignee}
                              />
                            </div>
                          )}


                          {task.completed_at && !isEditingThisTask && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(task.completed_at).toLocaleDateString('pt-BR')}
                            </span>
                          )}

                          {/* Action buttons on hover */}
                          {!isEditingThisTask && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover/task:opacity-100 transition-opacity shrink-0">
                              {/* Edit */}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTaskId(task.id);
                                  setEditingTaskName(task.task_name);
                                }}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              {/* Delete */}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                                onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add task row */}
                    {addingTaskPhaseId === phase.id ? (
                      <div className="flex items-center gap-2 py-2 px-2">
                        <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                        <Input
                          ref={newTaskInputRef}
                          value={newTaskName}
                          onChange={(e) => setNewTaskName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTask(phase.id);
                            if (e.key === 'Escape') { setAddingTaskPhaseId(null); setNewTaskName(''); }
                          }}
                          placeholder="Nome da tarefa..."
                          autoFocus
                          className="h-7 text-sm flex-1 px-2"
                        />
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleAddTask(phase.id)}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => { setAddingTaskPhaseId(null); setNewTaskName(''); }}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setAddingTaskPhaseId(phase.id); setNewTaskName(''); }}
                        className="flex items-center gap-2 py-2 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full rounded-md hover:bg-muted/50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar tarefa
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT: TIMELINE sidebar */}
        <div className="w-80 shrink-0 sticky top-4 hidden lg:block">
          <Card className="border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Timeline</CardTitle>
              <CardDescription className="text-xs">Eventos ativos do onboarding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Adicionar nota..."
                  className="min-h-[36px] h-9 resize-none text-sm"
                  rows={1}
                />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!noteText.trim() || isAddingNote}
                  className="shrink-0"
                >
                  {isAddingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {activeTimeline.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum evento registrado.</p>
                )}
                {activeTimeline.map((event) => (
                  <TimelineEvent key={event.id} event={event} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* TIMELINE for mobile (below phases, visible on small screens) */}
      <div className="lg:hidden">
        <Card className="border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Timeline</CardTitle>
            <CardDescription className="text-xs">Eventos ativos do onboarding</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Adicionar nota..."
                className="min-h-[36px] h-9 resize-none text-sm"
                rows={1}
              />
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!noteText.trim() || isAddingNote}
                className="shrink-0"
              >
                {isAddingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {activeTimeline.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum evento registrado.</p>
              )}
              {activeTimeline.map((event) => (
                <TimelineEvent key={event.id} event={event} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Alterar tipo de onboarding */}
      <AlertDialog open={showChangeType} onOpenChange={setShowChangeType}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar ou atualizar onboarding</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as fases e tarefas atuais serão recriadas a partir do template selecionado. Selecione o mesmo tipo para atualizar as etapas. A timeline será preservada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={pendingNewType || ''} onValueChange={(v) => setPendingNewType(v as OnboardingType)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o novo tipo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mrr_start">MRR Start</SelectItem>
              <SelectItem value="mrr_growth">MRR Growth</SelectItem>
              <SelectItem value="avulso_tema">Avulso — Tema Beacon</SelectItem>
              <SelectItem value="avulso_reformulacao">Avulso — Reformulação</SelectItem>
              <SelectItem value="avulso_arte">Avulso — Arte/Design</SelectItem>
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingNewType(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pendingNewType || isChangingType}
              onClick={async () => {
                if (!pendingNewType) return;
                setIsChangingType(true);
                try {
                  await changeOnboardingType(pendingNewType);
                } finally {
                  setIsChangingType(false);
                  setPendingNewType(null);
                  setShowChangeType(false);
                }
              }}
            >
              {isChangingType ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar Alteração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// ASSIGNEE POPOVER (controlled — fecha ao selecionar)
// =============================================================================
function AssigneePopover({ taskId, taskKey, assignedTo, memberMap, teamMembers, onAssign }: {
  taskId: string; taskKey: string; assignedTo: string | null;
  memberMap: Map<string, any>; teamMembers: any[];
  onAssign: (taskId: string, taskKey: string, assignedTo: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const assignee = assignedTo ? memberMap.get(assignedTo) : null;

  const handleSelect = (userId: string | null) => {
    onAssign(taskId, taskKey, userId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-1 hover:bg-muted/50 rounded px-1 py-0.5 transition-colors">
          {assignee ? (() => {
            const name = assignee.profile?.full_name || assignee.email || '';
            const initials = name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
            return (
              <>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={assignee.profile?.avatar_url || ''} />
                  <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <span className="text-[10px] text-muted-foreground max-w-[60px] truncate hidden sm:inline">{name.split(' ')[0]}</span>
              </>
            );
          })() : <UserCircle className="w-4 h-4 text-muted-foreground/30" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end">
        <button type="button" onClick={() => handleSelect(null)}
          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/50 text-muted-foreground">
          Ninguém
        </button>
        {teamMembers.map((m: any) => (
          <button key={m.user_id} type="button" onClick={() => handleSelect(m.user_id)}
            className={cn("w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/50 flex items-center gap-2",
              assignedTo === m.user_id && "bg-primary/10")}>
            <Avatar className="h-5 w-5">
              <AvatarImage src={m.profile?.avatar_url || ''} />
              <AvatarFallback className="text-[8px]">{(m.profile?.full_name || m.email || '').substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="truncate">{m.profile?.full_name || m.email}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// =============================================================================
// TIMELINE EVENT
// =============================================================================
function TimelineEvent({ event }: { event: { id: string; event_type: string; event_data: Record<string, any>; created_at: string } }) {
  const iconMap: Record<string, React.ReactNode> = {
    phase_started: <Play className="w-3 h-3 text-blue-500" />,
    phase_completed: <CheckCircle2 className="w-3 h-3 text-emerald-500" />,
    task_completed: <Check className="w-3 h-3 text-emerald-500" />,
    note_added: <FileText className="w-3 h-3 text-primary" />,
    whatsapp_created: <MessageCircle className="w-3 h-3 text-green-500" />,
    portal_granted: <Shield className="w-3 h-3 text-blue-500" />,
    status_changed: <AlertCircle className="w-3 h-3 text-amber-500" />,
    briefing_sent: <Send className="w-3 h-3 text-primary" />,
    briefing_completed: <FileText className="w-3 h-3 text-emerald-500" />,
    meeting_scheduled: <CalendarClock className="w-3 h-3 text-primary" />,
  };

  const getMessage = (): string => {
    const d = event.event_data || {};
    switch (event.event_type) {
      case 'task_completed': return `Tarefa concluída: ${d.task_name || ''}`;
      case 'phase_started': return `Fase iniciada: ${d.phase_name || ''}`;
      case 'phase_completed': return `Fase concluída: ${d.phase_name || ''}`;
      case 'note_added': return d.note || 'Nota adicionada';
      case 'whatsapp_created': return 'Grupo WhatsApp criado';
      case 'portal_granted': return 'Acesso ao Portal concedido';
      case 'status_changed': return d.message || `Status: ${d.from} → ${d.to}`;
      case 'briefing_sent': return 'Briefing enviado ao cliente';
      case 'briefing_completed': return 'Briefing preenchido pelo cliente';
      case 'meeting_scheduled': return 'Reunião agendada';
      default: return event.event_type;
    }
  };

  const dateStr = event.created_at ? new Date(event.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }) : '';

  return (
    <div className="flex items-start gap-2.5 text-xs">
      <div className="mt-0.5 w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
        {iconMap[event.event_type] || <Clock className="w-3 h-3 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-foreground leading-tight">{getMessage()}</p>
        <p className="text-muted-foreground text-[10px]">{dateStr}</p>
      </div>
    </div>
  );
}
