import React, { useMemo } from 'react';
import { useCartPandaOrders } from '@/hooks/useCartPandaOrders';
import { useDashboard } from '@/contexts/DashboardContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, RefreshCw, AlertCircle, Package, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

interface CartPandaOrdersTabProps {
    clientId: string;
}

export function CartPandaOrdersTab({ clientId }: CartPandaOrdersTabProps) {
    const { dateFilter, dateRange, setDateFilter, setDateRange, getDateRangeForAPI, dateFilterLabel } = useDashboard();

    // Calculate date range for API
    const apiDateRange = useMemo(() => getDateRangeForAPI(), [getDateRangeForAPI]);

    // Usamos o hook passando o clientId diretamente para garantir que carregue os dados deste cliente
    const { orders, summary, isLoading, error, isConnected, refetch } = useCartPandaOrders(apiDateRange, clientId);

    const [currentPage, setCurrentPage] = React.useState(1);
    const ordersPerPage = 25;

    const totalPages = Math.ceil(orders.length / ordersPerPage);
    const paginatedOrders = orders.slice((currentPage - 1) * ordersPerPage, currentPage * ordersPerPage);

    const handleDateFilterChange = (value: any) => {
        setDateFilter(value);
        if (value !== "custom") {
            setDateRange(undefined);
        }
    };

    const handleCustomRange = (range: DateRange | undefined) => {
        setDateRange(range);
        if (range?.from && range?.to) {
            setDateFilter("custom" as any);
        }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    // Reset pagination when orders change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [orders]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Pago</Badge>;
            case 'pending':
                return <Badge variant="outline" className="text-amber-500 border-amber-500/20">Pendente</Badge>;
            case 'cancelled':
                return <Badge variant="destructive">Cancelado</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    if (!isConnected && !isLoading) {
        return (
            <Card className="border-dashed">
                <CardHeader className="text-center">
                    <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <CardTitle>CartPanda não conectado</CardTitle>
                    <CardDescription>
                        Conecte sua loja CartPanda na aba "Conexões" para visualizar seus pedidos aqui.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-blue-500/5 border-blue-500/10">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-medium text-blue-600 dark:text-blue-400">Total de Pedidos Pagos</CardDescription>
                        <CardTitle className="text-2xl">{summary?.totalOrders || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-emerald-500/5 border-emerald-500/10">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Faturamento Real (Pago)</CardDescription>
                        <CardTitle className="text-2xl">
                            {(summary?.totalRevenue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-blue-500/5 border-blue-500/10">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-medium text-blue-600 dark:text-blue-400">Ticket Médio</CardDescription>
                        <CardTitle className="text-2xl">
                            {(summary?.averageOrderValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Orders Table */}
            <Card>
                <CardContent className="pt-6">
                    {isLoading && orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            <p className="text-sm text-muted-foreground font-medium italic">Buscando dados na API da CartPanda...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                            <h3 className="font-semibold text-lg">Erro na Sincronização</h3>
                            <p className="text-muted-foreground max-w-md mx-auto mb-6">{error}</p>
                            <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Package className="w-12 h-12 text-muted-foreground mb-4" />
                            <h3 className="font-semibold text-lg">Nenhum pedido encontrado</h3>
                            <p className="text-muted-foreground max-w-md mx-auto">
                                Não encontramos pedidos pagos nesta conta para o período selecionado.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    Pedidos pagos no período: <span className="font-medium text-foreground">{dateFilterLabel}</span>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Pedido</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                            <TableHead className="text-right">Data</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedOrders.map((order) => (
                                            <TableRow key={order.id}>
                                                <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm">{order.customerName}</span>
                                                        <span className="text-[10px] text-muted-foreground">{order.customerEmail}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getStatusBadge(order.paymentStatus)}</TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {order.totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-muted-foreground">
                                                    {format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 border-t mt-4">
                                    <div className="text-sm text-muted-foreground">
                                        Exibindo <span className="font-medium text-foreground">{(currentPage - 1) * ordersPerPage + 1}</span> a <span className="font-medium text-foreground">{Math.min(currentPage * ordersPerPage, orders.length)}</span> de <span className="font-medium text-foreground">{orders.length}</span> pedidos
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            disabled={currentPage === 1}
                                        >
                                            Anterior
                                        </Button>
                                        <div className="flex items-center gap-1 mx-2">
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                // Page numbers around current page
                                                let pageNum = 1;
                                                if (totalPages <= 5) pageNum = i + 1;
                                                else if (currentPage <= 3) pageNum = i + 1;
                                                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                                else pageNum = currentPage - 2 + i;

                                                return (
                                                    <Button
                                                        key={pageNum}
                                                        variant={currentPage === pageNum ? "default" : "outline"}
                                                        size="sm"
                                                        className="w-8 h-8 p-0"
                                                        onClick={() => handlePageChange(pageNum)}
                                                    >
                                                        {pageNum}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePageChange(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                        >
                                            Próximo
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
