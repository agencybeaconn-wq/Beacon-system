import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Users, TrendingDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";

interface CollaboratorsCostsProps {
    expenses: any[];
}

export function CollaboratorsCosts({ expenses }: CollaboratorsCostsProps) {
    const staffExpenses = useMemo(() => {
        return expenses.filter(e => e.category === 'staff');
    }, [expenses]);

    const totalStaffCost = useMemo(() => {
        return staffExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    }, [staffExpenses]);

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-6 space-y-2 bg-background border border-border/50">
                    <div className="flex items-center justify-between text-muted-foreground text-sm">
                        <span>Total Gasto Staff</span>
                        <Users className="h-4 w-4" />
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(totalStaffCost)}</div>
                    <p className="text-xs text-muted-foreground font-medium">Equipe e freelancers</p>
                </Card>

                <Card className="p-6 space-y-2 bg-background border border-border/50">
                    <div className="flex items-center justify-between text-muted-foreground text-sm">
                        <span>Colaboradores Ativos</span>
                        <UserCheck className="h-4 w-4" />
                    </div>
                    <div className="text-2xl font-bold">{staffExpenses.length}</div>
                    <p className="text-xs text-muted-foreground font-medium">Prestadores no mês</p>
                </Card>

                <Card className="p-6 space-y-2 bg-background border border-border/50">
                    <div className="flex items-center justify-between text-muted-foreground text-sm">
                        <span>Burn Rate Diário</span>
                        <Clock className="h-4 w-4" />
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(totalStaffCost / 30)}</div>
                    <p className="text-xs text-muted-foreground font-medium">Média diária de custo staff</p>
                </Card>
            </div>

            <Card className="border border-border/50 bg-background/50 overflow-hidden">
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Folha de Pagamento & Prestadores</h3>
                    {staffExpenses.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <TrendingDown className="h-12 w-12 mx-auto opacity-20 mb-4" />
                            <p>Nenhum custo de staff lançado para este período.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-border/50">
                                    <TableHead>Colaborador / Descrição</TableHead>
                                    <TableHead>Data Vencimento</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {staffExpenses.map((expense) => (
                                    <TableRow key={expense.id} className="group hover:bg-muted/50 transition-colors">
                                        <TableCell className="font-medium">{expense.description}</TableCell>
                                        <TableCell>{new Date(expense.due_date).toLocaleDateString('pt-BR')}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "border-none",
                                                    expense.status === 'paid' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                                                )}
                                            >
                                                {expense.status === 'paid' ? 'PAGO' : 'PENDENTE'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(expense.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </Card>
        </div>
    );
}
