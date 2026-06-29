/**
 * useOnboarding — Hook CRUD para o Sistema de Onboarding por Checklist
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getTemplateForType } from '@/constants/onboarding-templates';
import type {
  OnboardingType,
  OnboardingStatus,
  OnboardingFull,
  OnboardingRow,
  OnboardingPhaseWithTasks,
  OnboardingPhaseRow,
  OnboardingTaskRow,
  OnboardingTimelineRow,
  TimelineEventType,
  PhaseStatus,
  TaskStatus,
} from '@/types/onboarding';

// =============================================================================
// HOOK
// =============================================================================

export function useOnboarding(clientId: string | null, workspaceId?: string | null) {
  const [onboarding, setOnboarding] = useState<OnboardingFull | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // HELPER — Buscar defaults de tempo/responsável de tasks existentes no workspace
  // ---------------------------------------------------------------------------
  const fetchTaskDefaults = useCallback(async (): Promise<Map<string, { estimated_minutes: number | null; assigned_to: string | null }>> => {
    const defaults = new Map<string, { estimated_minutes: number | null; assigned_to: string | null }>();
    if (!workspaceId) return defaults;

    try {
      const { data: wsClients } = await (supabase as any)
        .from('agency_clients').select('id').eq('workspace_id', workspaceId);
      if (!wsClients?.length) return defaults;

      const { data: wsOnboardings } = await (supabase as any)
        .from('onboarding').select('id').in('client_id', wsClients.map((c: any) => c.id));
      if (!wsOnboardings?.length) return defaults;

      const { data: wsPhases } = await (supabase as any)
        .from('onboarding_phases').select('id').in('onboarding_id', wsOnboardings.map((o: any) => o.id));
      if (!wsPhases?.length) return defaults;

      const { data: tasks } = await (supabase as any)
        .from('onboarding_tasks')
        .select('task_key, estimated_minutes, assigned_to')
        .in('phase_id', wsPhases.map((p: any) => p.id));

      for (const t of (tasks || [])) {
        if ((t.estimated_minutes || t.assigned_to) && !defaults.has(t.task_key)) {
          defaults.set(t.task_key, { estimated_minutes: t.estimated_minutes, assigned_to: t.assigned_to });
        }
      }
    } catch (err) {
      console.error('[useOnboarding] fetchTaskDefaults error:', err);
    }

    return defaults;
  }, [workspaceId]);

  // ---------------------------------------------------------------------------
  // FETCH — Carrega onboarding completo (com fases, tarefas e timeline)
  // ---------------------------------------------------------------------------
  const fetchOnboarding = useCallback(async () => {
    if (!clientId) {
      setOnboarding(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Buscar onboarding do cliente
      const { data: onbRow, error: onbErr } = await (supabase as any)
        .from('onboarding')
        .select('*')
        .eq('client_id', clientId)
        .limit(1)
        .maybeSingle();

      if (onbErr) throw onbErr;

      if (!onbRow) {
        setOnboarding(null);
        setIsLoading(false);
        return;
      }

      // 2. Buscar fases
      const { data: phasesData, error: phErr } = await (supabase as any)
        .from('onboarding_phases')
        .select('*')
        .eq('onboarding_id', onbRow.id)
        .order('phase_order', { ascending: true });

      if (phErr) throw phErr;

      // 3. Buscar tarefas de todas as fases
      const phaseIds = (phasesData || []).map((p: OnboardingPhaseRow) => p.id);
      let tasksData: OnboardingTaskRow[] = [];

      if (phaseIds.length > 0) {
        const { data: tData, error: tErr } = await (supabase as any)
          .from('onboarding_tasks')
          .select('*')
          .in('phase_id', phaseIds)
          .order('task_order', { ascending: true });

        if (tErr) throw tErr;
        tasksData = tData || [];
      }

      // 4. Buscar timeline (últimos 50 eventos)
      const { data: timelineData, error: tlErr } = await (supabase as any)
        .from('onboarding_timeline')
        .select('*')
        .eq('onboarding_id', onbRow.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (tlErr) throw tlErr;

      // 5. Montar estrutura completa
      const phases: OnboardingPhaseWithTasks[] = (phasesData || []).map(
        (phase: OnboardingPhaseRow) => ({
          ...phase,
          tasks: tasksData.filter((t) => t.phase_id === phase.id),
        })
      );

      setOnboarding({
        ...onbRow,
        phases,
        timeline: (timelineData || []) as OnboardingTimelineRow[],
      });
    } catch (err: any) {
      console.error('[useOnboarding] fetch error:', err);
      setError(err.message || 'Erro ao carregar onboarding');
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchOnboarding();
  }, [fetchOnboarding]);

  // ---------------------------------------------------------------------------
  // CREATE — Gera onboarding completo a partir do template
  // ---------------------------------------------------------------------------
  const createOnboarding = useCallback(
    async (type: OnboardingType) => {
      if (!clientId) return null;

      const template = getTemplateForType(type);
      if (!template) {
        toast.error('Template não encontrado para o tipo: ' + type);
        return null;
      }

      try {
        // 1. Criar registro principal
        const startedAt = new Date().toISOString();
        const { data: onbRow, error: onbErr } = await (supabase as any)
          .from('onboarding')
          .insert({
            client_id: clientId,
            type,
            status: 'pendente',
            current_phase: template.phases[0]?.phase_key || null,
            started_at: startedAt,
          })
          .select()
          .single();

        if (onbErr) throw onbErr;

        // 2. Criar fases
        // Calcular due_dates sequenciais: cada fase começa quando a anterior termina
        let cumulativeDate = Date.now();
        const sortedTemplatePhases = [...template.phases].sort((a, b) => a.phase_order - b.phase_order);
        const phasesToInsert = sortedTemplatePhases.map((ph) => {
          const daysLimit = ph.due_days_offset > 0 ? ph.due_days_offset : null;
          let dueDate: string | null = null;
          if (daysLimit && daysLimit > 0) {
            cumulativeDate += daysLimit * 86400000;
            dueDate = new Date(cumulativeDate).toISOString();
          }
          return {
            onboarding_id: onbRow.id,
            phase_key: ph.phase_key,
            phase_name: ph.phase_name,
            phase_order: ph.phase_order,
            parallel_group: ph.parallel_group || null,
            status: 'pendente',
            due_days_limit: daysLimit,
            due_date: dueDate,
          };
        });

        const { data: insertedPhases, error: phErr } = await (supabase as any)
          .from('onboarding_phases')
          .insert(phasesToInsert)
          .select();

        if (phErr) throw phErr;

        // 3. Buscar defaults de tempo/responsável de tasks existentes no workspace
        const taskDefaults = await fetchTaskDefaults();

        // 4. Criar tarefas para cada fase (com defaults herdados)
        const tasksToInsert: any[] = [];
        for (const phase of template.phases) {
          const dbPhase = (insertedPhases as OnboardingPhaseRow[]).find(
            (p) => p.phase_key === phase.phase_key
          );
          if (!dbPhase) continue;

          for (const task of phase.tasks) {
            const def = taskDefaults.get(task.task_key);
            tasksToInsert.push({
              phase_id: dbPhase.id,
              task_key: task.task_key,
              task_name: task.task_name,
              task_description: task.task_description || null,
              is_required: task.is_required,
              status: 'pendente',
              task_order: task.task_order,
              estimated_minutes: def?.estimated_minutes || null,
              assigned_to: def?.assigned_to || null,
            });
          }
        }

        if (tasksToInsert.length > 0) {
          const { error: tErr } = await (supabase as any)
            .from('onboarding_tasks')
            .insert(tasksToInsert);

          if (tErr) throw tErr;
        }

        // 4. Atualizar onboarding_type no client
        await (supabase as any)
          .from('agency_clients')
          .update({ onboarding_type: type })
          .eq('id', clientId);

        // 5. Registrar evento na timeline
        await addTimelineEvent(onbRow.id, 'status_changed', {
          from: null,
          to: 'pendente',
          message: `Onboarding criado (${type})`,
        });

        toast.success('Onboarding criado com sucesso!');
        await fetchOnboarding();
        return onbRow;
      } catch (err: any) {
        console.error('[useOnboarding] create error:', err);
        toast.error('Erro ao criar onboarding: ' + (err.message || ''));
        return null;
      }
    },
    [clientId, fetchOnboarding]
  );

  // ---------------------------------------------------------------------------
  // TASK ACTIONS
  // ---------------------------------------------------------------------------
  // Optimistic local state updater — no refetch needed
  const updateLocalTask = useCallback(
    (taskId: string, status: TaskStatus) => {
      setOnboarding((prev) => {
        if (!prev) return prev;
        const now = new Date().toISOString();
        const newPhases = prev.phases.map((phase) => ({
          ...phase,
          tasks: phase.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status,
                  completed_at: status === 'concluido' ? now : null,
                }
              : t
          ),
        }));
        return { ...prev, phases: newPhases };
      });
    },
    []
  );

  const updateTaskStatus = useCallback(
    async (taskId: string, status: TaskStatus) => {
      if (!onboarding) return;

      // Find task info before optimistic update
      let taskName = '';
      let phaseId = '';
      for (const phase of onboarding.phases) {
        const task = phase.tasks.find((t) => t.id === taskId);
        if (task) {
          taskName = task.task_name;
          phaseId = phase.id;
          break;
        }
      }

      // Optimistic update — instant UI feedback
      updateLocalTask(taskId, status);

      const userId = (await supabase.auth.getUser()).data.user?.id || null;

      const updateData: any = {
        status,
        completed_by: status === 'concluido' ? userId : null,
        completed_at: status === 'concluido' ? new Date().toISOString() : null,
      };

      const { error } = await (supabase as any)
        .from('onboarding_tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) {
        console.error('[useOnboarding] updateTaskStatus error:', error);
        toast.error('Erro ao atualizar tarefa');
        // Revert on error
        updateLocalTask(taskId, status === 'concluido' ? 'pendente' : 'concluido');
        return;
      }

      const eventType: TimelineEventType =
        status === 'concluido' ? 'task_completed' : 'task_unchecked';

      // Fire-and-forget timeline event (don't block UI)
      addTimelineEvent(onboarding.id, eventType, {
        task_id: taskId,
        task_name: taskName,
        status,
      });

      // Check phase completion in background
      if (status === 'concluido' && phaseId) {
        checkPhaseCompletion(phaseId);
      }
    },
    [onboarding, updateLocalTask]
  );

  // Bulk complete/uncheck all tasks in a phase
  const completeAllTasks = useCallback(
    async (phaseId: string) => {
      if (!onboarding) return;
      const phase = onboarding.phases.find((p) => p.id === phaseId);
      if (!phase) return;

      const pendingTasks = phase.tasks.filter((t) => t.status !== 'concluido' && t.status !== 'pulado');
      if (pendingTasks.length === 0) return;

      // Optimistic update all
      for (const task of pendingTasks) {
        updateLocalTask(task.id, 'concluido');
      }

      const userId = (await supabase.auth.getUser()).data.user?.id || null;
      const now = new Date().toISOString();
      const taskIds = pendingTasks.map((t) => t.id);

      const { error } = await (supabase as any)
        .from('onboarding_tasks')
        .update({
          status: 'concluido',
          completed_by: userId,
          completed_at: now,
        })
        .in('id', taskIds);

      if (error) {
        console.error('[useOnboarding] completeAllTasks error:', error);
        toast.error('Erro ao completar tarefas');
        await fetchOnboarding(); // revert via refetch
        return;
      }

      // Timeline event
      addTimelineEvent(onboarding.id, 'phase_completed', {
        phase_id: phaseId,
        phase_name: phase.phase_name,
        message: `Todas as tarefas marcadas como concluídas`,
      });

      // Check phase completion
      checkPhaseCompletion(phaseId);
    },
    [onboarding, updateLocalTask, fetchOnboarding]
  );

  const uncheckAllTasks = useCallback(
    async (phaseId: string) => {
      if (!onboarding) return;
      const phase = onboarding.phases.find((p) => p.id === phaseId);
      if (!phase) return;

      const doneTasks = phase.tasks.filter((t) => t.status === 'concluido');
      if (doneTasks.length === 0) return;

      // Optimistic update all
      for (const task of doneTasks) {
        updateLocalTask(task.id, 'pendente');
      }

      const taskIds = doneTasks.map((t) => t.id);

      const { error } = await (supabase as any)
        .from('onboarding_tasks')
        .update({
          status: 'pendente',
          completed_by: null,
          completed_at: null,
        })
        .in('id', taskIds);

      if (error) {
        console.error('[useOnboarding] uncheckAllTasks error:', error);
        toast.error('Erro ao desmarcar tarefas');
        await fetchOnboarding();
        return;
      }

      // Reopen phase if it was completed
      if (phase.status === 'concluido') {
        await (supabase as any)
          .from('onboarding_phases')
          .update({ status: 'em_andamento', completed_at: null })
          .eq('id', phaseId);
      }
    },
    [onboarding, updateLocalTask, fetchOnboarding]
  );

  // Force-unlock a phase (start it manually regardless of lock)
  const forceUnlockPhase = useCallback(
    async (phaseId: string) => {
      if (!onboarding) return;

      const phase = onboarding.phases.find((p) => p.id === phaseId);
      const now = new Date();
      const unlockUpdate: any = {
        status: 'em_andamento',
        started_at: now.toISOString(),
      };
      if (phase?.due_days_limit && phase.due_days_limit > 0) {
        unlockUpdate.due_date = new Date(now.getTime() + phase.due_days_limit * 86400000).toISOString();
      }

      await (supabase as any)
        .from('onboarding_phases')
        .update(unlockUpdate)
        .eq('id', phaseId);

      await addTimelineEvent(onboarding.id, 'phase_started', {
        phase_id: phaseId,
        phase_name: phase?.phase_name || '',
        message: 'Fase desbloqueada manualmente',
      });

      if (onboarding.status === 'pendente') {
        await (supabase as any)
          .from('onboarding')
          .update({ status: 'em_andamento', current_phase: phase?.phase_key })
          .eq('id', onboarding.id);
      }

      toast.success(`Fase "${phase?.phase_name}" desbloqueada`);
      await fetchOnboarding();
    },
    [onboarding, fetchOnboarding]
  );

  const completeTask = useCallback(
    (taskId: string) => updateTaskStatus(taskId, 'concluido'),
    [updateTaskStatus]
  );

  const uncheckTask = useCallback(
    (taskId: string) => updateTaskStatus(taskId, 'pendente'),
    [updateTaskStatus]
  );

  const skipTask = useCallback(
    (taskId: string) => updateTaskStatus(taskId, 'pulado'),
    [updateTaskStatus]
  );

  // ---------------------------------------------------------------------------
  // PHASE ACTIONS
  // ---------------------------------------------------------------------------
  const checkPhaseCompletion = useCallback(
    async (phaseId: string) => {
      if (!onboarding) return;

      const phase = onboarding.phases.find((p) => p.id === phaseId);
      if (!phase) return;

      // Recarregar tarefas da fase para ter dados atuais
      const { data: freshTasks } = await (supabase as any)
        .from('onboarding_tasks')
        .select('*')
        .eq('phase_id', phaseId);

      if (!freshTasks) return;

      const requiredTasks = freshTasks.filter((t: OnboardingTaskRow) => t.is_required);
      const allRequiredDone = requiredTasks.every(
        (t: OnboardingTaskRow) => t.status === 'concluido' || t.status === 'pulado'
      );

      if (allRequiredDone && phase.status !== 'concluido') {
        await (supabase as any)
          .from('onboarding_phases')
          .update({
            status: 'concluido',
            completed_at: new Date().toISOString(),
          })
          .eq('id', phaseId);

        await addTimelineEvent(onboarding.id, 'phase_completed', {
          phase_id: phaseId,
          phase_name: phase.phase_name,
        });

        // Verificar se o onboarding inteiro foi concluído
        await checkOnboardingCompletion();
      }
    },
    [onboarding]
  );

  const startPhase = useCallback(
    async (phaseId: string) => {
      if (!onboarding) return;

      const phase = onboarding.phases.find((p) => p.id === phaseId);
      const now = new Date();
      const startUpdate: any = {
        status: 'em_andamento',
        started_at: now.toISOString(),
      };
      if (phase?.due_days_limit && phase.due_days_limit > 0) {
        startUpdate.due_date = new Date(now.getTime() + phase.due_days_limit * 86400000).toISOString();
      }

      await (supabase as any)
        .from('onboarding_phases')
        .update(startUpdate)
        .eq('id', phaseId);

      await addTimelineEvent(onboarding.id, 'phase_started', {
        phase_id: phaseId,
        phase_name: phase?.phase_name || '',
      });

      // Atualizar status do onboarding se ainda pendente
      if (onboarding.status === 'pendente') {
        await (supabase as any)
          .from('onboarding')
          .update({ status: 'em_andamento', current_phase: phase?.phase_key })
          .eq('id', onboarding.id);
      }

      await fetchOnboarding();
    },
    [onboarding, fetchOnboarding]
  );

  const skipPhase = useCallback(
    async (phaseId: string) => {
      if (!onboarding) return;

      await (supabase as any)
        .from('onboarding_phases')
        .update({ status: 'pulado', completed_at: new Date().toISOString() })
        .eq('id', phaseId);

      // Marcar todas as tarefas como puladas
      await (supabase as any)
        .from('onboarding_tasks')
        .update({ status: 'pulado' })
        .eq('phase_id', phaseId);

      await fetchOnboarding();
    },
    [onboarding, fetchOnboarding]
  );

  // ---------------------------------------------------------------------------
  // ONBOARDING STATUS
  // ---------------------------------------------------------------------------
  const checkOnboardingCompletion = useCallback(async () => {
    if (!onboarding) return;

    // Recarregar fases atuais
    const { data: freshPhases } = await (supabase as any)
      .from('onboarding_phases')
      .select('*')
      .eq('onboarding_id', onboarding.id);

    if (!freshPhases) return;

    const allDone = freshPhases.every(
      (p: OnboardingPhaseRow) => p.status === 'concluido' || p.status === 'pulado'
    );

    if (allDone) {
      await (supabase as any)
        .from('onboarding')
        .update({
          status: 'concluido',
          completed_at: new Date().toISOString(),
        })
        .eq('id', onboarding.id);

      await addTimelineEvent(onboarding.id, 'status_changed', {
        from: onboarding.status,
        to: 'concluido',
        message: 'Onboarding concluído!',
      });

      toast.success('Onboarding concluído!');
    }
  }, [onboarding]);

  const pauseOnboarding = useCallback(async () => {
    if (!onboarding) return;

    await (supabase as any)
      .from('onboarding')
      .update({ status: 'pausado', updated_at: new Date().toISOString() })
      .eq('id', onboarding.id);

    await addTimelineEvent(onboarding.id, 'status_changed', {
      from: onboarding.status,
      to: 'pausado',
    });

    toast('Onboarding pausado');
    await fetchOnboarding();
  }, [onboarding, fetchOnboarding]);

  const resumeOnboarding = useCallback(async () => {
    if (!onboarding) return;

    await (supabase as any)
      .from('onboarding')
      .update({ status: 'em_andamento', updated_at: new Date().toISOString() })
      .eq('id', onboarding.id);

    await addTimelineEvent(onboarding.id, 'status_changed', {
      from: 'pausado',
      to: 'em_andamento',
    });

    toast.success('Onboarding retomado');
    await fetchOnboarding();
  }, [onboarding, fetchOnboarding]);

  // ---------------------------------------------------------------------------
  // QUICK ACTIONS
  // ---------------------------------------------------------------------------
  const toggleWhatsapp = useCallback(async () => {
    if (!onboarding) return;

    const newValue = !onboarding.whatsapp_group_created;

    // Optimistic
    setOnboarding((prev) => prev ? { ...prev, whatsapp_group_created: newValue } : prev);

    await (supabase as any)
      .from('onboarding')
      .update({ whatsapp_group_created: newValue, updated_at: new Date().toISOString() })
      .eq('id', onboarding.id);

    addTimelineEvent(onboarding.id, 'whatsapp_created', {
      message: newValue ? 'Grupo WhatsApp criado' : 'Grupo WhatsApp desmarcado',
    });

    toast.success(newValue ? 'WhatsApp marcado' : 'WhatsApp desmarcado');
  }, [onboarding]);

  const togglePortalAccess = useCallback(async () => {
    if (!onboarding) return;

    const newValue = !onboarding.portal_access_granted;

    // Optimistic
    setOnboarding((prev) => prev ? { ...prev, portal_access_granted: newValue } : prev);

    await (supabase as any)
      .from('onboarding')
      .update({ portal_access_granted: newValue, updated_at: new Date().toISOString() })
      .eq('id', onboarding.id);

    addTimelineEvent(onboarding.id, 'portal_granted', {
      message: newValue ? 'Acesso ao Portal concedido' : 'Acesso ao Portal removido',
    });

    toast.success(newValue ? 'Portal concedido' : 'Portal desmarcado');
  }, [onboarding]);

  // ---------------------------------------------------------------------------
  // TIMELINE
  // ---------------------------------------------------------------------------
  const addTimelineEvent = async (
    onboardingId: string,
    eventType: TimelineEventType,
    eventData: Record<string, any>
  ) => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id || null;

      const { error } = await (supabase as any).from('onboarding_timeline').insert({
        onboarding_id: onboardingId,
        event_type: eventType,
        event_data: eventData,
        performed_by: userId,
      });

      if (error) console.error('[useOnboarding] timeline insert error:', error);
    } catch (err) {
      console.error('[useOnboarding] timeline error:', err);
    }
  };

  const addNote = useCallback(
    async (note: string) => {
      if (!onboarding) return;

      await addTimelineEvent(onboarding.id, 'note_added', { note });
      await fetchOnboarding();
    },
    [onboarding, fetchOnboarding]
  );

  // ---------------------------------------------------------------------------
  // TASK / PHASE CRUD (add, edit, delete)
  // ---------------------------------------------------------------------------
  const addCustomTask = useCallback(
    async (phaseId: string, taskName: string) => {
      if (!onboarding) return;

      // Get max task_order in this phase
      const phase = onboarding.phases.find((p) => p.id === phaseId);
      if (!phase) return;
      const maxOrder = phase.tasks.reduce((max, t) => Math.max(max, t.task_order), 0);

      const { error } = await (supabase as any)
        .from('onboarding_tasks')
        .insert({
          phase_id: phaseId,
          task_key: `custom_${Date.now()}`,
          task_name: taskName,
          task_description: null,
          is_required: false,
          status: 'pendente',
          task_order: maxOrder + 1,
        });

      if (error) {
        console.error('[useOnboarding] addCustomTask error:', error);
        toast.error('Erro ao adicionar tarefa');
        return;
      }

      toast.success('Tarefa adicionada');
      await fetchOnboarding();
    },
    [onboarding, fetchOnboarding]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!onboarding) return;

      const { error } = await (supabase as any)
        .from('onboarding_tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        console.error('[useOnboarding] deleteTask error:', error);
        toast.error('Erro ao excluir tarefa');
        return;
      }

      // Optimistic remove
      setOnboarding((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phases: prev.phases.map((p) => ({
            ...p,
            tasks: p.tasks.filter((t) => t.id !== taskId),
          })),
        };
      });

      toast.success('Tarefa excluída');
    },
    [onboarding]
  );

  const updateTaskName = useCallback(
    async (taskId: string, newName: string) => {
      const { error } = await (supabase as any)
        .from('onboarding_tasks')
        .update({ task_name: newName })
        .eq('id', taskId);

      if (error) {
        console.error('[useOnboarding] updateTaskName error:', error);
        toast.error('Erro ao renomear tarefa');
        return;
      }

      // Optimistic update
      setOnboarding((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phases: prev.phases.map((p) => ({
            ...p,
            tasks: p.tasks.map((t) => t.id === taskId ? { ...t, task_name: newName } : t),
          })),
        };
      });
    },
    []
  );

  // Helper: propagar campo para todas tasks com mesmo task_key no workspace
  const propagateTaskField = useCallback(
    async (taskKey: string, field: string, value: any) => {
      if (!workspaceId) return;
      try {
        // 1. Buscar client_ids do workspace
        const { data: wsClients } = await (supabase as any)
          .from('agency_clients')
          .select('id')
          .eq('workspace_id', workspaceId);
        if (!wsClients?.length) return;

        // 2. Buscar onboarding_ids desses clientes
        const { data: wsOnboardings } = await (supabase as any)
          .from('onboarding')
          .select('id')
          .in('client_id', wsClients.map((c: any) => c.id));
        if (!wsOnboardings?.length) return;

        // 3. Buscar phase_ids desses onboardings
        const { data: wsPhases } = await (supabase as any)
          .from('onboarding_phases')
          .select('id')
          .in('onboarding_id', wsOnboardings.map((o: any) => o.id));
        if (!wsPhases?.length) return;

        // 4. Batch update todas tasks com mesma task_key
        await (supabase as any)
          .from('onboarding_tasks')
          .update({ [field]: value })
          .eq('task_key', taskKey)
          .in('phase_id', wsPhases.map((p: any) => p.id));
      } catch (err) {
        console.error('[useOnboarding] propagateTaskField error:', err);
      }
    },
    [workspaceId]
  );

  const updateTaskEstimate = useCallback(
    async (taskId: string, taskKey: string, estimatedMinutes: number | null) => {
      // 1. Update local task
      const { error } = await (supabase as any)
        .from('onboarding_tasks')
        .update({ estimated_minutes: estimatedMinutes })
        .eq('id', taskId);

      if (error) {
        toast.error('Erro ao atualizar tempo');
        return;
      }

      // 2. Optimistic local update
      setOnboarding((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phases: prev.phases.map((p) => ({
            ...p,
            tasks: p.tasks.map((t) => t.id === taskId ? { ...t, estimated_minutes: estimatedMinutes } : t),
          })),
        };
      });

      // 3. Propagar para todos os clientes do workspace (fire-and-forget)
      propagateTaskField(taskKey, 'estimated_minutes', estimatedMinutes);
    },
    [propagateTaskField]
  );

  const updateTaskAssignee = useCallback(
    async (taskId: string, taskKey: string, assignedTo: string | null) => {
      const { error } = await (supabase as any)
        .from('onboarding_tasks')
        .update({ assigned_to: assignedTo })
        .eq('id', taskId);

      if (error) {
        toast.error('Erro ao atribuir responsável');
        return;
      }

      setOnboarding((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phases: prev.phases.map((p) => ({
            ...p,
            tasks: p.tasks.map((t) => t.id === taskId ? { ...t, assigned_to: assignedTo } : t),
          })),
        };
      });

      propagateTaskField(taskKey, 'assigned_to', assignedTo);
    },
    [propagateTaskField]
  );

  const updatePhaseName = useCallback(
    async (phaseId: string, newName: string) => {
      const { error } = await (supabase as any)
        .from('onboarding_phases')
        .update({ phase_name: newName })
        .eq('id', phaseId);

      if (error) {
        console.error('[useOnboarding] updatePhaseName error:', error);
        toast.error('Erro ao renomear fase');
        return;
      }

      // Optimistic update
      setOnboarding((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phases: prev.phases.map((p) => p.id === phaseId ? { ...p, phase_name: newName } : p),
        };
      });
    },
    []
  );

  // Helper: propagar campo de fase para todas fases com mesmo phase_key no workspace
  const propagatePhaseField = useCallback(
    async (phaseKey: string, field: string, value: any) => {
      if (!workspaceId) return;
      try {
        const { data: wsClients } = await (supabase as any)
          .from('agency_clients').select('id').eq('workspace_id', workspaceId);
        if (!wsClients?.length) return;
        const { data: wsOnbs } = await (supabase as any)
          .from('onboarding').select('id').in('client_id', wsClients.map((c: any) => c.id));
        if (!wsOnbs?.length) return;
        await (supabase as any)
          .from('onboarding_phases')
          .update({ [field]: value })
          .eq('phase_key', phaseKey)
          .in('onboarding_id', wsOnbs.map((o: any) => o.id));
      } catch (err) {
        console.error('[useOnboarding] propagatePhaseField error:', err);
      }
    },
    [workspaceId]
  );

  const updatePhaseDaysLimit = useCallback(
    async (phaseId: string, phaseKey: string, daysLimit: number | null) => {
      if (!onboarding) return;

      const phase = onboarding.phases.find((p) => p.id === phaseId);
      const updateData: any = { due_days_limit: daysLimit };

      // Se fase já iniciou, recalcular due_date
      if (phase?.started_at && daysLimit && daysLimit > 0) {
        updateData.due_date = new Date(
          new Date(phase.started_at).getTime() + daysLimit * 86400000
        ).toISOString();
      } else if (!daysLimit || daysLimit === 0) {
        updateData.due_date = null;
      }

      const { error } = await (supabase as any)
        .from('onboarding_phases')
        .update(updateData)
        .eq('id', phaseId);

      if (error) {
        toast.error('Erro ao atualizar prazo da fase');
        return;
      }

      // Optimistic local update
      setOnboarding((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phases: prev.phases.map((p) =>
            p.id === phaseId
              ? { ...p, due_days_limit: daysLimit, ...(updateData.due_date !== undefined ? { due_date: updateData.due_date } : {}) }
              : p
          ),
        };
      });

      // Propagar para todos onboardings com mesma phase_key (fire-and-forget)
      propagatePhaseField(phaseKey, 'due_days_limit', daysLimit);
    },
    [onboarding, propagatePhaseField]
  );

  // ---------------------------------------------------------------------------
  // COMPUTED VALUES
  // ---------------------------------------------------------------------------
  const totalTasks = onboarding
    ? onboarding.phases.reduce((acc, p) => acc + p.tasks.length, 0)
    : 0;

  const completedTasks = onboarding
    ? onboarding.phases.reduce(
        (acc, p) => acc + p.tasks.filter((t) => t.status === 'concluido').length,
        0
      )
    : 0;

  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // ---------------------------------------------------------------------------
  // PHASE LOCK LOGIC
  // ---------------------------------------------------------------------------
  const isPhaseUnlocked = useCallback(
    (phase: OnboardingPhaseWithTasks, allPhases: OnboardingPhaseWithTasks[]): boolean => {
      if (!allPhases.length) return false;

      // Primeira fase sempre desbloqueada
      const sortedPhases = [...allPhases].sort((a, b) => a.phase_order - b.phase_order);
      if (phase.id === sortedPhases[0].id) return true;

      // Se já tem atividade, está desbloqueada
      if (phase.status === 'em_andamento' || phase.status === 'concluido' || phase.status === 'pulado') {
        return true;
      }

      // Fases no mesmo parallel_group: desbloqueiam juntas
      if (phase.parallel_group) {
        // A primeira fase do grupo paralelo precisa da fase anterior ao grupo estar completa
        const groupPhases = sortedPhases.filter((p) => p.parallel_group === phase.parallel_group);
        const firstGroupPhase = groupPhases[0];
        const firstGroupIndex = sortedPhases.indexOf(firstGroupPhase);

        if (firstGroupIndex === 0) return true;

        // Buscar a fase anterior ao grupo (que NÃO pertence ao mesmo parallel_group)
        let prevPhase: OnboardingPhaseWithTasks | null = null;
        for (let i = firstGroupIndex - 1; i >= 0; i--) {
          if (sortedPhases[i].parallel_group !== phase.parallel_group) {
            prevPhase = sortedPhases[i];
            break;
          }
        }

        if (!prevPhase) return true;
        return prevPhase.status === 'concluido' || prevPhase.status === 'pulado';
      }

      // Fase sequencial: precisa da anterior estar concluída
      const phaseIndex = sortedPhases.findIndex((p) => p.id === phase.id);
      if (phaseIndex <= 0) return true;

      // Buscar fase anterior (pode ser do grupo paralelo — todas precisam estar completas)
      const prevPhase = sortedPhases[phaseIndex - 1];
      if (prevPhase.parallel_group) {
        // Todas as fases do grupo paralelo anterior precisam estar concluídas
        const prevGroupPhases = sortedPhases.filter(
          (p) => p.parallel_group === prevPhase.parallel_group
        );
        return prevGroupPhases.every(
          (p) => p.status === 'concluido' || p.status === 'pulado'
        );
      }

      return prevPhase.status === 'concluido' || prevPhase.status === 'pulado';
    },
    []
  );

  // ---------------------------------------------------------------------------
  // CHANGE TYPE — Recria fases e tasks a partir do novo template
  // ---------------------------------------------------------------------------
  const changeOnboardingType = useCallback(
    async (newType: OnboardingType) => {
      if (!onboarding || !clientId) return;

      const template = getTemplateForType(newType);
      if (!template) {
        toast.error('Template não encontrado: ' + newType);
        return;
      }

      try {
        // 1. Deletar fases existentes (CASCADE deleta tasks)
        await (supabase as any)
          .from('onboarding_phases')
          .delete()
          .eq('onboarding_id', onboarding.id);

        // 2. Atualizar onboarding com novo tipo
        await (supabase as any)
          .from('onboarding')
          .update({
            type: newType,
            status: 'pendente',
            current_phase: template.phases[0]?.phase_key || null,
            completed_at: null,
          })
          .eq('id', onboarding.id);

        // 3. Criar novas fases (datas sequenciais)
        let cumulativeDate = Date.now();
        const sortedTemplatePhases = [...template.phases].sort((a, b) => a.phase_order - b.phase_order);
        const phasesToInsert = sortedTemplatePhases.map((ph) => {
          const daysLimit = ph.due_days_offset > 0 ? ph.due_days_offset : null;
          let dueDate: string | null = null;
          if (daysLimit && daysLimit > 0) {
            cumulativeDate += daysLimit * 86400000;
            dueDate = new Date(cumulativeDate).toISOString();
          }
          return {
            onboarding_id: onboarding.id,
            phase_key: ph.phase_key,
            phase_name: ph.phase_name,
            phase_order: ph.phase_order,
            parallel_group: ph.parallel_group || null,
            status: 'pendente',
            due_days_limit: daysLimit,
            due_date: dueDate,
          };
        });

        const { data: insertedPhases, error: phErr } = await (supabase as any)
          .from('onboarding_phases')
          .insert(phasesToInsert)
          .select();

        if (phErr) throw phErr;

        // 4. Buscar defaults de tempo/responsável
        const taskDefaults = await fetchTaskDefaults();

        // 5. Criar tasks para cada nova fase (com defaults herdados)
        const tasksToInsert: any[] = [];
        for (const phase of template.phases) {
          const dbPhase = (insertedPhases as OnboardingPhaseRow[]).find(
            (p) => p.phase_key === phase.phase_key
          );
          if (!dbPhase) continue;
          for (const task of phase.tasks) {
            const def = taskDefaults.get(task.task_key);
            tasksToInsert.push({
              phase_id: dbPhase.id,
              task_key: task.task_key,
              task_name: task.task_name,
              task_description: task.task_description || null,
              is_required: task.is_required,
              status: 'pendente',
              task_order: task.task_order,
              estimated_minutes: def?.estimated_minutes || null,
              assigned_to: def?.assigned_to || null,
            });
          }
        }

        if (tasksToInsert.length > 0) {
          const { error: tErr } = await (supabase as any)
            .from('onboarding_tasks')
            .insert(tasksToInsert);
          if (tErr) throw tErr;
        }

        // 5. Atualizar agency_clients.onboarding_type
        await (supabase as any)
          .from('agency_clients')
          .update({ onboarding_type: newType })
          .eq('id', clientId);

        // 6. Timeline event
        await addTimelineEvent(onboarding.id, 'status_changed', {
          from: onboarding.type,
          to: newType,
          message: `Tipo alterado: ${onboarding.type} → ${newType}`,
        });

        toast.success(`Tipo alterado para ${newType}`);
        await fetchOnboarding();
      } catch (err: any) {
        console.error('[useOnboarding] changeType error:', err);
        toast.error('Erro ao alterar tipo: ' + (err.message || ''));
      }
    },
    [onboarding, clientId, fetchOnboarding]
  );

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------
  return {
    onboarding,
    isLoading,
    error,
    // CRUD
    createOnboarding,
    changeOnboardingType,
    refetch: fetchOnboarding,
    // Task actions
    completeTask,
    uncheckTask,
    skipTask,
    // Phase actions
    startPhase,
    skipPhase,
    forceUnlockPhase,
    // Bulk actions
    completeAllTasks,
    uncheckAllTasks,
    // Onboarding status
    pauseOnboarding,
    resumeOnboarding,
    // Quick actions
    toggleWhatsapp,
    togglePortalAccess,
    // CRUD tasks/phases
    addCustomTask,
    deleteTask,
    updateTaskName,
    updateTaskEstimate,
    updateTaskAssignee,
    updatePhaseName,
    updatePhaseDaysLimit,
    // Timeline
    addNote,
    // Computed
    totalTasks,
    completedTasks,
    progress,
    // Helpers
    isPhaseUnlocked,
  };
}
