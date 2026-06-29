import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
    Plus,
    MoreHorizontal,
    Trash2,
    CheckCircle2,
    Clock,
    FileText,
    DollarSign,
    Package,
    Pencil,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useOneOffReceivables, OneOffReceivable } from "@/hooks/useOneOffReceivables";
import { AddOneOffReceivableModal } from "./AddOneOffReceivableModal";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";

interface OneOffReceivablesTabProps {
    isLoading: boolean;
    receivables: OneOffReceivable[];
    summary: { totalPending: number; totalPaid: number; totalInvoiced: number; totalReceived: number };
    addReceivable: (receivable: Omit<OneOffReceivable, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>) => Promise<any>;
    updateReceivable: (id: string, updates: Partial<OneOffReceivable>) => Promise<any>;
    deleteReceivable: (id: string) => Promise<any>;
}

export function OneOffReceivablesTab({
    isLoading,
    receivables,
    summary,
    addReceivable,
    updateReceivable,
    deleteReceivable
}: OneOffReceivablesTabProps) {

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReceivable, setEditingReceivable] = useState<OneOffReceivable | null>(null);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const handleEdit = (receivable: OneOffReceivable) => {
        setEditingReceivable(receivable);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingReceivable(null);
        setIsModalOpen(true);
    };

    // Pagination logic
    const totalPages = Math.ceil((receivables?.length || 0) / itemsPerPage);
    const paginatedReceivables = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return (receivables || []).slice(start, end);
    }, [receivables, currentPage, itemsPerPage]);

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

    const getStatusBadge = (status: string) => {
        if (status === 'paid') {
            return (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-none font-bold py-0.5 px-2">
                    PAGO
                </Badge>
            );
        }
        if (status === 'parcial') {
            return (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-none font-bold py-0.5 px-2">
                    PARCIAL
                </Badge>
            );
        }
        return (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-none font-bold py-0.5 px-2">
                PENDENTE
            </Badge>
        );
    };

    const getPaymentMethodLabel = (method: string | null) => {
        const labels: Record<string, string> = {
            pix: 'PIX',
            cartao: 'Cartão',
            boleto: 'Boleto',
            transferencia: 'Transf.',
            dinheiro: 'Dinheiro',
            outro: 'Outro'
        };
        return labels[method || ''] || method || '-';
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-3 bg-background border border-border/50 hover:border-amber-500/50 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Total a Receber (Avulso)</span>
                        <Clock className="h-3 w-3 text-amber-500" />
                    </div>
                    <div className="mt-1">
                        <span className="text-base font-bold text-amber-500">{formatCurrency(summary.totalPending)}</span>
                    </div>
                </Card>

                <Card className="p-3 bg-background border border-border/50 hover:border-emerald-500/50 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Já Recebido (Avulso)</span>
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    </div>
                    <div className="mt-1">
                        <span className="text-base font-bold text-emerald-500">{formatCurrency(summary.totalReceived || 0)}</span>
                    </div>
                </Card>

                <Card className="p-3 bg-background border border-border/50 hover:border-blue-500/50 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground capitalize tracking-tight">Total Faturado (Avulso)</span>
                        <FileText className="h-3 w-3 text-blue-500" />
                    </div>
                    <div className="mt-1">
                        <span className="text-base font-bold">{formatCurrency(summary.totalInvoiced || 0)}</span>
                    </div>
                </Card>

            </div>

            <Card className="border border-border/50 bg-background/50 overflow-hidden">
                <div className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[200px]">Cliente</TableHead>
                                <TableHead>Serviço</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead>Vencimento</TableHead>
                                <TableHead>Método</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : receivables.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                            <Package className="h-10 w-10 opacity-20" />
                                            <p className="text-sm">Nenhum recebível avulso registrado.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedReceivables.map((record) => (
                                    <TableRow key={record.id} className="group hover:bg-white/[0.02] transition-colors">
                                        <TableCell className="font-semibold text-foreground">
                                            {record.client_name}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-3 w-3 text-muted-foreground" />
                                                <div className="flex flex-col">
                                                    <span className="text-xs">{record.service}</span>
                                                    {(record as any)._is_sale_record && (
                                                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider opacity-70 mt-0.5">
                                                            Venda Sincronizada
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-bold text-emerald-500">
                                            <div className="flex flex-col">
                                                <span>{formatCurrency(record.amount)}</span>
                                                {record.status === 'parcial' && (
                                                    <span className="text-[10px] text-blue-500 font-bold uppercase mt-1">
                                                        Entrada: {formatCurrency(record.entry_amount || 0)}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-medium">
                                            <div className="flex flex-col">
                                                <span>{format(parseISO(record.due_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                                                {record.status === 'parcial' && record.balance_due_date && (
                                                    <span className="text-[10px] text-muted-foreground mt-1">
                                                        Saldo: {format(parseISO(record.balance_due_date), "dd/MM")}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {getPaymentMethodLabel(record.payment_method)}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="focus:outline-none">
                                                        {getStatusBadge(record.status)}
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-background border-white/10">
                                                    <DropdownMenuItem
                                                        onClick={() => updateReceivable(record.id, { status: 'pending' })}
                                                        className="gap-2"
                                                    >
                                                        <Clock className="h-4 w-4 text-amber-500" />
                                                        Marcar como Pendente
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleEdit(record)}
                                                        className="gap-2"
                                                    >
                                                        <DollarSign className="h-4 w-4 text-blue-500" />
                                                        Marcar Parcial...
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => updateReceivable(record.id, { status: 'paid' })}
                                                        className="gap-2"
                                                    >
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                        Marcar como Pago
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-background border-white/10">
                                                    <DropdownMenuItem
                                                        onClick={() => handleEdit(record)}
                                                        className="gap-2"
                                                    >
                                                        <Pencil className="h-4 w-4 text-primary" />
                                                        Editar Registro
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => deleteReceivable(record.id)}
                                                        className="text-destructive gap-2"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Remover Registro
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    {/* Pagination Controls */}
                    {!isLoading && receivables.length > 0 && (
                        <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
                            <div className="text-sm text-muted-foreground">
                                Mostrando <span className="font-medium text-foreground">{Math.min(((currentPage - 1) * itemsPerPage) + 1, receivables.length)}</span> a <span className="font-medium text-foreground">{Math.min(currentPage * itemsPerPage, receivables.length)}</span> de <span className="font-medium text-foreground">{receivables.length}</span> resultados
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
                </div>
            </Card>

            <AddOneOffReceivableModal
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
                onAdd={addReceivable}
                onUpdate={updateReceivable}
                initialData={editingReceivable}
            />
        </div>
    );
}
