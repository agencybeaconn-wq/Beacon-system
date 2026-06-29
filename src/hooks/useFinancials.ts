import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';
import { useClientMetrics } from './useClientMetrics';
import { useCartPandaOrders } from './useCartPandaOrders';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { toast } from 'sonner';

export interface FinancialExpense {
    id: string;
    description: string;
    amount: number;
    category: 'staff' | 'tool' | 'other';
    status: 'pending' | 'paid';
    recurrence_type: 'fixed' | 'variable';
    due_date: string;
    payment_date: string | null;
}

export interface ClientInvoice {
    id: string;
    client_id: string;
    client_name?: string;
    amount: number;
    status: 'pending' | 'paid' | 'overdue';
    due_date: string;
    payment_date: string | null;
    month_reference: string;
}

export interface PartnerProlabore {
    id: string;
    workspace_id: string;
    name: string;
    amount: number;
    payment_day: number;
    commission_percent: number;
    pix_key: string | null;
    status: 'active' | 'inactive';
}

export interface ClientFinancialRow {
    clientId: string;
    clientName: string;
    cartPandaRevenue: number;
    metaSpend: number;
    operatingProfit: number;
    fixedFee: number;
    commissionRate: number;
    calculatedFee: number;
    invoiceStatus: 'pending' | 'paid' | 'overdue' | 'not_generated';
    invoiceId?: string;
    dueDate?: string;
}

export interface MemberFinancial {
    id: string;
    email: string;
    role: string;
    base_salary: number;
    commission_rate: number;
    pix_key: string | null;
    commissions: {
        client_id: string;
        rate: number;
    }[];
}

export function useFinancials() {
    const { dateFilter, getDateRangeForAPI, selectedClientId, viewMode, workspaceId, clients } = useDashboard();
    const [isLoading, setIsLoading] = useState(true);
    const [expenses, setExpenses] = useState<FinancialExpense[]>([]);
    const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
    const [staffFinancials, setStaffFinancials] = useState<MemberFinancial[]>([]);
    const [partnersProlabore, setPartnersProlabore] = useState<PartnerProlabore[]>([]);

    const apiDates = useMemo(() => getDateRangeForAPI(), [getDateRangeForAPI]);

    // monthReference: usa o endDate do filtro para determinar o mês de referência
    // Isso garante que "7d" em abril mostra abril, não março
    const monthReference = useMemo(() => {
        try {
            const dateStr = apiDates.endDate || new Date().toISOString();
            const cleanDateStr = dateStr.includes(' ') && !dateStr.includes('T')
                ? dateStr.replace(' ', 'T')
                : dateStr;
            const parsed = parseISO(cleanDateStr);
            if (isNaN(parsed.getTime())) {
                return format(new Date(), 'yyyy-MM');
            }
            return format(parsed, 'yyyy-MM');
        } catch (e) {
            return format(new Date(), 'yyyy-MM');
        }
    }, [apiDates.endDate]);

    // Automated invoice generation logic
    const checkAndGenerateInvoices = useCallback(async (currentClients: any[]) => {
        if (!currentClients || currentClients.length === 0) return;

        try {
            // 1. Fetch current invoices for this month to avoid duplicates
            const { data: existingInvoices } = await supabase
                .from('client_invoices')
                .select('client_id')
                .eq('month_reference', monthReference);

            const existingClientIds = new Set((existingInvoices || []).map((i: any) => i.client_id));
            const clientsToProcess = currentClients.filter((c: any) => !existingClientIds.has(c.id));

            if (clientsToProcess.length === 0) return;

            console.log('[useFinancials] Checking invoices for:', clientsToProcess.length, 'clients');

            const results = [];
            for (const client of clientsToProcess) {
                // Determine due date based on client settings or default to day 5
                const dueDay = client.payment_due_day || 5;
                const referenceDate = parseISO(monthReference + "-01");
                const dueDate = format(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), dueDay), 'yyyy-MM-dd');

                // For initial creation, we use the Fixed Fee as the base.
                // Logic can be extended to verify sales, but typically base fee is known.
                // If it's pure performance, initial amount might be 0 or pending calculation.
                const fixedFee = client.fee_fixed || 0;

                // We default to fixed fee. If 0 (pure performance), we might skip or create with 0.
                // Assuming we want to create the record to track it.
                const amount = fixedFee;

                if (amount > 0 || client.recurrence_type === 'variable') {
                    const { data: newInvoice, error } = await supabase
                        .from('client_invoices')
                        .insert({
                            client_id: client.id,
                            amount,
                            due_date: dueDate,
                            month_reference: monthReference,
                            status: 'pending'
                        })
                        .select()
                        .single();

                    if (!error && newInvoice) {
                        results.push({
                            ...newInvoice,
                            client_name: client.name
                        });
                    }
                }
            }

            if (results.length > 0) {
                setInvoices(prev => [...prev, ...results]);
                console.log(`[useFinancials] Automatically generated ${results.length} invoices.`);
                // Verify if we need to notify user or keep it silent
                toast.success(`${results.length} faturas geradas automaticamente para este mês.`);
            }
        } catch (error) {
            console.error('Error in auto-invoice generation:', error);
        }
    }, [monthReference]);

    const fetchData = useCallback(async () => {
        if (!workspaceId) return;
        setIsLoading(true);
        console.log('[useFinancials] Starting fetchData for month:', monthReference);

        try {
            // 1. Fetch Agency Expenses (sem filtro de data — despesas são fixas/recorrentes)
            try {
                const { data: expensesData, error: expensesError } = await supabase
                    .from('agency_expenses')
                    .select('*')
                    .eq('workspace_id', workspaceId)
                    .order('due_date', { ascending: true });
                if (expensesError) throw expensesError;
                setExpenses(expensesData || []);
            } catch (e) {
                console.error('[useFinancials] Error fetching expenses:', e);
            }

            // 2. Fetch Client Invoices
            try {
                const { data: invoicesData, error: invoicesError } = await supabase
                    .from('client_invoices')
                    .select(`
                        *,
                        agency_clients (
                            name
                        )
                    `)
                    .eq('month_reference', monthReference)
                    .order('due_date', { ascending: true });

                if (invoicesError) throw invoicesError;

                const formattedInvoices = (invoicesData || []).map((inv: any) => ({
                    ...inv,
                    client_name: inv.agency_clients?.name || 'Cliente Removido'
                }));
                setInvoices(formattedInvoices);
            } catch (e) {
                console.error('[useFinancials] Error fetching invoices:', e);
            }

            // 3. Trigger Auto-Invoice Check
            if (clients && clients.length > 0) {
                await checkAndGenerateInvoices(clients).catch(e => console.error('[useFinancials] Error auto-invoicing:', e));
            }

            // 5. Fetch Staff Financials
            try {
                // Try with is_accounting_staff column first
                let membersData: any[] | null = null;
                let membersError: any = null;

                const result1 = await supabase
                    .from('team_members')
                    .select('id, email, name, role, base_salary, commission_rate, pix_key')
                    .eq('workspace_id', workspaceId)
                    .eq('is_accounting_staff' as any, true);

                if (result1.error) {
                    // Column might not exist — fallback: fetch members that have financial data
                    console.warn('[useFinancials] is_accounting_staff column may not exist, using fallback query');
                    const result2 = await supabase
                        .from('team_members')
                        .select('id, email, name, role, base_salary, commission_rate, pix_key')
                        .eq('workspace_id', workspaceId)
                        .or('base_salary.gt.0,commission_rate.gt.0');

                    membersData = result2.data;
                    membersError = result2.error;
                } else {
                    membersData = result1.data;
                    membersError = result1.error;
                }

                if (membersError) throw membersError;

                if (membersData && membersData.length > 0) {
                    const memberIds = membersData.map((m: any) => m.id);
                    const { data: commissionsData, error: commissionsError } = await supabase
                        .from('member_commissions')
                        .select('*')
                        .in('member_id', memberIds);

                    if (commissionsError) throw commissionsError;

                    const staffWithCommissions = membersData.map((m: any) => ({
                        ...m,
                        commissions: (commissionsData || []).filter((c: any) => c.member_id === m.id)
                    }));
                    setStaffFinancials(staffWithCommissions);
                } else {
                    setStaffFinancials([]);
                }
            } catch (e) {
                console.error('[useFinancials] Error fetching staff:', e);
            }

            // 6. Fetch Partner Pro-labore
            try {
                const { data: partnersData, error: partnersError } = await supabase
                    .from('partners_prolabore' as any)
                    .select('*')
                    .eq('workspace_id', workspaceId)
                    .eq('status', 'active');

                if (partnersError) throw partnersError;
                setPartnersProlabore(partnersData || []);
            } catch (e) {
                console.error('[useFinancials] Error fetching partners:', e);
                // We don't throw here to allow the rest of the page to work
            }

        } catch (error) {
            console.error('[useFinancials] Global error fetching financial data:', error);
            toast.error('Erro ao carregar alguns dados financeiros');
        } finally {
            setIsLoading(false);
        }
    }, [monthReference, workspaceId, checkAndGenerateInvoices, clients, apiDates]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const createInvoice = async (clientId: string, amount: number, dueDate: string) => {
        try {
            const { data, error } = await supabase
                .from('client_invoices')
                .insert({
                    client_id: clientId,
                    amount,
                    due_date: dueDate,
                    month_reference: monthReference,
                    status: 'pending'
                })
                .select()
                .single();

            if (error) throw error;
            setInvoices(prev => [...prev, data]);
            toast.success('Fatura gerada com sucesso');
            return data;
        } catch (error: any) {
            console.error('Error creating invoice:', error);
            toast.error('Erro ao gerar fatura: ' + error.message);
        }
    };

    const updateInvoiceStatus = async (id: string, status: 'paid' | 'pending', paymentDate?: string) => {
        try {
            const { data, error } = await supabase
                .from('client_invoices')
                .update({
                    status,
                    payment_date: status === 'paid' ? (paymentDate || new Date().toISOString()) : null
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            setInvoices(prev => prev.map(inv => inv.id === id ? data : inv));
            toast.success('Status da fatura atualizado');
        } catch (error: any) {
            console.error('Error updating invoice:', error);
            toast.error('Erro ao atualizar fatura');
        }
    };

    const addExpense = async (expense: Omit<FinancialExpense, 'id'>) => {
        if (!workspaceId) {
            toast.error('Erro: Nenhum workspace selecionado');
            return;
        }

        try {
            console.log('[useFinancials] Adding expense:', { ...expense, workspace_id: workspaceId });
            const { error } = await supabase
                .from('agency_expenses')
                .insert([{ ...expense, workspace_id: workspaceId }]);

            if (error) {
                console.error('[useFinancials] Error adding expense:', error);
                throw error;
            }

            // Refresh local state
            await fetchData();
            toast.success('Despesa adicionada');
        } catch (error: any) {
            console.error('[useFinancials] Exception adding expense:', error);
            toast.error('Erro ao adicionar despesa: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const updateExpenseStatus = async (id: string, status: 'paid' | 'pending') => {
        try {
            const { data, error } = await supabase
                .from('agency_expenses')
                .update({
                    status,
                    payment_date: status === 'paid' ? new Date().toISOString() : null
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            setExpenses(prev => prev.map(e => e.id === id ? data : e));
            toast.success('Status da despesa atualizado');
        } catch (error) {
            console.error('Error updating expense status:', error);
            toast.error('Erro ao atualizar status da despesa');
        }
    };

    const deleteExpense = async (id: string) => {
        try {
            const { error } = await supabase
                .from('agency_expenses')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setExpenses(prev => prev.filter(e => e.id !== id));
            toast.success('Despesa removida');
        } catch (error) {
            console.error('Error deleting expense:', error);
            toast.error('Erro ao remover despesa');
        }
    };

    const updateMemberCommission = async (memberId: string, clientId: string, rate: number) => {
        try {
            const { error } = await supabase
                .from('member_commissions')
                .upsert({
                    member_id: memberId,
                    client_id: clientId,
                    rate: rate
                }, { onConflict: 'member_id,client_id' });

            if (error) throw error;

            // Update local state is complex because of deep structure, easier to refetch
            await fetchData();
            toast.success('Comissão atualizada');
        } catch (error) {
            console.error('Error updating commission:', error);
            toast.error('Erro ao atualizar comissão');
        }
    };

    const updateMemberFinancials = async (memberId: string, financials: { base_salary: number, commission_rate: number, pix_key?: string | null }) => {
        try {
            const { error } = await supabase
                .from('team_members')
                .update(financials)
                .eq('id', memberId);
            if (error) throw error;
            setStaffFinancials(prev => prev.map(m => m.id === memberId ? { ...m, ...financials } : m));
            toast.success('Financeiro do colaborador atualizado');
        } catch (error) {
            toast.error('Erro ao atualizar financeiro');
        }
    };

    const addStaffMember = async (staff: { email: string, role: string, base_salary: number, commission_rate: number }) => {
        if (!workspaceId) return;
        try {
            // Verificar se já existe membro com esse email no workspace
            const { data: existing } = await (supabase as any)
                .from('team_members')
                .select('id')
                .eq('workspace_id', workspaceId)
                .eq('email', staff.email)
                .maybeSingle();

            if (existing) {
                // Atualizar o registro existente
                const { data, error } = await (supabase as any)
                    .from('team_members')
                    .update({
                        role: staff.role,
                        base_salary: staff.base_salary,
                        commission_rate: staff.commission_rate,
                        status: 'active',
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) throw error;
                setStaffFinancials(prev => [...prev, { ...data, commissions: [] }]);
                toast.success('Colaborador atualizado com sucesso');
                return data;
            }

            // Novo membro — inserir
            let result = await supabase
                .from('team_members')
                .insert({ ...staff, workspace_id: workspaceId, status: 'active' } as any)
                .select()
                .single();

            if (result.error) throw result.error;
            setStaffFinancials(prev => [...prev, { ...result.data, commissions: [] }]);
            toast.success('Colaborador adicionado com sucesso');
            return result.data;
        } catch (error: any) {
            console.error('Error adding staff member:', error);
            toast.error('Erro ao adicionar colaborador: ' + error.message);
        }
    };

    const deleteStaffMember = async (memberId: string) => {
        try {
            // Try to unmark as accounting staff first
            let result = await supabase
                .from('team_members')
                .update({ is_accounting_staff: false, base_salary: 0, commission_rate: 0 } as any)
                .eq('id', memberId);

            // If column doesn't exist, just zero out the financial fields
            if (result.error) {
                console.warn('[useFinancials] Retrying deleteStaffMember without is_accounting_staff');
                result = await supabase
                    .from('team_members')
                    .update({ base_salary: 0, commission_rate: 0 } as any)
                    .eq('id', memberId);
            }

            if (result.error) throw result.error;
            setStaffFinancials(prev => prev.filter(m => m.id !== memberId));
            toast.success('Colaborador removido da contabilidade');
        } catch (error) {
            toast.error('Erro ao remover colaborador');
        }
    };

    const addPartnerProlabore = async (partner: Omit<PartnerProlabore, 'id' | 'workspace_id'>) => {
        if (!workspaceId) return;
        try {
            const { data, error } = await supabase
                .from('partners_prolabore')
                .insert({ ...partner, workspace_id: workspaceId })
                .select()
                .single();

            if (error) throw error;
            setPartnersProlabore(prev => [...prev, data]);
            toast.success('Sócio adicionado com sucesso');
            return data;
        } catch (error: any) {
            toast.error('Erro ao adicionar sócio: ' + error.message);
        }
    };

    const updatePartnerProlabore = async (id: string, updates: Partial<PartnerProlabore>) => {
        try {
            const { data, error } = await supabase
                .from('partners_prolabore')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            setPartnersProlabore(prev => prev.map(p => p.id === id ? data : p));
            toast.success('Sócio atualizado');
            return data;
        } catch (error: any) {
            toast.error('Erro ao atualizar sócio');
        }
    };

    const deletePartnerProlabore = async (id: string) => {
        try {
            const { error } = await supabase
                .from('partners_prolabore')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setPartnersProlabore(prev => prev.filter(p => p.id !== id));
            toast.success('Sócio removido');
        } catch (error: any) {
            toast.error('Erro ao remover sócio');
        }
    };

    return {
        isLoading,
        expenses,
        invoices,
        clients,
        staffFinancials,
        partnersProlabore,
        monthReference,
        createInvoice,
        updateInvoiceStatus,
        addExpense,
        deleteExpense,
        updateExpenseStatus,
        updateMemberFinancials,
        updateMemberCommission,
        addStaffMember,
        deleteStaffMember,
        addPartnerProlabore,
        updatePartnerProlabore,
        deletePartnerProlabore,
        refetch: fetchData
    };
}
