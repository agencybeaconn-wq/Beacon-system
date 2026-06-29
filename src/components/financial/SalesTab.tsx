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
    ChevronRight
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

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const handleSaveGoal = async () => {
        const amount = parseFloat(goalInput.replace(",", ".")) || 0;
        await updateGoal(amount);
        setIsEditGoalOpen(false);
        setGoalInput("");
    };

    // Pagination logic
    const totalPages = Math.ceil((sales?.length || 0) / itemsPerPage);
    const paginatedSales = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return (sales || []).slice(start, end);
    }, [sales, currentPage, itemsPerPage]);

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

    // Progress bar percentage (capped at 100 for visual)
    const progressWidth = Math.min(summary.goalPercentage, 100);

    return (
        <div className="space-y-6">
            {/* Goal Tracking Section */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Left: Meta Mensal */}
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
                </Card>

                {/* Right: Progress */}
                <Card className="p-6 bg-background border border-border/50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            {summary.isAboveGoal ? (
                                <TrendingUp className="h-5 w-5 text-emerald-500" />
                            ) : (
                                <TrendingDown className="h-5 w-5 text-amber-500" />
                            )}
                            <span className="font-semibold">Progresso</span>
                        </div>
                        <Badge
                            className={cn(
                                "border-none",
                                summary.isAboveGoal
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : "bg-amber-500/10 text-amber-500"
                            )}
                        >
                            {summary.goalPercentage.toFixed(1)}%
                        </Badge>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total Vendido</span>
                            <span className="font-semibold">{formatCurrency(summary.totalSold)}</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    summary.isAboveGoal ? "bg-emerald-500" : "bg-amber-500"
                                )}
                                style={{ width: `${progressWidth}%` }}
                            />
                        </div>

                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                                {summary.isAboveGoal ? "Acima da meta" : "Falta para a meta"}
                            </span>
                            <span className={cn(
                                "font-semibold",
                                summary.isAboveGoal ? "text-emerald-500" : "text-amber-500"
                            )}>
                                {summary.isAboveGoal
                                    ? `+${formatCurrency(Math.abs(summary.remainingToGoal))}`
                                    : formatCurrency(summary.remainingToGoal)
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
                        <h3 className="text-lg font-bold">Vendas do Mês</h3>
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
                                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                    <TableCell className="pr-6"></TableCell>
                                </TableRow>
                            ))
                        ) : sales.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                                    Nenhuma venda registrada neste período.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedSales.map((sale) => (
                                <TableRow key={sale.id} className="group hover:bg-muted/50">
                                    <TableCell className="font-medium pl-6 border-r border-border/50">{sale.client_name}</TableCell>
                                    <TableCell className="text-muted-foreground border-r border-border/50">{sale.service || "-"}</TableCell>
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
                {!isLoading && sales.length > 0 && (
                    <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
                        <div className="text-sm text-muted-foreground">
                            Mostrando <span className="font-medium text-foreground">{Math.min(((currentPage - 1) * itemsPerPage) + 1, sales.length)}</span> a <span className="font-medium text-foreground">{Math.min(currentPage * itemsPerPage, sales.length)}</span> de <span className="font-medium text-foreground">{sales.length}</span> resultados
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
