// =============================================================================
// TYPES: Sistema de Onboarding por Checklist
// =============================================================================

export type OnboardingType =
  | 'mrr_start'
  | 'mrr_growth'
  | 'avulso_tema'
  | 'avulso_reformulacao'
  | 'avulso_arte';

export type OnboardingStatus = 'pendente' | 'em_andamento' | 'concluido' | 'pausado';

export type PhaseStatus = 'pendente' | 'em_andamento' | 'concluido' | 'pulado';

export type TaskStatus = 'pendente' | 'concluido' | 'pulado' | 'bloqueado';

export type TimelineEventType =
  | 'phase_started'
  | 'phase_completed'
  | 'task_completed'
  | 'task_unchecked'
  | 'note_added'
  | 'briefing_sent'
  | 'briefing_completed'
  | 'whatsapp_created'
  | 'portal_granted'
  | 'meeting_scheduled'
  | 'status_changed';

// --- Database row types ---

export interface OnboardingRow {
  id: string;
  client_id: string;
  type: OnboardingType;
  status: OnboardingStatus;
  current_phase: string | null;
  started_at: string;
  completed_at: string | null;
  assigned_cs: string | null;
  assigned_designer: string | null;
  assigned_traffic: string | null;
  assigned_tech: string | null;
  whatsapp_group_created: boolean;
  portal_access_granted: boolean;
  briefing_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingPhaseRow {
  id: string;
  onboarding_id: string;
  phase_key: string;
  phase_name: string;
  phase_order: number;
  parallel_group: string | null;
  status: PhaseStatus;
  started_at: string | null;
  completed_at: string | null;
  due_date: string | null;
  due_days_limit: number | null;
  notes: string | null;
}

export interface OnboardingTaskRow {
  id: string;
  phase_id: string;
  task_key: string;
  task_name: string;
  task_description: string | null;
  is_required: boolean;
  status: TaskStatus;
  completed_by: string | null;
  completed_at: string | null;
  task_order: number;
  depends_on: string | null;
  estimated_minutes: number | null;
  assigned_to: string | null;
}

export interface OnboardingTimelineRow {
  id: string;
  onboarding_id: string;
  event_type: TimelineEventType;
  event_data: Record<string, any>;
  performed_by: string | null;
  created_at: string;
}

// --- Composite types (with nested data) ---

export interface OnboardingTaskWithPhase extends OnboardingTaskRow {
  phase_key: string;
  phase_name: string;
}

export interface OnboardingPhaseWithTasks extends OnboardingPhaseRow {
  tasks: OnboardingTaskRow[];
}

export interface OnboardingFull extends OnboardingRow {
  phases: OnboardingPhaseWithTasks[];
  timeline: OnboardingTimelineRow[];
}

// --- Template types (for generating onboarding from constants) ---

export interface TaskTemplate {
  task_key: string;
  task_name: string;
  task_description?: string;
  task_order: number;
  is_required: boolean;
}

export interface PhaseTemplate {
  phase_key: string;
  phase_name: string;
  phase_order: number;
  due_days_offset: number;
  parallel_group?: string;
  tasks: TaskTemplate[];
}

export interface OnboardingTemplate {
  template_key: OnboardingType;
  phases: PhaseTemplate[];
}

// --- UI labels ---

export const ONBOARDING_TYPE_LABELS: Record<OnboardingType, string> = {
  mrr_start: 'MRR Start',
  mrr_growth: 'MRR Growth',
  avulso_tema: 'Avulso — Tema',
  avulso_reformulacao: 'Avulso — Reformulação',
  avulso_arte: 'Avulso — Arte/Design',
};

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  pausado: 'Pausado',
};

export const PHASE_STATUS_LABELS: Record<PhaseStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  pulado: 'Pulado',
};

// --- Helper: which types require WhatsApp / Portal ---

export const REQUIRES_WHATSAPP: OnboardingType[] = [
  'mrr_start', 'mrr_growth', 'avulso_reformulacao'
];

export const REQUIRES_PORTAL: OnboardingType[] = [
  'mrr_start', 'mrr_growth'
];

export const REQUIRES_BRIEFING: OnboardingType[] = [
  'mrr_start', 'mrr_growth', 'avulso_reformulacao', 'avulso_arte'
];
