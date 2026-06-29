import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyBRL } from "@/lib/formatters";

/**
 * Subset de campos do `combinedMetrics` consumidos por este bloco.
 * Mantém type-safe sem acoplar à interface gigante (legacy).
 */
export interface InvestmentMetricsInput {
    cpc?: number;
    ctr?: number;
    cpm?: number;
    clicks?: number;
    impressions?: number;
    bestOrders?: number;
    bestCpa?: number;
    bestTicket?: number;
    meta_conversions?: number;
}

interface Props {
    metrics: InvestmentMetricsInput;
    /**
     * Quando false (cliente sem ad accounts Meta), esconde os 5 cards que dependem
     * de dados Meta: CPC, CTR, CPM, CPA, Conversões Meta. Sobram só Vendas Totais
     * e Ticket Médio, que vêm do Shopify/CartPanda.
     */
    hasMeta?: boolean;
}

const DASH = "—";

function formatNumberCompact(value: number): string {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString("pt-BR");
}

/**
 * Bloco "InvestmentMetricsGrid" — mini-cards de métricas de tráfego e vendas.
 *
 * Quando `hasMeta=true` (default): 7 cards — CPC · CTR · CPM · CPA · Vendas Totais
 * · Ticket Médio · Conversões Meta.
 *
 * Quando `hasMeta=false`: só 2 cards (Vendas Totais + Ticket Médio), pois os
 * outros 5 dependem de Meta. Evita exibir "R$ 0,00" enganoso pra clientes
 * só-Shopify.
 *
 * Compartilhado pelas 3 dashboards (admin/funcionário/cliente).
 */
export function InvestmentMetricsGrid({ metrics, hasMeta = true }: Readonly<Props>) {
    const ctrValue = typeof metrics.ctr === "number" ? metrics.ctr : 0;
    const clicksTotal = metrics.clicks || 0;
    const impressionsTotal = metrics.impressions || 0;
    const conversionsTotal = metrics.bestOrders || 0;

    const metaCards = hasMeta
        ? [
              { label: "CPC", value: clicksTotal > 0 ? formatCurrencyBRL(metrics.cpc || 0) : DASH },
              { label: "CTR", value: impressionsTotal > 0 ? `${ctrValue.toFixed(2)}%` : DASH },
              { label: "CPM", value: impressionsTotal > 0 ? formatCurrencyBRL(metrics.cpm || 0) : DASH },
              { label: "CPA", value: conversionsTotal > 0 ? formatCurrencyBRL(metrics.bestCpa || 0) : DASH },
          ]
        : [];

    const shopifyCards = [
        { label: "Vendas Totais", value: formatNumberCompact(metrics.bestOrders || 0) },
        {
            label: "Ticket Médio",
            value: conversionsTotal > 0 ? formatCurrencyBRL(metrics.bestTicket || 0) : DASH,
        },
    ];

    const cards = [
        ...metaCards,
        ...shopifyCards,
        ...(hasMeta ? [{ label: "Conversões Meta", value: formatNumberCompact(metrics.meta_conversions || 0) }] : []),
    ];

    // Grid adaptativo: 7 cards quando tem Meta, 2 quando não tem
    const gridCols = hasMeta ? "lg:grid-cols-7" : "lg:grid-cols-2";

    return (
        <div className={`grid grid-cols-2 md:grid-cols-4 ${gridCols} gap-4`}>
            {cards.map((item) => (
                <Card key={item.label} className="bg-card border border-border/50 rounded-2xl">
                    <CardContent className="px-5 py-3.5 flex flex-col gap-0.5">
                        <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
                        <h3 className="text-xl font-bold font-mono-numbers tracking-tight">{item.value}</h3>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
