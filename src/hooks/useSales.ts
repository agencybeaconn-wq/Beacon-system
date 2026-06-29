import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

export interface SaleRecord {
    id: string;
    workspace_id: string;
    client_name: string;
    service: string | null;
    sale_date: string;
    total_amount: number;
    payment_method: 'pix' | 'cartao' | 'boleto' | 'transferencia' | 'dinheiro' | 'outro';
    entry_type: 'percentage' | 'fixed';
    entry_amount: number;
    balance_due_date: string | null;
    status: 'pendente' | 'parcial' | 'pago';
    notes: string | null;
    recurrence?: 'one_off' | 'recurring';
    created_at: string;
}

export interface SalesGoal {
    id: string;
    workspace_id: string;
    month_reference: string;
    goal_amount: number;
}

export interface SalesSummary {
    totalInvoiced: number; // Cash Flow (One-offs)
    totalSold: number;     // Volume (All Sales)
    totalReceived: number;
    totalPending: number;
    goalAmount: number;
    goalPercentage: number;
    remainingToGoal: number;
    isAboveGoal: boolean;
}

export function useSales() {
    const { workspaceId, getDateRangeForAPI } = useDashboard();
    const [isLoading, setIsLoading] = useState(true);
    const [sales, setSales] = useState<SaleRecord[]>([]);
    const [allMonthSales, setAllMonthSales] = useState<SaleRecord[]>([]);
    const [goal, setGoal] = useState<SalesGoal | null>(null);

    const apiDates = useMemo(() => getDateRangeForAPI(), [getDateRangeForAPI]);

    // monthReference: usa endDate para garantir que "7d" em abril mostra abril
    const monthReference = useMemo(() => {
        try {
            const dateStr = apiDates.endDate.split(' ')[0]; // 'YYYY-MM-DD'
            return dateStr.substring(0, 7); // 'YYYY-MM'
        } catch {
            return format(new Date(), 'yyyy-MM');
        }
    }, [apiDates.endDate]);

    const fetchData = useCallback(async () => {
        if (!workspaceId) return;

        setIsLoading(true);
        try {
            // 1. Fetch sales for the SPECIFIC selected date range (for the table list)
            const startDate = apiDates.startDate.split(' ')[0]; // 'YYYY-MM-DD'
            const endDate = apiDates.endDate.split(' ')[0];
            const { data: salesData, error: salesError } = await supabase
                .from('sales_records')
                .select('*')
                .eq('workspace_id', workspaceId)
                .gte('sale_date', startDate)
                .lte('sale_date', endDate)
                .order('sale_date', { ascending: false });

            if (salesError) throw salesError;
            setSales(salesData || []);

            // 2. Fetch ALL sales for the FULL MONTH (for the progress bar)
            // monthReference is YYYY-MM
            const monthStart = `${monthReference}-01`;
            const monthEnd = format(new Date(parseInt(monthReference.split('-')[0]), parseInt(monthReference.split('-')[1]), 0), 'yyyy-MM-dd');

            const { data: monthlyData, error: monthlyError } = await supabase
                .from('sales_records')
                .select('*')
                .eq('workspace_id', workspaceId)
                .gte('sale_date', monthStart)
                .lte('sale_date', monthEnd);

            if (monthlyError) throw monthlyError;
            setAllMonthSales(monthlyData || []);

            // 3. Fetch goal for current month
            const { data: goalData, error: goalError } = await supabase
                .from('sales_goals')
                .select('*')
                .eq('workspace_id', workspaceId)
                .eq('month_reference', monthReference)
                .single();

            if (goalError && goalError.code !== 'PGRST116') throw goalError;
            setGoal(goalData || null);

        } catch (error) {
            console.error('Error fetching sales data:', error);
            toast.error('Erro ao carregar dados de vendas');
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId, monthReference, apiDates]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const monthlySummary: SalesSummary = useMemo(() => {
        // IMPORTANT: Progress Bar uses allMonthSales (full month context)
        const safeSales = allMonthSales || [];

        // Total Sold (Volume) = Sum of ALL sales (One-off + Recurring)
        const totalSold = safeSales.reduce((acc, s) => acc + (s.total_amount || 0), 0);

        // Total Invoiced (Cash Flow) = Sum of ONLY One-off sales
        // Recurring sales will be tracked via Client MRR
        const totalInvoiced = safeSales
            .filter(s => s.recurrence !== 'recurring')
            .reduce((acc, s) => acc + (s.total_amount || 0), 0);

        const totalReceived = safeSales.reduce((acc, s) => {
            if (s.status === 'pago') return acc + (s.total_amount || 0);
            if (s.status === 'parcial') return acc + (s.entry_amount || 0);
            return acc;
        }, 0);

        const totalPending = safeSales.reduce((acc, s) => {
            const amount = s.total_amount || 0;
            const received = s.status === 'parcial' ? (s.entry_amount || 0) : 0;

            if (s.status === 'pendente') return acc + amount;
            if (s.status === 'parcial') return acc + (amount - received);
            return acc;
        }, 0);

        const goalAmount = goal?.goal_amount || 0;
        const goalPercentage = goalAmount > 0 ? (totalSold / goalAmount) * 100 : 0;
        const remainingToGoal = Math.max(0, goalAmount - totalSold);
        const isAboveGoal = totalSold >= goalAmount;

        return {
            totalInvoiced,
            totalSold,
            totalReceived,
            totalPending,
            goalAmount,
            goalPercentage,
            remainingToGoal,
            isAboveGoal
        };
    }, [allMonthSales, goal]);

    const filteredSummary: SalesSummary = useMemo(() => {
        // IMPORTANT: Cards use filtered sales based on dateFilter
        const safeSales = sales || [];
        const totalSold = safeSales.reduce((acc, s) => acc + (s.total_amount || 0), 0);
        const totalInvoiced = safeSales
            .filter(s => s.recurrence !== 'recurring')
            .reduce((acc, s) => acc + (s.total_amount || 0), 0);
        const totalReceived = safeSales.reduce((acc, s) => {
            if (s.status === 'pago') return acc + (s.total_amount || 0);
            if (s.status === 'parcial') return acc + (s.entry_amount || 0);
            return acc;
        }, 0);
        const totalPending = safeSales.reduce((acc, s) => {
            const amount = s.total_amount || 0;
            const received = s.status === 'parcial' ? (s.entry_amount || 0) : 0;
            if (s.status === 'pendente') return acc + amount;
            if (s.status === 'parcial') return acc + (amount - received);
            return acc;
        }, 0);

        return {
            totalInvoiced,
            totalSold,
            totalReceived,
            totalPending,
            goalAmount: goal?.goal_amount || 0,
            goalPercentage: 0,
            remainingToGoal: 0,
            isAboveGoal: false
        };
    }, [sales, goal]);

    const addSale = async (sale: Omit<SaleRecord, 'id' | 'workspace_id' | 'created_at'>) => {
        if (!workspaceId) {
            toast.error('Erro: Nenhum workspace selecionado');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('sales_records')
                .insert([{ ...sale, workspace_id: workspaceId }])
                .select()
                .single();

            if (error) throw error;
            setSales(prev => [data, ...prev]);
            toast.success('Venda registrada com sucesso!');
            return data;
        } catch (error: any) {
            console.error('Error adding sale:', error);
            toast.error('Erro ao registrar venda: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const updateSale = async (id: string, updates: Partial<SaleRecord>) => {
        try {
            const { data, error } = await supabase
                .from('sales_records')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            setSales(prev => prev.map(s => s.id === id ? data : s));
            toast.success('Venda atualizada');
            return data;
        } catch (error: any) {
            console.error('Error updating sale:', error);
            toast.error('Erro ao atualizar venda');
        }
    };

    const deleteSale = async (id: string) => {
        try {
            const { error } = await supabase
                .from('sales_records')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setSales(prev => prev.filter(s => s.id !== id));
            toast.success('Venda removida');
        } catch (error: any) {
            console.error('Error deleting sale:', error);
            toast.error('Erro ao remover venda');
        }
    };

    const updateGoal = async (amount: number) => {
        if (!workspaceId) return;

        try {
            const { data, error } = await supabase
                .from('sales_goals')
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
            console.error('Error updating goal:', error);
            toast.error('Erro ao atualizar meta');
        }
    };

    return {
        isLoading,
        sales,
        goal,
        summary: monthlySummary,
        monthlySummary,
        filteredSummary,
        monthReference,
        addSale,
        updateSale,
        deleteSale,
        updateGoal,
        refetch: fetchData
    };
}
