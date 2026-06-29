import { supabase } from '@/integrations/supabase/client';
import type { OnboardingPhaseRow, OnboardingTaskRow } from '@/types/onboarding';

export interface OnboardingSummary {
  clientId: string;
  onboardingId: string;
  onboardingType: string;
  onboardingStatus: string;
  currentPhaseName: string | null;
  currentPhaseKey: string | null;
  currentPhaseDueDate: string | null;
  totalPhases: number;
  completedPhases: number;
  totalTasks: number;
  completedTasks: number;
  progress: number;
}

/**
 * Busca resumo de onboarding para múltiplos clientes em 3 queries batch.
 * Retorna Map<clientId, OnboardingSummary>.
 */
export async function fetchBatchOnboardingSummary(
  clientIds: string[]
): Promise<Map<string, OnboardingSummary>> {
  const result = new Map<string, OnboardingSummary>();

  if (!clientIds.length) return result;

  // 1. Buscar onboarding de todos os clientes
  const { data: onboardings, error: onbErr } = await (supabase as any)
    .from('onboarding')
    .select('id, client_id, type, status, current_phase')
    .in('client_id', clientIds);

  if (onbErr || !onboardings?.length) return result;

  const onbMap = new Map<string, any>();
  const onbIds: string[] = [];
  for (const onb of onboardings) {
    onbMap.set(onb.id, onb);
    onbIds.push(onb.id);
  }

  // 2. Buscar todas as fases
  const { data: phases, error: phErr } = await (supabase as any)
    .from('onboarding_phases')
    .select('id, onboarding_id, phase_key, phase_name, phase_order, status, due_date')
    .in('onboarding_id', onbIds)
    .order('phase_order', { ascending: true });

  if (phErr || !phases?.length) {
    // Retorna dados básicos sem fases
    for (const onb of onboardings) {
      result.set(onb.client_id, {
        clientId: onb.client_id,
        onboardingId: onb.id,
        onboardingType: onb.type,
        onboardingStatus: onb.status,
        currentPhaseName: null,
        currentPhaseKey: null,
        currentPhaseDueDate: null,
        totalPhases: 0,
        completedPhases: 0,
        totalTasks: 0,
        completedTasks: 0,
        progress: 0,
      });
    }
    return result;
  }

  // Agrupar fases por onboarding_id
  const phasesByOnb = new Map<string, OnboardingPhaseRow[]>();
  const allPhaseIds: string[] = [];
  for (const phase of phases) {
    const list = phasesByOnb.get(phase.onboarding_id) || [];
    list.push(phase);
    phasesByOnb.set(phase.onboarding_id, list);
    allPhaseIds.push(phase.id);
  }

  // 3. Buscar todas as tarefas
  let tasksByPhase = new Map<string, OnboardingTaskRow[]>();

  if (allPhaseIds.length > 0) {
    const { data: tasks, error: tErr } = await (supabase as any)
      .from('onboarding_tasks')
      .select('id, phase_id, status')
      .in('phase_id', allPhaseIds);

    if (!tErr && tasks?.length) {
      for (const task of tasks) {
        const list = tasksByPhase.get(task.phase_id) || [];
        list.push(task);
        tasksByPhase.set(task.phase_id, list);
      }
    }
  }

  // 4. Montar resumo por cliente
  for (const onb of onboardings) {
    const onbPhases = phasesByOnb.get(onb.id) || [];
    const completedPhases = onbPhases.filter((p: any) => p.status === 'concluido').length;

    // Fase atual: primeira em_andamento, ou primeira pendente
    const currentPhase =
      onbPhases.find((p: any) => p.status === 'em_andamento') ||
      onbPhases.find((p: any) => p.status === 'pendente') ||
      null;

    // Contagem de tarefas
    let totalTasks = 0;
    let completedTasks = 0;
    for (const phase of onbPhases) {
      const phaseTasks = tasksByPhase.get(phase.id) || [];
      totalTasks += phaseTasks.length;
      completedTasks += phaseTasks.filter((t: any) => t.status === 'concluido').length;
    }

    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    result.set(onb.client_id, {
      clientId: onb.client_id,
      onboardingId: onb.id,
      onboardingType: onb.type,
      onboardingStatus: onb.status,
      currentPhaseName: currentPhase?.phase_name || null,
      currentPhaseKey: currentPhase?.phase_key || null,
      currentPhaseDueDate: currentPhase?.due_date || null,
      totalPhases: onbPhases.length,
      completedPhases,
      totalTasks,
      completedTasks,
      progress,
    });
  }

  return result;
}
