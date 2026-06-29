import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, ArrowDownRight, PieChart, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { MemberFinancial } from "@/hooks/useFinancials";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";

interface BalanceteViewProps {
    invoices: any[];
    expenses: any[];
    mrr: number;
    staffFinancials: MemberFinancial[];
}

export function BalanceteView({ invoices, expenses, mrr, staffFinancials }: BalanceteViewProps) {
    const data = useMemo(() => {
        const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.amount, 0);
        const pendingRevenue = invoices.filter(i => i.status !== 'paid').reduce((acc, i) => acc + i.amount, 0);

        // Agency Operational Expenses (Tools, SaaS, etc)
        const toolCosts = expenses.filter(e => e.category === 'tool').reduce((acc, e) => acc + e.amount, 0);
        const otherCosts = expenses.filter(e => e.category === 'other').reduce((acc, e) => acc + e.amount, 0);

        // Staff Costs (Salaries from staffFinancials + specific staff expenses if any)
        const baseSalaries = staffFinancials.reduce((acc, curr) => acc + (curr.base_salary || 0), 0);
        const manualStaffExpenses = expenses.filter(e => e.category === 'staff').reduce((acc, e) => acc + e.amount, 0);
        const totalStaffCosts = baseSalaries + manualStaffExpenses;

        const totalExpenses = totalStaffCosts + toolCosts + otherCosts;
        const ebitda = totalRevenue - totalExpenses;
        const margin = totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0;

        return {
            totalRevenue,
            pendingRevenue,
            staffCosts: totalStaffCosts,
            toolCosts,
            otherCosts,
            totalExpenses,
            ebitda,
            margin
        };
    }, [invoices, expenses, staffFinancials]);

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-[1fr_350px]">
                <Card className="p-8 border border-border/50 bg-background/50">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold">Resumo Financeiro (DRE)</h3>
                            <p className="text-sm text-muted-foreground">Demostrativo de Resultados do Exercício</p>
                        </div>
                        <Badge variant="outline" className="text-xs uppercase px-3 py-1">Consolidados</Badge>
                    </div>

                    <div className="space-y-6">
                        {/* Receitas */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                                Receitas Operacionais
                            </h4>
                            <div className="flex justify-between items-center py-2 px-1">
                                <span className="text-sm">Venda de Serviços (Fees Recebidos)</span>
                                <span className="font-semibold text-emerald-500">{formatCurrency(data.totalRevenue)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-1 text-muted-foreground italic">
                                <span className="text-sm">Receitas a Receber (Pendente)</span>
                                <span className="text-sm">{formatCurrency(data.pendingRevenue)}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 px-1 border-t border-border/50 bg-emerald-500/5 rounded-b">
                                <span className="font-bold text-sm">Receita Operacional Bruta</span>
                                <span className="font-bold text-emerald-600">{formatCurrency(data.totalRevenue)}</span>
                            </div>
                        </div>

                        {/* Despesas */}
                        <div className="space-y-3 pt-4">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <ArrowDownRight className="h-3 w-3 text-destructive" />
                                Despesas Operacionais (OPEX)
                            </h4>
                            <div className="flex justify-between items-center py-2 px-1">
                                <span className="text-sm">Folha de Pagamento & Freelancers</span>
                                <span className="font-medium text-destructive">({formatCurrency(data.staffCosts)})</span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-1">
                                <span className="text-sm">Ferramentas & SaaS</span>
                                <span className="font-medium text-destructive">({formatCurrency(data.toolCosts)})</span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-1">
                                <span className="text-sm">Outras Despesas Corporativas</span>
                                <span className="font-medium text-destructive">({formatCurrency(data.otherCosts)})</span>
                            </div>
                            <div className="flex justify-between items-center py-3 px-1 border-t border-border/50 bg-destructive/5 rounded-b">
                                <span className="font-bold text-sm">Total Despesas Operacionais</span>
                                <span className="font-bold text-destructive">{formatCurrency(data.totalExpenses)}</span>
                            </div>
                        </div>

                        <Separator className="my-8" />

                        {/* Resultado */}
                        <div className="p-6 rounded-xl bg-primary/5 border border-primary/10 space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                                        <PieChart className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold">EBITDA / Lucro Líquido</p>
                                        <p className="text-xs text-muted-foreground">Considerando apenas entradas efetuadas</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={cn("text-2xl font-black", data.ebitda >= 0 ? "text-primary" : "text-destructive")}>
                                        {formatCurrency(data.ebitda)}
                                    </p>
                                    <Badge className="mt-1">{data.margin.toFixed(1)}% Margem</Badge>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="space-y-6">
                    <Card className="p-6 space-y-4 bg-background border border-border/50">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Previsibilidade</h4>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">MRR Estimado (Contratos)</p>
                                <p className="text-lg font-bold">{formatCurrency(mrr)}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Ponto de Equilíbrio (Break-even)</p>
                                <p className="text-sm font-semibold">{formatCurrency(data.totalExpenses)}</p>
                                <div className="w-full bg-muted h-1 rounded-full mt-2 overflow-hidden">
                                    <div
                                        className="bg-primary h-full"
                                        style={{ width: `${Math.min((data.totalExpenses / mrr) * 100, 100)}%` }}
                                    />
                                </div>
                                <p className="text-[9px] mt-1 text-muted-foreground text-right">{((data.totalExpenses / mrr) * 100).toFixed(0)}% do MRR</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 space-y-4 bg-background border border-border/50">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Saldo em Caixa</h4>
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-lg font-bold">
                                <Wallet className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-black">{formatCurrency(data.totalRevenue - data.totalExpenses)}</p>
                                <p className="text-xs text-muted-foreground">Disponível imediato</p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
