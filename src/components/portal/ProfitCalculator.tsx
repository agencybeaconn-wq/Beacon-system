import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calculator, DollarSign, Percent, TrendingUp, Wallet, CreditCard, Package } from 'lucide-react';
import type { ClientCosts } from '@/hooks/useSharedDashboard';
import { formatCurrencyBRL as formatCurrency } from '@/lib/formatters';

interface ProfitCalculatorProps {
    revenue: number;
    spend: number;
    conversions: number;
    initialCosts: ClientCosts;
    onCostsChange: (costs: ClientCosts) => void;
    primaryColor?: string;
}

export function ProfitCalculator({
    revenue,
    spend,
    conversions,
    initialCosts,
    onCostsChange,
    primaryColor = '#0066FF',
}: ProfitCalculatorProps) {
    const [costs, setCosts] = useState<ClientCosts>(initialCosts);
    const [isSaving, setIsSaving] = useState(false);

    // Sync with initialCosts when they change (e.g., after loading from server)
    useEffect(() => {
        setCosts(initialCosts);
    }, [initialCosts]);

    // Calculate profit metrics
    const gatewayFee = revenue * (costs.gateway_fee_percent / 100);
    const supplierCost = costs.supplier_cost_mode === 'per_sale'
        ? costs.supplier_cost_value * conversions
        : costs.supplier_cost_value;
    const grossProfit = revenue - spend;
    const netProfit = grossProfit - gatewayFee - supplierCost;
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    // Debounced save
    useEffect(() => {
        const timer = setTimeout(() => {
            if (JSON.stringify(costs) !== JSON.stringify(initialCosts)) {
                setIsSaving(true);
                onCostsChange(costs);
                setTimeout(() => setIsSaving(false), 500);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [costs, initialCosts, onCostsChange]);

    return (
        <Card className="border-2" style={{ borderColor: `${primaryColor}20` }}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: `${primaryColor}15` }}
                        >
                            <Calculator className="h-5 w-5" style={{ color: primaryColor }} />
                        </div>
                        <CardTitle className="text-lg">Calculadora de Lucro</CardTitle>
                    </div>
                    {isSaving && (
                        <Badge variant="secondary" className="text-xs animate-pulse">
                            Salvando...
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Input Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Supplier Cost */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm font-medium">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            Custo de Fornecedor/Produto
                        </Label>
                        <div className="flex gap-2">
                            <Select
                                value={costs.supplier_cost_mode}
                                onValueChange={(value: 'fixed' | 'per_sale') =>
                                    setCosts(prev => ({ ...prev, supplier_cost_mode: value }))
                                }
                            >
                                <SelectTrigger className="w-[130px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="per_sale">Por Venda</SelectItem>
                                    <SelectItem value="fixed">Fixo Total</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                    R$
                                </span>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={costs.supplier_cost_value || ''}
                                    onChange={(e) =>
                                        setCosts(prev => ({ ...prev, supplier_cost_value: parseFloat(e.target.value) || 0 }))
                                    }
                                    className="pl-9"
                                    placeholder="0,00"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {costs.supplier_cost_mode === 'per_sale'
                                ? `R$ ${costs.supplier_cost_value.toFixed(2)} × ${conversions} vendas = ${formatCurrency(supplierCost)}`
                                : 'Valor fixo total do período'}
                        </p>
                    </div>

                    {/* Gateway Fee */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm font-medium">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            Taxa de Gateway/Checkout
                        </Label>
                        <div className="relative">
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={costs.gateway_fee_percent || ''}
                                onChange={(e) =>
                                    setCosts(prev => ({
                                        ...prev,
                                        gateway_fee_percent: Math.min(100, parseFloat(e.target.value) || 0)
                                    }))
                                }
                                className="pr-8"
                                placeholder="3,5"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                <Percent className="h-4 w-4" />
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {costs.gateway_fee_percent}% de {formatCurrency(revenue)} = {formatCurrency(gatewayFee)}
                        </p>
                    </div>
                </div>

                {/* Profit Breakdown */}
                <div
                    className="rounded-lg p-4 space-y-3"
                    style={{ backgroundColor: `${primaryColor}08` }}
                >
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <DollarSign className="h-4 w-4" />
                            Faturamento Bruto
                        </span>
                        <span className="font-medium">{formatCurrency(revenue)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground pl-6">- Gasto com Anúncios</span>
                        <span className="font-medium text-red-500">- {formatCurrency(spend)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground pl-6">- Taxa de Gateway ({costs.gateway_fee_percent}%)</span>
                        <span className="font-medium text-orange-500">- {formatCurrency(gatewayFee)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground pl-6">- Custo de Fornecedor</span>
                        <span className="font-medium text-amber-500">- {formatCurrency(supplierCost)}</span>
                    </div>

                    <div className="border-t pt-3 mt-3">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 font-semibold">
                                <Wallet className="h-5 w-5" style={{ color: primaryColor }} />
                                Lucro Real Estimado
                            </span>
                            <div className="text-right">
                                <span
                                    className={`text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                                >
                                    {formatCurrency(netProfit)}
                                </span>
                                <div className="flex items-center gap-1 justify-end">
                                    <TrendingUp className={`h-3 w-3 ${profitMargin >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                                    <span className={`text-xs font-medium ${profitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {profitMargin.toFixed(1)}% margem
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Formula Explanation */}
                <p className="text-xs text-center text-muted-foreground">
                    Lucro = Faturamento - Gastos - Taxas Gateway - Custos Fornecedor
                </p>
            </CardContent>
        </Card>
    );
}
