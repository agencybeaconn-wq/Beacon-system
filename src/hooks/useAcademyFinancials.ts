import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

export interface AcademyRevenue {
    id: string;
    workspace_id: string;
    description: string;
    client_name: string | null;
    amount: number;
    payment_method: 'pix' | 'cartao' | 'boleto' | 'transferencia' | 'dinheiro' | 'outro' | null;
    due_date: string;
    payment_date: string | null;
    status: 'pendente' | 'pago' | 'cancelado';
    category: 'curso' | 'mentoria' | 'material' | 'outro';
    month_reference: string;
    notes: string | null;
    created_at: string;
}

export interface AcademyExpense {
    id: string;
    workspace_id: string;
    description: string;
    amount: number;
    category: 'plataforma' | 'marketing' | 'professor' | 'material' | 'infraestrutura' | 'outro';
    recurrence_type: 'fixed' | 'variable';
    due_date: string;
    payment_date: string | null;
    status: 'pending' | 'paid';
    month_reference: string;
    notes: string | null;
    created_at: string;
}

export interface AcademyGoal {
    id: string;
    workspace_id: string;
    month_reference: string;
    goal_amount: number;
}

export interface AcademySummary {
    totalFaturado: number;
    totalRecebido: number;
    totalPendente: number;
    totalDespesas: number;
    totalDespesasPagas: number;
    lucro: number;
}

export function useAcademyFinancials() {
    const { workspaceId, getDateRangeForAPI } = useDashboard();
    const [isLoading, setIsLoading] = useState(true);
    const [revenues, setRevenues] = useState<AcademyRevenue[]>([]);
    const [expenses, setExpenses] = useState<AcademyExpense[]>([]);
    const [goal, setGoal] = useState<AcademyGoal | null>(null);

    const apiDates = useMemo(() => getDateRangeForAPI(), [getDateRangeForAPI]);

    const monthReference = useMemo(() => {
        try {
            const dateStr = apiDates.endDate.split(' ')[0];
            return dateStr.substring(0, 7);
        } catch {
            return format(new Date(), 'yyyy-MM');
        }
    }, [apiDates.endDate]);

    const fetchData = useCallback(async () => {
        if (!workspaceId) return;

        setIsLoading(true);
        try {
            const startDate = apiDates.startDate.split(' ')[0];
            const endDate = apiDates.endDate.split(' ')[0];

            const [revenueRes, expenseRes, goalRes] = await Promise.all([
                (supabase as any)
                    .from('academy_revenue')
                    .select('*')
                    .eq('workspace_id', workspaceId)
                    .gte('due_date', startDate)
                    .lte('due_date', endDate)
                    .order('due_date', { ascending: false }),
                (supabase as any)
                    .from('academy_expenses')
                    .select('*')
                    .eq('workspace_id', workspaceId)
                    .gte('due_date', startDate)
                    .lte('due_date', endDate)
                    .order('due_date', { ascending: false }),
                (supabase as any)
                    .from('academy_goals')
                    .select('*')
                    .eq('workspace_id', workspaceId)
                    .eq('month_reference', monthReference)
                    .maybeSingle()
            ]);

            // Código 42P01 = tabela não existe (migration ainda não aplicada).
            // Nesse caso tratamos como "sem dados" e não exibimos erro.
            const isMissingTable = (err: any) => err?.code === '42P01'
                || (typeof err?.message === 'string' && err.message.includes('does not exist'));

            if (revenueRes.error && !isMissingTable(revenueRes.error)) {
                console.warn('Academy revenue fetch error:', revenueRes.error);
            }
            if (expenseRes.error && !isMissingTable(expenseRes.error)) {
                console.warn('Academy expenses fetch error:', expenseRes.error);
            }
            if (goalRes.error && !isMissingTable(goalRes.error) && goalRes.error.code !== 'PGRST116') {
                console.warn('Academy goal fetch error:', goalRes.error);
            }

            setRevenues(revenueRes.error ? [] : (revenueRes.data || []));
            setExpenses(expenseRes.error ? [] : (expenseRes.data || []));
            setGoal(goalRes.error ? null : (goalRes.data || null));
        } catch (error) {
            // Falha de rede ou outro erro inesperado: estado vazio, sem toast.
            console.warn('Academy financials unexpected error:', error);
            setRevenues([]);
            setExpenses([]);
            setGoal(null);
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId, monthReference, apiDates]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const summary: AcademySummary = useMemo(() => {
        const safeRevenues = revenues || [];
        const safeExpenses = expenses || [];

        const totalFaturado = safeRevenues
            .filter(r => r.status !== 'cancelado')
            .reduce((acc, r) => acc + (r.amount || 0), 0);

        const totalRecebido = safeRevenues
            .filter(r => r.status === 'pago')
            .reduce((acc, r) => acc + (r.amount || 0), 0);

        const totalPendente = safeRevenues
            .filter(r => r.status === 'pendente')
            .reduce((acc, r) => acc + (r.amount || 0), 0);

        const totalDespesas = safeExpenses
            .reduce((acc, e) => acc + (e.amount || 0), 0);

        const totalDespesasPagas = safeExpenses
            .filter(e => e.status === 'paid')
            .reduce((acc, e) => acc + (e.amount || 0), 0);

        const lucro = totalRecebido - totalDespesasPagas;

        return { totalFaturado, totalRecebido, totalPendente, totalDespesas, totalDespesasPagas, lucro };
    }, [revenues, expenses]);

    // CRUD: Receitas
    const addRevenue = async (revenue: Omit<AcademyRevenue, 'id' | 'workspace_id' | 'created_at'>) => {
        if (!workspaceId) {
            toast.error('Nenhum workspace selecionado');
            return;
        }
        try {
            const { data, error } = await (supabase as any)
                .from('academy_revenue')
                .insert([{ ...revenue, workspace_id: workspaceId }])
                .select()
                .single();
            if (error) throw error;
            setRevenues(prev => [data, ...prev]);
            toast.success('Receita registrada com sucesso!');
            return data;
        } catch (error: any) {
            console.error('Erro ao adicionar receita:', error);
            toast.error('Erro ao registrar receita: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const updateRevenue = async (id: string, updates: Partial<AcademyRevenue>) => {
        try {
            const { data, error } = await (supabase as any)
                .from('academy_revenue')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            setRevenues(prev => prev.map(r => r.id === id ? data : r));
            toast.success('Receita atualizada');
            return data;
        } catch (error: any) {
            console.error('Erro ao atualizar receita:', error);
            toast.error('Erro ao atualizar receita');
        }
    };

    const deleteRevenue = async (id: string) => {
        try {
            const { error } = await (supabase as any)
                .from('academy_revenue')
                .delete()
                .eq('id', id);
            if (error) throw error;
            setRevenues(prev => prev.filter(r => r.id !== id));
            toast.success('Receita removida');
        } catch (error: any) {
            console.error('Erro ao remover receita:', error);
            toast.error('Erro ao remover receita');
        }
    };

    // CRUD: Despesas
    const addExpense = async (expense: Omit<AcademyExpense, 'id' | 'workspace_id' | 'created_at'>) => {
        if (!workspaceId) {
            toast.error('Nenhum workspace selecionado');
            return;
        }
        try {
            const { data, error } = await (supabase as any)
                .from('academy_expenses')
                .insert([{ ...expense, workspace_id: workspaceId }])
                .select()
                .single();
            if (error) throw error;
            setExpenses(prev => [data, ...prev]);
            toast.success('Despesa registrada com sucesso!');
            return data;
        } catch (error: any) {
            console.error('Erro ao adicionar despesa:', error);
            toast.error('Erro ao registrar despesa: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const updateExpense = async (id: string, updates: Partial<AcademyExpense>) => {
        try {
            const { data, error } = await (supabase as any)
                .from('academy_expenses')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            setExpenses(prev => prev.map(e => e.id === id ? data : e));
            toast.success('Despesa atualizada');
            return data;
        } catch (error: any) {
            console.error('Erro ao atualizar despesa:', error);
            toast.error('Erro ao atualizar despesa');
        }
    };

    const deleteExpense = async (id: string) => {
        try {
            const { error } = await (supabase as any)
                .from('academy_expenses')
                .delete()
                .eq('id', id);
            if (error) throw error;
            setExpenses(prev => prev.filter(e => e.id !== id));
            toast.success('Despesa removida');
        } catch (error: any) {
            console.error('Erro ao remover despesa:', error);
            toast.error('Erro ao remover despesa');
        }
    };

    // Meta mensal
    const updateGoal = async (amount: number) => {
        if (!workspaceId) return;
        try {
            const { data, error } = await (supabase as any)
                .from('academy_goals')
                .upsert({
                    workspace_id: workspaceId,
                    month_reference: monthReference,
                    goal_amount: amount
                }, { onConflict: 'workspace_id,month_reference' })
                .select()
                .single();
            if (error) throw error;
            setGoal(data);
            toast.success('Meta atualizada!');
            return data;
        } catch (error: any) {
            console.error('Erro ao atualizar meta:', error);
            toast.error('Erro ao atualizar meta');
        }
    };

    return {
        isLoading,
        revenues,
        expenses,
        goal,
        summary,
        monthReference,
        addRevenue,
        updateRevenue,
        deleteRevenue,
        addExpense,
        updateExpense,
        deleteExpense,
        updateGoal,
        refetch: fetchData
    };
}
