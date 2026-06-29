import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { AcademyRevenue, AcademyExpense } from "@/hooks/useAcademyFinancials";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";

interface AcademyDREViewProps {
    revenues: AcademyRevenue[];
    expenses: AcademyExpense[];
}

export function AcademyDREView({ revenues, expenses }: AcademyDREViewProps) {
    const [taxRate, setTaxRate] = useState(6);

    const dre = useMemo(() => {
        const safeRevenues = revenues || [];
        const safeExpenses = expenses || [];

        // Receita Bruta (excluindo cancelados)
        const receitaBruta = safeRevenues
            .filter(r => r.status !== 'cancelado')
            .reduce((acc, r) => acc + (r.amount || 0), 0);

        // Impostos
        const impostos = receitaBruta * (taxRate / 100);

        // Receita Líquida
        const receitaLiquida = receitaBruta - impostos;

        // Custos por categoria
        const custosPorCategoria = safeExpenses.reduce((acc, e) => {
            const cat = e.category || 'outro';
            acc[cat] = (acc[cat] || 0) + (e.amount || 0);
            return acc;
        }, {} as Record<string, number>);

        const custosTotal = safeExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);

        // Custos fixos vs variáveis
        const custosFixos = safeExpenses
            .filter(e => e.recurrence_type === 'fixed')
            .reduce((acc, e) => acc + (e.amount || 0), 0);

        const custosVariaveis = safeExpenses
            .filter(e => e.recurrence_type === 'variable')
            .reduce((acc, e) => acc + (e.amount || 0), 0);

        // Lucro Operacional
        const lucroOperacional = receitaLiquida - custosTotal;

        // Margem
        const margem = receitaBruta > 0 ? (lucroOperacional / receitaBruta) * 100 : 0;

        // Receita por categoria
        const receitaPorCategoria = safeRevenues
            .filter(r => r.status !== 'cancelado')
            .reduce((acc, r) => {
                const cat = r.category || 'outro';
                acc[cat] = (acc[cat] || 0) + (r.amount || 0);
                return acc;
            }, {} as Record<string, number>);

        return {
            receitaBruta,
            impostos,
            receitaLiquida,
            custosPorCategoria,
            custosTotal,
            custosFixos,
            custosVariaveis,
            lucroOperacional,
            margem,
            receitaPorCategoria
        };
    }, [revenues, expenses, taxRate]);

    const categoryLabelsRevenue: Record<string, string> = {
        curso: 'Cursos',
        mentoria: 'Mentorias',
        material: 'Materiais',
        outro: 'Outros',
    };

    const categoryLabelsExpense: Record<string, string> = {
        plataforma: 'Plataformas',
        marketing: 'Marketing',
        professor: 'Professores',
        material: 'Materiais',
        infraestrutura: 'Infraestrutura',
        outro: 'Outros',
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">DRE Gerencial — Academy</h3>
                <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Alíquota (%)</Label>
                    <Input
                        type="number"
                        className="w-20 h-8 text-sm"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Number(e.target.value))}
                        min={0}
                        max={100}
                        step={0.5}
                    />
                </div>
            </div>

            <Card className="border border-border/50 bg-background/50 overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="text-left pl-6 font-bold">Conta</TableHead>
                            <TableHead className="text-right pr-6 font-bold w-[200px]">Valor</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {/* Receita Bruta */}
                        <TableRow className="bg-emerald-500/5 hover:bg-emerald-500/10">
                            <TableCell className="pl-6 font-bold text-emerald-500">RECEITA BRUTA</TableCell>
                            <TableCell className="text-right pr-6 font-bold text-emerald-500">{formatCurrency(dre.receitaBruta)}</TableCell>
                        </TableRow>

                        {/* Detalhamento por categoria de receita */}
                        {Object.entries(dre.receitaPorCategoria).map(([cat, val]) => (
                            <TableRow key={`rev-${cat}`} className="hover:bg-muted/50">
                                <TableCell className="pl-10 text-sm text-muted-foreground">
                                    {categoryLabelsRevenue[cat] || cat}
                                </TableCell>
                                <TableCell className="text-right pr-6 text-sm">{formatCurrency(val)}</TableCell>
                            </TableRow>
                        ))}

                        {/* Impostos */}
                        <TableRow className="hover:bg-muted/50">
                            <TableCell className="pl-6 font-medium text-destructive/80">
                                (-) Impostos ({taxRate}%)
                            </TableCell>
                            <TableCell className="text-right pr-6 font-medium text-destructive/80">
                                -{formatCurrency(dre.impostos)}
                            </TableCell>
                        </TableRow>

                        {/* Receita Líquida */}
                        <TableRow className="bg-blue-500/5 hover:bg-blue-500/10 border-t border-border">
                            <TableCell className="pl-6 font-bold text-blue-500">RECEITA LÍQUIDA</TableCell>
                            <TableCell className="text-right pr-6 font-bold text-blue-500">{formatCurrency(dre.receitaLiquida)}</TableCell>
                        </TableRow>

                        {/* Custos */}
                        <TableRow className="bg-destructive/5 hover:bg-destructive/10 border-t border-border">
                            <TableCell className="pl-6 font-bold text-destructive">CUSTOS OPERACIONAIS</TableCell>
                            <TableCell className="text-right pr-6 font-bold text-destructive">-{formatCurrency(dre.custosTotal)}</TableCell>
                        </TableRow>

                        {/* Custos fixos */}
                        <TableRow className="hover:bg-muted/50">
                            <TableCell className="pl-10 text-sm text-muted-foreground">Custos Fixos</TableCell>
                            <TableCell className="text-right pr-6 text-sm">-{formatCurrency(dre.custosFixos)}</TableCell>
                        </TableRow>

                        {/* Custos variáveis */}
                        <TableRow className="hover:bg-muted/50">
                            <TableCell className="pl-10 text-sm text-muted-foreground">Custos Variáveis</TableCell>
                            <TableCell className="text-right pr-6 text-sm">-{formatCurrency(dre.custosVariaveis)}</TableCell>
                        </TableRow>

                        {/* Detalhamento por categoria de despesa */}
                        {Object.entries(dre.custosPorCategoria).map(([cat, val]) => (
                            <TableRow key={`exp-${cat}`} className="hover:bg-muted/50">
                                <TableCell className="pl-14 text-xs text-muted-foreground">
                                    {categoryLabelsExpense[cat] || cat}
                                </TableCell>
                                <TableCell className="text-right pr-6 text-xs">-{formatCurrency(val)}</TableCell>
                            </TableRow>
                        ))}

                        {/* Lucro Operacional */}
                        <TableRow className={cn(
                            "border-t-2 border-border",
                            dre.lucroOperacional >= 0 ? "bg-purple-500/5" : "bg-destructive/5"
                        )}>
                            <TableCell className={cn(
                                "pl-6 font-black text-base",
                                dre.lucroOperacional >= 0 ? "text-purple-500" : "text-destructive"
                            )}>
                                RESULTADO OPERACIONAL
                            </TableCell>
                            <TableCell className={cn(
                                "text-right pr-6 font-black text-base",
                                dre.lucroOperacional >= 0 ? "text-purple-500" : "text-destructive"
                            )}>
                                {formatCurrency(dre.lucroOperacional)}
                                <span className="text-xs font-normal ml-2 text-muted-foreground">
                                    ({dre.margem.toFixed(1)}%)
                                </span>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
