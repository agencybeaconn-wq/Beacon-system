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
import { AcademyExpense } from "@/hooks/useAcademyFinancials";
import { AddAcademyExpenseModal } from "./AddAcademyExpenseModal";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";

interface AcademyExpensesTabProps {
    isLoading: boolean;
    expenses: AcademyExpense[];
    monthReference: string;
    addExpense: (expense: Omit<AcademyExpense, 'id' | 'workspace_id' | 'created_at'>) => Promise<any>;
    updateExpense: (id: string, updates: Partial<AcademyExpense>) => Promise<any>;
    deleteExpense: (id: string) => Promise<any>;
}

const categoryLabels: Record<string, string> = {
    plataforma: 'Plataforma',
    marketing: 'Marketing',
    professor: 'Professor',
    material: 'Material',
    infraestrutura: 'Infraestrutura',
    outro: 'Outro',
};

export function AcademyExpensesTab({
    isLoading,
    expenses,
    monthReference,
    addExpense,
    updateExpense,
    deleteExpense
}: AcademyExpensesTabProps) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    const totalPages = Math.ceil(expenses.length / itemsPerPage);
    const paginatedExpenses = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return expenses.slice(start, start + itemsPerPage);
    }, [expenses, currentPage, itemsPerPage]);

    const handleMarkPaid = async (id: string) => {
        await updateExpense(id, {
            status: 'paid',
            payment_date: format(new Date(), 'yyyy-MM-dd')
        });
    };

    const handleDelete = async () => {
        if (deleteId) {
            await deleteExpense(deleteId);
            setDeleteId(null);
        }
    };

    const stats = useMemo(() => {
        const total = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
        const paid = expenses.filter(e => e.status === 'paid').reduce((acc, e) => acc + (e.amount || 0), 0);
        const pending = total - paid;
        const fixed = expenses.filter(e => e.recurrence_type === 'fixed').reduce((acc, e) => acc + (e.amount || 0), 0);
        const variable = expenses.filter(e => e.recurrence_type === 'variable').reduce((acc, e) => acc + (e.amount || 0), 0);
        return { total, paid, pending, fixed, variable };
    }, [expenses]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Despesas Academy</h3>
                <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="h-8">
                    <Plus className="h-4 w-4 mr-1" />
                    Nova Despesa
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="p-3 bg-background border border-border/50">
                    <span className="text-[10px] font-bold text-muted-foreground">TOTAL</span>
                    <p className="text-base font-bold mt-1">{formatCurrency(stats.total)}</p>
                </Card>
                <Card className="p-3 bg-background border border-border/50">
                    <span className="text-[10px] font-bold text-muted-foreground">FIXAS</span>
                    <p className="text-base font-bold mt-1 text-blue-500">{formatCurrency(stats.fixed)}</p>
                </Card>
                <Card className="p-3 bg-background border border-border/50">
                    <span className="text-[10px] font-bold text-muted-foreground">VARIÁVEIS</span>
                    <p className="text-base font-bold mt-1 text-amber-500">{formatCurrency(stats.variable)}</p>
                </Card>
                <Card className="p-3 bg-background border border-border/50">
                    <span className="text-[10px] font-bold text-muted-foreground">PENDENTES</span>
                    <p className="text-base font-bold mt-1 text-destructive">{formatCurrency(stats.pending)}</p>
                </Card>
            </div>

            <Card className="border border-border/50 bg-background/50 overflow-hidden">
                <Table className="table-fixed">
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[25%] text-left pl-6 border-r border-border/50">Descrição</TableHead>
                            <TableHead className="w-[13%] text-left border-r border-border/50">Valor</TableHead>
                            <TableHead className="w-[13%] text-left border-r border-border/50">Categoria</TableHead>
                            <TableHead className="w-[12%] text-left border-r border-border/50">Tipo</TableHead>
                            <TableHead className="w-[12%] text-left border-r border-border/50">Status</TableHead>
                            <TableHead className="w-[13%] text-left border-r border-border/50">Vencimento</TableHead>
                            <TableHead className="w-[12%] text-left pr-6">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    Carregando...
                                </TableCell>
                            </TableRow>
                        ) : paginatedExpenses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    Nenhuma despesa registrada no período.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedExpenses.map((exp) => (
                                <TableRow key={exp.id} className="group hover:bg-muted/50 transition-colors">
                                    <TableCell className="font-medium text-left pl-6 border-r border-border/50 truncate">
                                        {exp.description}
                                    </TableCell>
                                    <TableCell className="text-left font-bold text-destructive border-r border-border/50">
                                        {formatCurrency(exp.amount)}
                                    </TableCell>
                                    <TableCell className="text-left border-r border-border/50 text-xs">
                                        {categoryLabels[exp.category] || exp.category}
                                    </TableCell>
                                    <TableCell className="text-left border-r border-border/50 text-xs">
                                        {exp.recurrence_type === 'fixed' ? (
                                            <Badge variant="outline" className="border-none bg-blue-500/10 text-blue-500 font-bold px-2 py-0 h-5">FIXO</Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-none bg-amber-500/10 text-amber-500 font-bold px-2 py-0 h-5">VARIÁVEL</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-left border-r border-border/50">
                                        {exp.status === 'paid' ? (
                                            <Badge variant="outline" className="border-none bg-emerald-500/10 text-emerald-500 font-bold px-2 py-0 h-5">PAGO</Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-none bg-amber-500/10 text-amber-500 font-bold px-2 py-0 h-5">PENDENTE</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-left border-r border-border/50 text-xs">
                                        {format(parseISO(exp.due_date), 'dd/MM/yy')}
                                    </TableCell>
                                    <TableCell className="text-left pr-6">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {exp.status === 'pending' && (
                                                    <DropdownMenuItem onClick={() => handleMarkPaid(exp.id)}>
                                                        <Check className="h-4 w-4 mr-2" />
                                                        Marcar como Pago
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => setDeleteId(exp.id)}
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

                {expenses.length > 0 && (
                    <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
                        <div className="text-sm text-muted-foreground">
                            Mostrando <span className="font-medium text-foreground">{Math.min(((currentPage - 1) * itemsPerPage) + 1, expenses.length)}</span> a <span className="font-medium text-foreground">{Math.min(currentPage * itemsPerPage, expenses.length)}</span> de <span className="font-medium text-foreground">{expenses.length}</span>
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

            <AddAcademyExpenseModal
                isOpen={isAddModalOpen}
                onOpenChange={setIsAddModalOpen}
                onAdd={addExpense}
                monthReference={monthReference}
            />

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A despesa será permanentemente removida.
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
