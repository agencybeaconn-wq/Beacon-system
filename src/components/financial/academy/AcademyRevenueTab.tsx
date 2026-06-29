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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Plus,
    MoreHorizontal,
    Check,
    Trash2,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { AcademyRevenue } from "@/hooks/useAcademyFinancials";
import { AddAcademyRevenueModal } from "./AddAcademyRevenueModal";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";

interface AcademyRevenueTabProps {
    isLoading: boolean;
    revenues: AcademyRevenue[];
    monthReference: string;
    addRevenue: (revenue: Omit<AcademyRevenue, 'id' | 'workspace_id' | 'created_at'>) => Promise<any>;
    updateRevenue: (id: string, updates: Partial<AcademyRevenue>) => Promise<any>;
    deleteRevenue: (id: string) => Promise<any>;
}

const categoryLabels: Record<string, string> = {
    curso: 'Curso',
    mentoria: 'Mentoria',
    material: 'Material',
    outro: 'Outro',
};

const paymentMethodLabels: Record<string, string> = {
    pix: 'PIX',
    cartao: 'Cartão',
    boleto: 'Boleto',
    transferencia: 'Transferência',
    dinheiro: 'Dinheiro',
    outro: 'Outro',
};

export function AcademyRevenueTab({
    isLoading,
    revenues,
    monthReference,
    addRevenue,
    updateRevenue,
    deleteRevenue
}: AcademyRevenueTabProps) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    const totalPages = Math.ceil(revenues.length / itemsPerPage);
    const paginatedRevenues = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return revenues.slice(start, start + itemsPerPage);
    }, [revenues, currentPage, itemsPerPage]);

    const handleMarkPaid = async (id: string) => {
        await updateRevenue(id, {
            status: 'pago',
            payment_date: format(new Date(), 'yyyy-MM-dd')
        });
    };

    const handleDelete = async () => {
        if (deleteId) {
            await deleteRevenue(deleteId);
            setDeleteId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Receitas Academy</h3>
                <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="h-8">
                    <Plus className="h-4 w-4 mr-1" />
                    Nova Receita
                </Button>
            </div>

            <Card className="border border-border/50 bg-background/50 overflow-hidden">
                <Table className="table-fixed">
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[22%] text-left pl-6 border-r border-border/50">Descrição</TableHead>
                            <TableHead className="w-[14%] text-left border-r border-border/50">Cliente</TableHead>
                            <TableHead className="w-[12%] text-left border-r border-border/50">Valor</TableHead>
                            <TableHead className="w-[10%] text-left border-r border-border/50">Categoria</TableHead>
                            <TableHead className="w-[10%] text-left border-r border-border/50">Pagamento</TableHead>
                            <TableHead className="w-[10%] text-left border-r border-border/50">Status</TableHead>
                            <TableHead className="w-[12%] text-left border-r border-border/50">Vencimento</TableHead>
                            <TableHead className="w-[10%] text-left pr-6">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                    Carregando...
                                </TableCell>
                            </TableRow>
                        ) : paginatedRevenues.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                    Nenhuma receita registrada no período.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedRevenues.map((rev) => (
                                <TableRow key={rev.id} className="group hover:bg-muted/50 transition-colors">
                                    <TableCell className="font-medium text-left pl-6 border-r border-border/50 truncate">
                                        {rev.description}
                                    </TableCell>
                                    <TableCell className="text-left border-r border-border/50 text-sm truncate">
                                        {rev.client_name || '-'}
                                    </TableCell>
                                    <TableCell className="text-left font-bold text-emerald-500 border-r border-border/50">
                                        {formatCurrency(rev.amount)}
                                    </TableCell>
                                    <TableCell className="text-left border-r border-border/50 text-xs">
                                        {categoryLabels[rev.category] || rev.category}
                                    </TableCell>
                                    <TableCell className="text-left border-r border-border/50 text-xs">
                                        {rev.payment_method ? paymentMethodLabels[rev.payment_method] || rev.payment_method : '-'}
                                    </TableCell>
                                    <TableCell className="text-left border-r border-border/50">
                                        {rev.status === 'pago' ? (
                                            <Badge variant="outline" className="border-none bg-emerald-500/10 text-emerald-500 font-bold px-2 py-0 h-5">
                                                PAGO
                                            </Badge>
                                        ) : rev.status === 'cancelado' ? (
                                            <Badge variant="outline" className="border-none bg-muted text-muted-foreground font-bold px-2 py-0 h-5">
                                                CANCELADO
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-none bg-amber-500/10 text-amber-500 font-bold px-2 py-0 h-5">
                                                PENDENTE
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-left border-r border-border/50 text-xs">
                                        {format(parseISO(rev.due_date), 'dd/MM/yy')}
                                    </TableCell>
                                    <TableCell className="text-left pr-6">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {rev.status === 'pendente' && (
                                                    <DropdownMenuItem onClick={() => handleMarkPaid(rev.id)}>
                                                        <Check className="h-4 w-4 mr-2" />
                                                        Marcar como Pago
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => setDeleteId(rev.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {revenues.length > 0 && (
                    <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
                        <div className="text-sm text-muted-foreground">
                            Mostrando <span className="font-medium text-foreground">{Math.min(((currentPage - 1) * itemsPerPage) + 1, revenues.length)}</span> a <span className="font-medium text-foreground">{Math.min(currentPage * itemsPerPage, revenues.length)}</span> de <span className="font-medium text-foreground">{revenues.length}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="text-sm font-medium">Página {currentPage} de {totalPages || 1}</div>
                            <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage >= totalPages}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            <AddAcademyRevenueModal
                isOpen={isAddModalOpen}
                onOpenChange={setIsAddModalOpen}
                onAdd={addRevenue}
                monthReference={monthReference}
            />

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir receita?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A receita será permanentemente removida.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
