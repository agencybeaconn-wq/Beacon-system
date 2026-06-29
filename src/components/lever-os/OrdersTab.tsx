import React, { useMemo, useEffect } from 'react';
import { useShopifyOrders, ShopifyOrder } from '@/hooks/useShopifyOrders';
import { useCartPandaOrders } from '@/hooks/useCartPandaOrders';
import { useDashboard, useSelectedClient } from '@/contexts/DashboardContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, RefreshCw, AlertCircle, Package, Calendar as CalendarIcon, Loader2, Store } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";

interface OrdersTabProps {
    clientId: string;
}

export function OrdersTab({ clientId }: OrdersTabProps) {
    const { dateFilter, dateRange, setDateFilter, setDateRange, getDateRangeForAPI, dateFilterLabel } = useDashboard();
    const { clientData } = useSelectedClient();

    const shopifyConnected = (clientData as any)?.shopify_status === 'connected';
    const cartpandaConnected = (clientData as any)?.cartpanda_status === 'connected';

    // Shopify orders
    const shopify = useShopifyOrders();

    // CartPanda orders (only when Shopify is NOT connected)
    const apiDateRange = useMemo(() => getDateRangeForAPI(), [getDateRangeForAPI]);
    const cartpanda = useCartPandaOrders(apiDateRange, shopifyConnected ? undefined : clientId);

    // Fetch Shopify orders when connected
    useEffect(() => {
        if (shopifyConnected && clientId) {
            const range = getDateRangeForAPI();
            shopify.fetchOrders(clientId, range?.startDate, range?.endDate);
        }
    }, [shopifyConnected, clientId, dateFilter, dateRange]);

    // Determine which source to use (Shopify priority)
    const useShopify = shopifyConnected;
    const isLoading = useShopify ? shopify.isLoading : cartpanda.isLoading;
    const error = useShopify ? shopify.error : cartpanda.error;
    const source = useShopify ? 'Shopify' : 'CartPanda';

    // Normalize orders to common format
    const orders = useMemo(() => {
        if (useShopify) {
            return shopify.orders.map(o => ({
                id: o.id,
                orderNumber: o.orderNumber,
                totalPrice: o.totalPrice,
                status: o.financialStatus,
                customerName: o.customerName,
                customerEmail: o.customerEmail,
                createdAt: o.createdAt,
            }));
        }
        return cartpanda.orders.map(o => ({
            id: o.id,
            orderNumber: o.orderNumber,
            totalPrice: o.totalPrice,
            status: o.paymentStatus,
            customerName: o.customerName,
            customerEmail: o.customerEmail,
            createdAt: o.createdAt,
        }));
    }, [useShopify, shopify.orders, cartpanda.orders]);

    const summary = useShopify ? shopify.summary : cartpanda.summary;

    const [currentPage, setCurrentPage] = React.useState(1);
    const ordersPerPage = 25;
    const totalPages = Math.ceil(orders.length / ordersPerPage);
    const paginatedOrders = orders.slice((currentPage - 1) * ordersPerPage, currentPage * ordersPerPage);

    React.useEffect(() => { setCurrentPage(1); }, [orders]);

    const handleRefresh = () => {
        if (useShopify) {
            const range = getDateRangeForAPI();
            shopify.fetchOrders(clientId, range.startDate, range.endDate);
        } else {
            cartpanda.refetch();
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Pago</Badge>;
            case 'pending':
            case 'authorized':
                return <Badge variant="outline" className="text-amber-500 border-amber-500/20">Pendente</Badge>;
            case 'refunded':
            case 'partially_refunded':
                return <Badge variant="outline" className="text-blue-500 border-blue-500/20">Reembolsado</Badge>;
            case 'voided':
            case 'cancelled':
                return <Badge variant="destructive">Cancelado</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    // Not connected to any source
    if (!shopifyConnected && !cartpandaConnected && !isLoading) {
        return (
            <Card className="border-dashed">
                <CardHeader className="text-center">
                    <Store className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <CardTitle>Nenhuma loja conectada</CardTitle>
                    <CardDescription>
                        Conecte a Shopify ou CartPanda na aba "Conexões" para visualizar os pedidos.
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

            {/* Date Filter */}
            <div className="flex items-center gap-2">
                {(['today', '7d', '30d'] as const).map((filter) => {
                    const labels = { today: 'Hoje', '7d': '7 dias', '30d': 'Mês' };
                    return (
                        <Button
                            key={filter}
                            variant={dateFilter === filter ? 'default' : 'outline'}
                            size="sm"
                            className={cn("h-8 text-xs font-semibold", dateFilter === filter && "bg-primary")}
                            onClick={() => setDateFilter(filter as any)}
                        >
                            {labels[filter]}
                        </Button>
                    );
                })}
            </div>

            {/* Orders Table */}
            <Card>
                <CardContent className="pt-6">
                    {isLoading && orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            <p className="text-sm text-muted-foreground font-medium italic">Buscando pedidos via {source}...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                            <h3 className="font-semibold text-lg">Erro na Sincronização</h3>
                            <p className="text-muted-foreground max-w-md mx-auto mb-6">{error}</p>
                            <Button variant="outline" onClick={handleRefresh}>Tentar novamente</Button>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Package className="w-12 h-12 text-muted-foreground mb-4" />
                            <h3 className="font-semibold text-lg">Nenhum pedido encontrado</h3>
                            <p className="text-muted-foreground max-w-md mx-auto">
                                Não encontramos pedidos para o período selecionado.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    Pedidos pagos no período: <span className="font-medium text-foreground">{dateFilterLabel}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] gap-1">
                                        <Store className="w-3 h-3" />
                                        {source}
                                    </Badge>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} disabled={isLoading}>
                                        <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                                    </Button>
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
                                                <TableCell className="font-medium">{order.orderNumber}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm">{order.customerName}</span>
                                                        <span className="text-[10px] text-muted-foreground">{order.customerEmail}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getStatusBadge(order.status)}</TableCell>
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

                            {totalPages > 1 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 border-t mt-4">
                                    <div className="text-sm text-muted-foreground">
                                        Exibindo {(currentPage - 1) * ordersPerPage + 1} a {Math.min(currentPage * ordersPerPage, orders.length)} de {orders.length} pedidos
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button>
                                        <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
                                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Próximo</Button>
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
