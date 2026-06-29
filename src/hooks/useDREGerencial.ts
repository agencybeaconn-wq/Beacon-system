/**
 * useDREGerencial — Cálculos da DRE Gerencial e Rentabilidade por Projeto
 *
 * Integra: folha de pagamento, custos fixos, horas do onboarding, faturamento.
 * Usa centavos (inteiros) internamente para evitar erros de ponto flutuante.
 */

import { useMemo, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MemberFinancial, FinancialExpense, ClientInvoice, PartnerProlabore } from './useFinancials';

// =============================================================================
// TYPES
// =============================================================================

export interface MemberHourlyRate {
  memberId: string;
  name: string;
  salary: number;       // R$ (reais)
  hourlyRate: number;   // R$ (reais) = salary / 160
}

export interface ProjectCost {
  clientId: string;
  clientName: string;
  contractValue: number;    // fee_fixed (R$)
  totalMinutes: number;     // total minutos estimados do onboarding
  totalHours: number;       // totalMinutes / 60
  executionCost: number;    // sum(horas_membro * valor_hora_membro)
  taxDeduction: number;     // contractValue * taxRate
  profit: number;           // contractValue - taxDeduction - executionCost
  margin: number;           // (profit / contractValue) * 100
}

export interface DREResult {
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  csp: number;              // Custo do Serviço Prestado
  margemContribuicao: number;
  despesasFixas: number;
  lucroOperacional: number;
  margemOperacional: number; // %
}

export interface DREGerencialData {
  taxRate: number;
  memberHourlyRates: MemberHourlyRate[];
  projectCosts: ProjectCost[];
  dre: DREResult;
  isLoading: boolean;
}

// Horas úteis por mês (padrão CLT)
const MONTHLY_HOURS = 160;

// =============================================================================
// HOOK
// =============================================================================

interface UseDREGerencialParams {
  clients: any[];
  staffFinancials: MemberFinancial[];
  expenses: FinancialExpense[];
  invoices: ClientInvoice[];
  partnersProlabore: PartnerProlabore[];
  salesTotal: number;       // vendas avulsas no período
  workspaceId: string | null;
  taxRate: number;          // ex: 0.06 para 6%
}

export function useDREGerencial({
  clients,
  staffFinancials,
  expenses,
  invoices,
  partnersProlabore,
  salesTotal,
  workspaceId,
  taxRate,
}: UseDREGerencialParams): DREGerencialData {

  // ---------------------------------------------------------------------------
  // Buscar horas do onboarding por membro por cliente
  // ---------------------------------------------------------------------------
  const [onboardingHours, setOnboardingHours] = useState<
    { client_id: string; assigned_to: string; total_minutes: number }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    const fetchHours = async () => {
      setIsLoading(true);
      try {
        // 1. Clientes do workspace
        const clientIds = clients.map((c: any) => c.id).filter(Boolean);
        if (clientIds.length === 0) { setIsLoading(false); return; }

        // 2. Onboardings desses clientes
        const { data: onbs } = await (supabase as any)
          .from('onboarding')
          .select('id, client_id')
          .in('client_id', clientIds);
        if (!onbs?.length) { setOnboardingHours([]); setIsLoading(false); return; }

        // 3. Fases desses onboardings
        const { data: phases } = await (supabase as any)
          .from('onboarding_phases')
          .select('id, onboarding_id')
          .in('onboarding_id', onbs.map((o: any) => o.id));
        if (!phases?.length) { setOnboardingHours([]); setIsLoading(false); return; }

        // 4. Tasks com horas e responsável
        const { data: tasks } = await (supabase as any)
          .from('onboarding_tasks')
          .select('phase_id, assigned_to, estimated_minutes')
          .in('phase_id', phases.map((p: any) => p.id))
          .not('estimated_minutes', 'is', null)
          .not('assigned_to', 'is', null);

        if (!tasks?.length) { setOnboardingHours([]); setIsLoading(false); return; }

        // 5. Mapear phase_id → onboarding_id → client_id
        const phaseToOnb = new Map(phases.map((p: any) => [p.id, p.onboarding_id]));
        const onbToClient = new Map(onbs.map((o: any) => [o.id, o.client_id]));

        // 6. Agregar: { client_id, assigned_to, total_minutes }
        const agg = new Map<string, number>();
        for (const t of tasks) {
          const onbId = phaseToOnb.get(t.phase_id);
          const clientId = onbId ? onbToClient.get(onbId) : null;
          if (!clientId || !t.assigned_to) continue;
          const key = `${clientId}|${t.assigned_to}`;
          agg.set(key, (agg.get(key) || 0) + (t.estimated_minutes || 0));
        }

        const result = Array.from(agg.entries()).map(([key, totalMinutes]) => {
          const [client_id, assigned_to] = key.split('|');
          return { client_id, assigned_to, total_minutes: totalMinutes };
        });

        setOnboardingHours(result);
      } catch (err) {
        console.error('[useDREGerencial] fetchHours error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHours();
  }, [workspaceId, clients.length]);

  // ---------------------------------------------------------------------------
  // Cálculos memoizados
  // ---------------------------------------------------------------------------
  const data = useMemo<Omit<DREGerencialData, 'isLoading'>>(() => {
    // 1. Valor-hora por membro
    const memberHourlyRates: MemberHourlyRate[] = staffFinancials
      .filter(m => m.base_salary > 0)
      .map(m => ({
        memberId: m.id,
        name: m.email?.split('@')[0] || 'Membro',
        salary: m.base_salary,
        hourlyRate: Math.round((m.base_salary / MONTHLY_HOURS) * 100) / 100,
      }));

    // Incluir pró-labores como "membros" para custo-hora
    const partnerRates: MemberHourlyRate[] = partnersProlabore
      .filter(p => p.status === 'active' && p.amount > 0)
      .map(p => ({
        memberId: p.id,
        name: p.name,
        salary: p.amount,
        hourlyRate: Math.round((p.amount / MONTHLY_HOURS) * 100) / 100,
      }));

    const allRates = [...memberHourlyRates, ...partnerRates];
    const rateMap = new Map(allRates.map(r => [r.memberId, r.hourlyRate]));

    // 2. Custo por projeto
    const clientMap = new Map(clients.map((c: any) => [c.id, c]));
    const projectCostsMap = new Map<string, { totalMinutes: number; executionCost: number }>();

    for (const h of onboardingHours) {
      const hourlyRate = rateMap.get(h.assigned_to) || 0;
      const hours = h.total_minutes / 60;
      const cost = hours * hourlyRate;

      const prev = projectCostsMap.get(h.client_id) || { totalMinutes: 0, executionCost: 0 };
      prev.totalMinutes += h.total_minutes;
      prev.executionCost += cost;
      projectCostsMap.set(h.client_id, prev);
    }

    const projectCosts: ProjectCost[] = clients
      .filter((c: any) => c.fee_fixed > 0 || projectCostsMap.has(c.id))
      .map((c: any) => {
        const contractValue = c.fee_fixed || 0;
        const data = projectCostsMap.get(c.id) || { totalMinutes: 0, executionCost: 0 };
        const totalHours = Math.round((data.totalMinutes / 60) * 10) / 10;
        const executionCost = Math.round(data.executionCost * 100) / 100;
        const taxDeduction = Math.round(contractValue * taxRate * 100) / 100;
        const profit = Math.round((contractValue - taxDeduction - executionCost) * 100) / 100;
        const margin = contractValue > 0 ? Math.round((profit / contractValue) * 1000) / 10 : 0;

        return {
          clientId: c.id,
          clientName: c.name || 'Cliente',
          contractValue,
          totalMinutes: data.totalMinutes,
          totalHours,
          executionCost,
          taxDeduction,
          profit,
          margin,
        };
      })
      .sort((a, b) => b.contractValue - a.contractValue);

    // 3. DRE Mensal
    const mrr = clients.reduce((acc: number, c: any) => acc + (c.fee_fixed || 0), 0);
    const receitaBruta = mrr + salesTotal;
    const deducoes = Math.round(receitaBruta * taxRate * 100) / 100;
    const receitaLiquida = receitaBruta - deducoes;

    // CSP = soma custos de execução de todos os projetos + despesas variáveis
    const totalExecutionCost = projectCosts.reduce((acc, p) => acc + p.executionCost, 0);
    const variableExpenses = expenses
      .filter(e => e.recurrence_type === 'variable')
      .reduce((acc, e) => acc + (e.amount || 0), 0);
    const csp = Math.round((totalExecutionCost + variableExpenses) * 100) / 100;

    const margemContribuicao = receitaLiquida - csp;

    // Despesas fixas = salários + pró-labores + despesas fixas registradas
    const totalSalaries = staffFinancials.reduce((acc, m) => acc + (m.base_salary || 0), 0);
    const totalProlabore = partnersProlabore
      .filter(p => p.status === 'active')
      .reduce((acc, p) => acc + (p.amount || 0), 0);
    const fixedExpenses = expenses
      .filter(e => e.recurrence_type === 'fixed')
      .reduce((acc, e) => acc + (e.amount || 0), 0);
    const despesasFixas = totalSalaries + totalProlabore + fixedExpenses;

    const lucroOperacional = margemContribuicao - despesasFixas;
    const margemOperacional = receitaBruta > 0
      ? Math.round((lucroOperacional / receitaBruta) * 1000) / 10
      : 0;

    return {
      taxRate,
      memberHourlyRates: allRates,
      projectCosts,
      dre: {
        receitaBruta,
        deducoes,
        receitaLiquida,
        csp,
        margemContribuicao,
        despesasFixas,
        lucroOperacional,
        margemOperacional,
      },
    };
  }, [clients, staffFinancials, expenses, partnersProlabore, onboardingHours, salesTotal, taxRate]);

  return { ...data, isLoading };
}
