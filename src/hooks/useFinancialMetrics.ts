
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateFinancialMetrics, CostBreakdown } from "@/utils/financial-engine";
import { useDashboard } from "@/contexts/DashboardContext";

export interface DateRange {
    from: Date;
    to: Date;
}

export function useFinancialMetrics(dateRange: DateRange | undefined) {
    const { workspaceId } = useDashboard();

    return useQuery({
        queryKey: ['financial-metrics', dateRange, workspaceId],
        queryFn: async () => {
            if (!dateRange?.from || !dateRange?.to || !workspaceId) return null;

            const fromStr = dateRange.from.toISOString();
            const toStr = dateRange.to.toISOString();

            // 1. Fetch Transactions (Revenue)
            const { data: transactions, error: transError } = await supabase
                .from('financial_transactions')
                .select('*')
                .eq('workspace_id', workspaceId)
                .gte('transaction_date', fromStr)
                .lte('transaction_date', toStr)
                .eq('status', 'paid');

            if (transError) throw transError;

            // 2. Fetch Marketing Spend
            const { data: marketing, error: adsError } = await supabase
                .from('marketing_spend')
                .select('*')
                .eq('workspace_id', workspaceId)
                .gte('date', fromStr)
                .lte('date', toStr);

            if (adsError) throw adsError;

            // 3. Fetch Fixed Costs (now from agency_expenses)
            const { data: fixed, error: fixedError } = await supabase
                .from('agency_expenses')
                .select('*')
                .eq('workspace_id', workspaceId)
                .eq('recurrence_type', 'fixed');

            if (fixedError) throw fixedError;

            // 4. Fetch Variable Costs
            const { data: variable, error: varError } = await supabase
                .from('variable_costs')
                .select('*')
                .eq('workspace_id', workspaceId)
                .gte('date', fromStr)
                .lte('date', toStr);

            if (varError) throw varError;

            // 5. Fetch Client Settings (for average Tax/COGS rates)
            // Ideally we'd have a workspace-level setting, but we can average client settings
            // or fetch the first client's settings if it's a single-client workspace.
            const { data: clients, error: clientsError } = await supabase
                .from('agency_clients')
                .select('profit_tax_percent, profit_gateway_percent')
                .eq('workspace_id', workspaceId)
                .limit(1);

            if (clientsError) {
                console.error('[useFinancialMetrics] Error fetching client settings:', clientsError);
            }

            const settings = clients?.[0] || { profit_tax_percent: 10, profit_gateway_percent: 3 };
            const taxRate = (settings.profit_tax_percent || 10) / 100;
            const gatewayRate = (settings.profit_gateway_percent || 3) / 100;

            // --- Aggregation Logic ---

            // Revenue
            const grossRevenue = transactions?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
            const ordersCount = transactions?.length || 0;

            // Ads
            const adSpend = marketing?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

            // Costs
            const taxes = grossRevenue * taxRate;
            const gatewayFees = grossRevenue * gatewayRate;

            const fixedCostsTotal = fixed?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
            const variableCostsTotal = variable?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

            // Todo: Fetch real COGS based on product_costs table linked to transactions
            // For now, still using a fixed percentage but could be fetched from settings if we add profit_cogs_percent
            const cogs = grossRevenue * 0.30;

            const costs: CostBreakdown = {
                taxes,
                gatewayFees,
                shippingCost: 0,
                fixedCosts: fixedCostsTotal,
                variableCosts: variableCostsTotal
            };

            return calculateFinancialMetrics(grossRevenue, costs, cogs, adSpend, ordersCount);
        },
        enabled: !!dateRange?.from && !!dateRange?.to && !!workspaceId
    });
}
