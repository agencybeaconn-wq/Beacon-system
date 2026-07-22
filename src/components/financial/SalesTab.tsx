import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
    Target,
    TrendingUp,
    TrendingDown,
    Plus,
    Pencil,
    Trash2,
    Check,
    ChevronLeft,
    ChevronRight,
    Users
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSales, SaleRecord, SalesSummary, SalesGoal } from "@/hooks/useSales";
import { AddSaleModal } from "./AddSaleModal";
import { EditSaleModal } from "./EditSaleModal";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";

interface SalesTabProps {
    isLoading: boolean;
    sales: SaleRecord[];
    allMonthSales: SaleRecord[];
    summary: SalesSummary;
    goal: SalesGoal | null;
    monthReference: string;
    addSale: (sale: Omit<SaleRecord, 'id' | 'workspace_id' | 'created_at'>) => Promise<any>;
    updateSale: (id: string, updates: Partial<SaleRecord>) => Promise<any>;
    deleteSale: (id: string) => Promise<any>;
    updateGoal: (goal: number) => Promise<any>;
}

export function SalesTab({
    isLoading,
    sales,
    allMonthSales,
    summary,
    goal,
    monthReference,
    addSale,
    updateSale,
    deleteSale,
    updateGoal
}: SalesTabProps) {

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
    const [isEditGoalOpen, setIsEditGoalOpen] = useState(false);
    const [goalInput, setGoalInput] = useState("");
    const [sellerFilter, setSellerFilter] = useState<'all' | 'joao' | 'matheus'>('all');

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const handleSaveGoal = async () => {
        const amount = parseFloat(goalInput.replace(",", ".")) || 0;
        await updateGoal(amount);
        setIsEditGoalOpen(false);
        setGoalInput("");
    };

    // Filter sales by seller
    const filteredSales = useMemo(() => {
        if (sellerFilter === 'all') return sales || [];
        return (sales || []).filter(s => s.sold_by === sellerFilter);
    }, [sales, sellerFilter]);

    // Filter allMonthSales by seller for progress recalculation
    const filteredMonthSales = useMemo(() => {
        if (sellerFilter === 'all') return allMonthSales || [];
        return (allMonthSales || []).filter(s => s.sold_by === sellerFilter);
    }, [allMonthSales, sellerFilter]);

    // Recalculate summary based on seller filter
    const sellerSummary = useMemo(() => {
        if (sellerFilter === 'all') return summary;

        const safeSales = filteredMonthSales;
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

        // Meta dividida por 2 quando filtro por vendedor
        const goalAmount = (goal?.goal_amount || 0) / 2;
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
    }, [sellerFilter, filteredMonthSales, summary, goal]);

    // Pagination logic
    const totalPages = Math.ceil((filteredSales?.length || 0) / itemsPerPage);
    const paginatedSales = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return filteredSales.slice(start, end);
    }, [filteredSales, currentPage, itemsPerPage]);

    // Go to previous page
    const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    // Go to next page
    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };

    // Handle items per page change
    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number(value));
        setCurrentPage(1); // Reset to first page
    };

    const handleMarkAsPaid = async (sale: SaleRecord) => {
        await updateSale(sale.id, { status: "pago", entry_amount: sale.total_amount });
    };

    const handleStatusChange = async (sale: SaleRecord, newStatus: string) => {
        const updates: any = { status: newStatus };
        if (newStatus === "pago") {
            updates.entry_amount = sale.total_amount;
        } else if (newStatus === "pendente") {
            updates.entry_amount = 0;
        }
        await updateSale(sale.id, updates);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pago":
                return <Badge className="bg-emerald-500/10 text-emerald-500 border-none">PAGO</Badge>;
            case "parcial":
                return <Badge className="bg-amber-500/10 text-amber-500 border-none">PARCIAL</Badge>;
            default:
                return <Badge className="bg-red-500/10 text-red-500 border-none">PENDENTE</Badge>;
        }
    };

    const getPaymentMethodLabel = (method: string) => {
        const labels: Record<string, string> = {
            pix: "PIX",
            cartao: "Cartão",
            boleto: "Boleto",
            transferencia: "Transferência",
            dinheiro: "Dinheiro",
            outro: "Outro"
        };
        return labels[method] || method;
    };

    // Per-seller summaries (always computed, independent of filter)
    const joaoSold = useMemo(() => {
        return (allMonthSales || []).filter(s => s.sold_by === 'joao').reduce((acc, s) => acc + (s.total_amount || 0), 0);
    }, [allMonthSales]);

    const matheusSold = useMemo(() => {
        return (allMonthSales || []).filter(s => s.sold_by === 'matheus').reduce((acc, s) => acc + (s.total_amount || 0), 0);
    }, [allMonthSales]);

    const halfGoal = (goal?.goal_amount || 0) / 2;
    const joaoPercentage = halfGoal > 0 ? (joaoSold / halfGoal) * 100 : 0;
    const matheusPercentage = halfGoal > 0 ? (matheusSold / halfGoal) * 100 : 0;

    // Progress bar percentage (capped at 100 for visual)
    const progressWidth = Math.min(sellerSummary.goalPercentage, 100);

    const getSellerBadge = (soldBy: string | null | undefined) => {
        switch (soldBy) {
            case 'joao':
                return <Badge className="bg-blue-500/10 text-blue-500 border-none text-[10px] font-bold">JOÃO</Badge>;
            case 'matheus':
                return <Badge className="bg-purple-500/10 text-purple-500 border-none text-[10px] font-bold">MATHEUS</Badge>;
            default:
                return <span className="text-muted-foreground text-xs">—</span>;
        }
    };

    return (
        <div className="space-y-6">
            {/* Goal Tracking Section */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Left: Meta Mensal with per-seller breakdown */}
                <Card className="p-6 bg-background border border-border/50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-primary" />
                            <span className="font-semibold">Meta Mensal</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setGoalInput(summary.goalAmount.toString());
                                setIsEditGoalOpen(true);
                            }}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="text-3xl font-bold">
                        {isLoading ? (
                            <Skeleton className="h-9 w-32" />
                        ) : (
                            formatCurrency(summary.goalAmount)
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        {format(parseISO(monthReference + "-01"), "MMMM yyyy", { locale: ptBR })}
                    </p>

                    {/* Per-seller breakdown */}
                    {!isLoading && halfGoal > 0 && (
                        <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Meta individual: {formatCurrency(halfGoal)}</p>
                            
                            {/* João */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                                        <span className="text-sm font-semibold text-blue-500">João</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold">{formatCurrency(joaoSold)}</span>
                                        <Badge className={cn(
                                            "border-none text-[10px]",
                                            joaoPercentage >= 100
                                                ? "bg-emerald-500/10 text-emerald-500"
                                                : "bg-blue-500/10 text-blue-500"
                                        )}>
                                            {joaoPercentage.toFixed(0)}%
                                        </Badge>
                                    </div>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all duration-500",
                                            joaoPercentage >= 100 ? "bg-emerald-500" : "bg-blue-500"
                                        )}
                                        style={{ width: `${Math.min(joaoPercentage, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Matheus */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-purple-500" />
                                        <span className="text-sm font-semibold text-purple-500">Matheus</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold">{formatCurrency(matheusSold)}</span>
                                        <Badge className={cn(
                                            "border-none text-[10px]",
                                            matheusPercentage >= 100
                                                ? "bg-emerald-500/10 text-emerald-500"
                                                : "bg-purple-500/10 text-purple-500"
                                        )}>
                                            {matheusPercentage.toFixed(0)}%
                                        </Badge>
                                    </div>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all duration-500",
                                            matheusPercentage >= 100 ? "bg-emerald-500" : "bg-purple-500"
                                        )}
                                        style={{ width: `${Math.min(matheusPercentage, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Right: Progress (total) */}
                <Card className="p-6 bg-background border border-border/50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            {sellerSummary.isAboveGoal ? (
                                <TrendingUp className="h-5 w-5 text-emerald-500" />
                            ) : (
                                <TrendingDown className="h-5 w-5 text-amber-500" />
                            )}
                            <span className="font-semibold">Progresso {sellerFilter !== 'all' ? `(${sellerFilter === 'joao' ? 'João' : 'Matheus'})` : 'Geral'}</span>
                        </div>
                        <Badge
                            className={cn(
                                "border-none",
                                sellerSummary.isAboveGoal
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : "bg-amber-500/10 text-amber-500"
                            )}
                        >
                            {sellerSummary.goalPercentage.toFixed(1)}%
                        </Badge>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total Vendido</span>
                            <span className="font-semibold">{formatCurrency(sellerSummary.totalSold)}</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    sellerSummary.isAboveGoal ? "bg-emerald-500" : "bg-amber-500"
                                )}
                                style={{ width: `${progressWidth}%` }}
                            />
                        </div>

                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                                {sellerSummary.isAboveGoal ? "Acima da meta" : "Falta para a meta"}
                            </span>
                            <span className={cn(
                                "font-semibold",
                                sellerSummary.isAboveGoal ? "text-emerald-500" : "text-amber-500"
                            )}>
                                {sellerSummary.isAboveGoal
                                    ? `+${formatCurrency(Math.abs(sellerSummary.remainingToGoal))}`
                                    : formatCurrency(sellerSummary.remainingToGoal)
                                }
                            </span>
                        </div>
                    </div>
                </Card>
            </div>


            {/* Sales List */}
            <Card className="border border-border/50 bg-background/50 overflow-hidden">
                <div className="px-6 pt-6 pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-bold">Vendas do Mês</h3>
                            {/* Seller Filter Buttons */}
                            <div className="flex gap-1 items-center bg-secondary/30 p-1 rounded-md border border-white/5">
                                <Button
                                    variant={sellerFilter === 'all' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => { setSellerFilter('all'); setCurrentPage(1); }}
                                    className={cn("rounded-sm text-xs h-7 px-3", sellerFilter === 'all' && "font-semibold")}
                                >
                                    Todos
                                </Button>
                                <Button
                                    variant={sellerFilter === 'joao' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => { setSellerFilter('joao'); setCurrentPage(1); }}
                                    className={cn(
                                        "rounded-sm text-xs h-7 px-3 gap-1.5",
                                        sellerFilter === 'joao' && "font-semibold bg-blue-600 hover:bg-blue-700"
                                    )}
                                >
                                    <Users className="h-3 w-3" />
                                    João
                                </Button>
                                <Button
                                    variant={sellerFilter === 'matheus' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => { setSellerFilter('matheus'); setCurrentPage(1); }}
                                    className={cn(
                                        "rounded-sm text-xs h-7 px-3 gap-1.5",
                                        sellerFilter === 'matheus' && "font-semibold bg-purple-600 hover:bg-purple-700"
                                    )}
                                >
                                    <Users className="h-3 w-3" />
                                    Matheus
                                </Button>
                            </div>
                        </div>
                        <Button onClick={() => setIsAddModalOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar Fatura
                        </Button>
                    </div>
                </div>

                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="pl-6 border-r border-border/50">Cliente</TableHead>
                            <TableHead className="border-r border-border/50">Serviço</TableHead>
                            <TableHead className="border-r border-border/50">Vendedor</TableHead>
                            <TableHead className="border-r border-border/50">Tipo</TableHead>
                            <TableHead className="border-r border-border/50">Data</TableHead>
                            <TableHead className="border-r border-border/50">Valor Total</TableHead>
                            <TableHead className="border-r border-border/50">Entrada</TableHead>
                            <TableHead className="border-r border-border/50">Pagamento</TableHead>
                            <TableHead className="border-r border-border/50">Status</TableHead>
                            <TableHead className="text-left pr-6">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell className="pl-6"><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                    <TableCell className="pr-6"></TableCell>
                                </TableRow>
                            ))
                        ) : filteredSales.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                                    {sellerFilter !== 'all'
                                        ? `Nenhuma venda de ${sellerFilter === 'joao' ? 'João' : 'Matheus'} neste período.`
                                        : 'Nenhuma venda registrada neste período.'
                                    }
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedSales.map((sale) => (
                                <TableRow key={sale.id} className="group hover:bg-muted/50">
                                    <TableCell className="font-medium pl-6 border-r border-border/50">{sale.client_name}</TableCell>
                                    <TableCell className="text-muted-foreground border-r border-border/50">{sale.service || "-"}</TableCell>
                                    <TableCell className="border-r border-border/50">
                                        {getSellerBadge(sale.sold_by)}
                                    </TableCell>
                                    <TableCell className="border-r border-border/50">
                                        <Badge variant="outline" className={cn(
                                            "text-[10px] font-bold uppercase",
                                            sale.recurrence === 'recurring'
                                                ? "border-purple-500/20 text-purple-500 bg-purple-500/5"
                                                : "border-blue-500/20 text-blue-500 bg-blue-500/5"
                                        )}>
                                            {sale.recurrence === 'recurring' ? 'MRR' : 'Avulso'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="border-r border-border/50">
                                        {format(parseISO(sale.sale_date), "dd/MM/yy")}
                                    </TableCell>
                                    <TableCell className="font-semibold border-r border-border/50">
                                        {formatCurrency(sale.total_amount)}
                                    </TableCell>
                                    <TableCell className="border-r border-border/50">
                                        {formatCurrency(sale.entry_amount)}
                                    </TableCell>
                                    <TableCell className="border-r border-border/50">
                                        {getPaymentMethodLabel(sale.payment_method)}
                                    </TableCell>
                                    <TableCell className="border-r border-border/50">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="hover:opacity-80 transition-opacity">
                                                    {getStatusBadge(sale.status)}
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="bg-background border-border/50">
                                                <DropdownMenuItem
                                                    className="text-emerald-500 focus:text-emerald-500 focus:bg-emerald-500/10 cursor-pointer font-bold"
                                                    onClick={() => handleStatusChange(sale, "pago")}
                                                >
                                                    PAGO
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-amber-500 focus:text-amber-500 focus:bg-amber-500/10 cursor-pointer font-bold"
                                                    onClick={() => handleStatusChange(sale, "parcial")}
                                                >
                                                    PARCIAL
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-red-500 focus:text-red-500 focus:bg-red-500/10 cursor-pointer font-bold"
                                                    onClick={() => handleStatusChange(sale, "pendente")}
                                                >
                                                    PENDENTE
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                    <TableCell className="text-left pr-6">
                                        <div className="flex justify-start items-center gap-1">
                                            {sale.status !== "pago" && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 px-2 text-[10px] font-bold border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 transition-all mr-1"
                                                    onClick={() => handleMarkAsPaid(sale)}
                                                >
                                                    <Check className="h-3 w-3 mr-1" />
                                                    PAGAR
                                                </Button>
                                            )}
                                            {(
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-primary"
                                                    onClick={() => {
                                                        setEditingSale(sale);
                                                        setIsEditModalOpen(true);
                                                    }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-destructive"
                                                    onClick={() => deleteSale(sale.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {/* Pagination Controls */}
                {!isLoading && filteredSales.length > 0 && (
                    <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
                        <div className="text-sm text-muted-foreground">
                            Mostrando <span className="font-medium text-foreground">{Math.min(((currentPage - 1) * itemsPerPage) + 1, filteredSales.length)}</span> a <span className="font-medium text-foreground">{Math.min(currentPage * itemsPerPage, filteredSales.length)}</span> de <span className="font-medium text-foreground">{filteredSales.length}</span> resultados
                        </div>

                        <div className="flex items-center space-x-6 lg:space-x-8">
                            <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium">Linhas por página</p>
                                <select
                                    className="h-8 w-[70px] rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={itemsPerPage.toString()}
                                    onChange={(e) => handleItemsPerPageChange(e.target.value)}
                                >
                                    <option value="10">10</option>
                                    <option value="20">20</option>
                                    <option value="50">50</option>
                                </select>
                            </div>
                            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                                Página {currentPage} de {totalPages || 1}
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={handlePrevPage}
                                    disabled={currentPage === 1}
                                >
                                    <span className="sr-only">Voltar página</span>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={handleNextPage}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                >
                                    <span className="sr-only">Próxima página</span>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Card>

            {/* Add Sale Modal */}
            <AddSaleModal
                isOpen={isAddModalOpen}
                onOpenChange={setIsAddModalOpen}
                onAddSale={addSale}
            />

            {/* Edit Sale Modal */}
            <EditSaleModal
                sale={editingSale}
                isOpen={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                onUpdateSale={updateSale}
            />

            {/* Edit Goal Modal */}
            <Dialog open={isEditGoalOpen} onOpenChange={setIsEditGoalOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Editar Meta Mensal</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={goalInput}
                            onChange={(e) => setGoalInput(e.target.value)}
                            placeholder="Ex: 50000"
                            className="text-lg"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditGoalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveGoal}>Salvar Meta</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
