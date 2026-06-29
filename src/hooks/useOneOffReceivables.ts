import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { toast } from 'sonner';

export interface OneOffReceivable {
    id: string;
    workspace_id: string;
    client_name: string;
    service: string;
    amount: number;
    payment_method: string | null;
    due_date: string;
    status: 'pending' | 'paid' | 'parcial';
    entry_amount?: number;
    balance_due_date?: string | null;
    created_at: string;
    updated_at: string;
}

export function useOneOffReceivables() {
    const { workspaceId } = useDashboard();
    const [isLoading, setIsLoading] = useState(true);
    const [receivables, setReceivables] = useState<OneOffReceivable[]>([]);

    const fetchData = useCallback(async () => {
        if (!workspaceId) return;

        setIsLoading(true);
        try {
            // Fetch explicit one-off receivables
            const { data: receivablesData, error: recError } = await (supabase as any)
                .from('one_off_receivables')
                .select('*')
                .eq('workspace_id', workspaceId);

            if (recError) throw recError;

            // Fetch sales marked as one-off
            const { data: salesData, error: salesError } = await (supabase as any)
                .from('sales_records')
                .select('*')
                .eq('workspace_id', workspaceId)
                .eq('recurrence', 'one_off');

            if (salesError) throw salesError;

            // Normalize sales data to match OneOffReceivable format
            const mappedSales: OneOffReceivable[] = (salesData || []).map((sale: any) => ({
                id: `sale_${sale.id}`, // prefix to avoid collisions
                workspace_id: sale.workspace_id,
                client_name: sale.client_name,
                service: sale.service || "Venda Avulsa",
                amount: sale.total_amount,
                payment_method: sale.payment_method,
                due_date: sale.sale_date, // use sale_date as due_date
                status: sale.status,
                entry_amount: sale.entry_amount,
                balance_due_date: sale.balance_due_date,
                created_at: sale.created_at,
                updated_at: sale.created_at, // sales don't track update time currently
                _is_sale_record: true // internal flag just in case
            }));

            // Combine and sort by due_date
            const combined = [...(receivablesData || []), ...mappedSales];
            combined.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

            setReceivables(combined);
        } catch (error: any) {
            console.error('Error fetching one-off receivables:', error);
            toast.error('Erro ao carregar recebíveis avulsos');
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const addReceivable = async (receivable: Omit<OneOffReceivable, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>) => {
        if (!workspaceId) return;

        try {
            const { data, error } = await (supabase as any)
                .from('one_off_receivables')
                .insert([{ ...receivable, workspace_id: workspaceId }])
                .select()
                .single();

            if (error) throw error;
            setReceivables(prev => [...prev, data]);
            toast.success('Recebível registrado');
            return data;
        } catch (error: any) {
            console.error('Error adding receivable:', error);
            toast.error('Erro ao registrar recebível');
        }
    };

    const updateReceivable = async (id: string, updates: Partial<OneOffReceivable>) => {
        try {
            const isSaleRecord = id.startsWith('sale_');
            const actualId = isSaleRecord ? id.replace('sale_', '') : id;
            const tableName = isSaleRecord ? 'sales_records' : 'one_off_receivables';

            let dbUpdates: any = { ...updates };
            if (isSaleRecord) {
                // Map fields if necessary
                if (updates.due_date !== undefined) dbUpdates.sale_date = updates.due_date;
                if (updates.amount !== undefined) dbUpdates.total_amount = updates.amount;
                delete dbUpdates.due_date;
                delete dbUpdates.amount;
                delete dbUpdates._is_sale_record;
            }

            const { data, error } = await (supabase as any)
                .from(tableName)
                .update(dbUpdates)
                .eq('id', actualId)
                .select()
                .single();

            if (error) throw error;

            // Re-fetch to normalize the data properly instead of manually modifying the local state array
            // This is safer since we have logic to map fields now.
            await fetchData();

            toast.success('Registro atualizado');
            return data;
        } catch (error: any) {
            console.error('Error updating receivable:', error);
            toast.error('Erro ao atualizar registro');
        }
    };

    const deleteReceivable = async (id: string) => {
        try {
            const isSaleRecord = id.startsWith('sale_');
            const actualId = isSaleRecord ? id.replace('sale_', '') : id;
            const tableName = isSaleRecord ? 'sales_records' : 'one_off_receivables';

            const { error } = await (supabase as any)
                .from(tableName)
                .delete()
                .eq('id', actualId);

            if (error) throw error;
            setReceivables(prev => prev.filter(r => r.id !== id));
            toast.success('Registro removido');
        } catch (error: any) {
            console.error('Error deleting receivable:', error);
            toast.error('Erro ao remover registro');
        }
    };

    const summary = useMemo(() => {
        // Total que ainda falta receber
        const totalPending = receivables.reduce((acc, r) => {
            if (r.status === 'paid') return acc;
            if (r.status === 'parcial') {
                const remaining = (r.amount || 0) - (r.entry_amount || 0);
                return acc + Math.max(0, remaining);
            }
            return acc + (r.amount || 0);
        }, 0);

        // Total que já entrou no caixa
        const totalReceived = receivables.reduce((acc, r) => {
            if (r.status === 'paid') return acc + (r.amount || 0);
            if (r.status === 'parcial') return acc + (r.entry_amount || 0);
            return acc;
        }, 0);

        const totalInvoiced = receivables.reduce((acc, r) => acc + (r.amount || 0), 0);

        return { totalPending, totalPaid: totalReceived, totalInvoiced, totalReceived };
    }, [receivables]);

    return {
        isLoading,
        receivables,
        summary,
        addReceivable,
        updateReceivable,
        deleteReceivable,
        refetch: fetchData
    };
}

