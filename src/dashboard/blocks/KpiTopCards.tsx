import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyBRL } from "@/lib/formatters";

interface Props {
    revenue: number;
    spend: number;
    roas: number;
    isLoading?: boolean;
    /**
     * Quando false (cliente sem ad accounts Meta vinculadas), os cards de
     * Valor Gasto e ROAS são escondidos — em vez de mostrar R$ 0,00 enganoso.
     * Default true pra preservar comportamento legado.
     */
    hasMeta?: boolean;
}

/**
 * KPIs do topo da dashboard.
 *  - Faturamento Pago: sempre exibido (vem do Shopify/CartPanda)
 *  - Valor Gasto: só quando hasMeta (depende de ad accounts vinculadas)
 *  - ROAS: só quando hasMeta (precisa de spend pra calcular)
 */
export function KpiTopCards({ revenue, spend, roas, isLoading = false, hasMeta = true }: Props) {
    return (
        <>
            <Card className="bg-card border-border text-card-foreground shadow-none rounded-2xl">
                <CardHeader className="pb-1 px-6">
                    <CardTitle className="text-base font-bold text-foreground">Faturamento Pago</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-4 pt-0">
                    {isLoading ? (
                        <Skeleton className="h-8 w-32" />
                    ) : (
                        <h3 className="text-3xl font-bold text-[#34C759] font-mono-numbers tracking-tight">
                            {formatCurrencyBRL(revenue)}
                        </h3>
                    )}
                </CardContent>
            </Card>

            {hasMeta && (
                <>
                    <Card className="bg-card border-border text-card-foreground shadow-none rounded-2xl">
                        <CardHeader className="pb-1 px-6">
                            <CardTitle className="text-base font-bold text-foreground">Valor Gasto</CardTitle>
                        </CardHeader>
                        <CardContent className="px-6 pb-4 pt-0">
                            {isLoading ? (
                                <Skeleton className="h-8 w-24" />
                            ) : (
                                <h3 className="text-3xl font-bold font-mono-numbers tracking-tight text-foreground">
                                    {formatCurrencyBRL(spend)}
                                </h3>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-border text-card-foreground shadow-none rounded-2xl">
                        <CardHeader className="pb-1 px-6">
                            <CardTitle className="text-base font-bold text-foreground">ROAS</CardTitle>
                        </CardHeader>
                        <CardContent className="px-6 pb-4 pt-0">
                            {isLoading ? (
                                <Skeleton className="h-8 w-16" />
                            ) : (
                                <h3 className="text-3xl font-bold font-mono-numbers tracking-tight text-foreground">
                                    {roas.toFixed(2)}x
                                </h3>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </>
    );
}
