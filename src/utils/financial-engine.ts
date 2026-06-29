
/**
 * Core Financial Calculation Engine
 * Centralizes logic for margin, profit, and ROAS calculations to ensure consistency.
 */

export interface FinancialMetrics {
    grossRevenue: number; // Faturamento Bruto
    netRevenue: number;   // Faturamento Líquido (Gross - Taxes - Gateway)
    cogs: number;         // Cost of Goods Sold (CMV)
    grossProfit: number;  // Lucro Bruto (Net Revenue - COGS)
    adSpend: number;      // Gastos com Anúncios (Ads)
    netProfit: number;    // Lucro Líquido (Gross Profit - Ads - Fixed/Var Costs)
    margin: number;       // Margem Líquida (%)
    roas: number;         // Return on Ad Spend
    cpa: number;          // Cost Per Acquisition
    ordersCount: number;  // Total Orders
}

export interface CostBreakdown {
    taxes: number;         // Impostos
    gatewayFees: number;   // Taxas do Gateway (Stripe/MercadoPago etc)
    shippingCost: number;  // Custo de envio (se subsidiado)
    fixedCosts: number;    // Custos Fixos (Aluguel, Equipe)
    variableCosts: number; // Custos Variáveis Extras
}

/**
 * Calculates the Net Profit and other key metrics.
 */
export const calculateFinancialMetrics = (
    revenue: number,
    costs: CostBreakdown,
    cogs: number,
    adSpend: number,
    ordersCount: number
): FinancialMetrics => {
    // 1. Net Revenue = Gross - Direct Sales Costs (Taxes, Gateway, Shipping)
    const directCosts = costs.taxes + costs.gatewayFees + costs.shippingCost;
    const netRevenue = revenue - directCosts;

    // 2. Gross Profit = Net Revenue - Product Costs (COGS)
    const grossProfit = netRevenue - cogs;

    // 3. Total Operational Costs
    const operationalCosts = costs.fixedCosts + costs.variableCosts + adSpend;

    // 4. Net Profit = Gross Profit - Operational Costs
    const netProfit = grossProfit - operationalCosts;

    // 5. Margin %
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    // 6. ROAS
    const roas = adSpend > 0 ? revenue / adSpend : 0;

    // 7. CPA
    const cpa = ordersCount > 0 ? adSpend / ordersCount : 0;

    return {
        grossRevenue: revenue,
        netRevenue,
        cogs,
        grossProfit,
        adSpend,
        netProfit,
        margin,
        roas,
        cpa,
        ordersCount
    };
};

/**
 * Helper to calculate Taxes based on a percentage (e.g. Simples Nacional)
 */
export const calculateTaxes = (revenue: number, taxRatePercent: number): number => {
    return revenue * (taxRatePercent / 100);
};

/**
 * Helper to calculate Gateway Fees
 * @param revenue Total transaction amount
 * @param flatFee Flat fee per transaction (e.g. R$ 0.50)
 * @param percentFee Percentage fee (e.g. 3.99%)
 */
export const calculateGatewayFees = (
    revenue: number,
    transactionsCount: number,
    flatFee: number = 0,
    percentFee: number = 0
): number => {
    return (revenue * (percentFee / 100)) + (transactionsCount * flatFee);
};
