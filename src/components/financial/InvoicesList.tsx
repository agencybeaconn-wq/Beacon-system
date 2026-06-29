import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle2, Clock, Upload, ExternalLink, MoreVertical, Plus, TrendingUp, AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientInvoice } from "@/hooks/useFinancials";
import { Client } from "@/types/lever-os";
import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import { formatCurrencyBRL as formatCurrency } from "@/lib/formatters";

interface InvoicesListProps {
    invoices: ClientInvoice[];
    clients?: Client[];
    onUpdateStatus: (id: string, status: 'paid' | 'pending' | 'overdue') => void;
}

export function InvoicesList({ invoices, clients, onUpdateStatus }: InvoicesListProps) {
    const stats = useMemo(() => {
        const safeInvoices = invoices || [];
        const total = safeInvoices.reduce((acc, i) => acc + (i.amount || 0), 0);
        const paid = safeInvoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + (i.amount || 0), 0);
        const pending = safeInvoices.filter(i => i.status !== 'paid').reduce((acc, i) => acc + (i.amount || 0), 0);
        return { total, paid, pending };
    }, [invoices]);

    return (
        <div className="space-y-6">
            {/* Stats Summary Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-background/50 border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <TrendingUp className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total a Receber</p>
                            <p className="text-lg font-bold">{formatCurrency(stats.total)}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4 bg-background/50 border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Check className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Recebido</p>
                            <p className="text-lg font-bold">{formatCurrency(stats.paid)}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4 bg-background/50 border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Pendente</p>
                            <p className="text-lg font-bold">{formatCurrency(stats.pending)}</p>
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="border border-border/50 bg-background/50 overflow-hidden">
                <div className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold">Gestão de Faturas (Contas a Receber)</h3>
                            <p className="text-xs text-muted-foreground">Acompanhe o status dos depósitos e anexe comprovantes.</p>
                        </div>
                    </div>

                    <div className="rounded-md border border-border/50">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-left font-bold border-r border-border/50">Cliente</TableHead>
                                    <TableHead className="text-left font-bold border-r border-border/50">Vencimento</TableHead>
                                    <TableHead className="text-left font-bold border-r border-border/50">Valor</TableHead>
                                    <TableHead className="text-left font-bold border-r border-border/50">Status</TableHead>
                                    <TableHead className="text-left font-bold border-r border-border/50">Comprovante</TableHead>
                                    <TableHead className="text-left font-bold">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-2 opacity-40">
                                                <FileText className="h-8 w-8" />
                                                <p className="text-sm">Nenhuma fatura gerada para este período.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    invoices.map((invoice) => (
                                        <TableRow key={invoice.id} className="group hover:bg-muted/50 transition-colors">
                                            <TableCell className="font-bold text-left border-r border-border/50">{invoice.client_name || 'Cliente'}</TableCell>
                                            <TableCell className="text-left text-muted-foreground text-sm border-r border-border/50">
                                                {(() => {
                                                    if (!invoice.due_date) return "-";
                                                    try {
                                                        const originalDate = parseISO(invoice.due_date);
                                                        if (isNaN(originalDate.getTime())) return "Data Inválida";

                                                        const client = clients?.find(c => c.id === invoice.client_id);
                                                        const dueDay = client?.payment_due_day || 5;

                                                        const fixedDate = new Date(originalDate.getFullYear(), originalDate.getMonth(), dueDay);
                                                        return format(fixedDate, 'dd/MM/yyyy');
                                                    } catch (e) {
                                                        console.error('[InvoicesList] Date format error:', e);
                                                        return "Erro na Data";
                                                    }
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-left font-bold text-foreground border-r border-border/50">
                                                {formatCurrency(invoice.amount)}
                                            </TableCell>
                                            <TableCell className="text-left border-r border-border/50">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "border-none flex w-fit items-center gap-1.5 font-bold",
                                                        invoice.status === 'paid' ? "bg-emerald-500/10 text-emerald-500" :
                                                            invoice.status === 'overdue' ? "bg-destructive/10 text-destructive" :
                                                                "bg-amber-500/10 text-amber-500"
                                                    )}
                                                >
                                                    {invoice.status === 'paid' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                    {invoice.status === 'paid' ? 'PAGO' :
                                                        invoice.status === 'overdue' ? 'ATRASADO' : 'PENDENTE'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-left border-r border-border/50">
                                                <Button variant="ghost" size="sm" className="h-8 text-[10px] gap-2 text-muted-foreground hover:text-primary">
                                                    <Upload className="h-3 w-3" />
                                                    Anexar
                                                </Button>
                                            </TableCell>
                                            <TableCell className="text-left">
                                                <div className="flex justify-start gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className={cn(
                                                            "h-8 text-xs",
                                                            invoice.status === 'paid' ? "text-amber-500 hover:bg-amber-500/10" : "text-emerald-500 hover:bg-emerald-500/10"
                                                        )}
                                                        onClick={() => onUpdateStatus(invoice.id, invoice.status === 'paid' ? 'pending' : 'paid')}
                                                    >
                                                        {invoice.status === 'paid' ? 'Pendenciar' : 'Marcar como Pago'}
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </Card>
        </div>
    );
}
