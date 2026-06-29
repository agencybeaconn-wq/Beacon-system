import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from "recharts";
import { formatCurrencyBRL } from "@/lib/formatters";

/**
 * Cada ponto do gráfico de desempenho (1 por hora ou 1 por dia, conforme dateFilter).
 *
 * - `spend`/`bestRevenue` são os valores reais em BRL (já convertidos via FX).
 * - `_spacer` é um valor invisível entre as barras empilhadas pra criar gap visual.
 * - `_isGhost`/`_ghostHeight` desenham barras cinzas placeholder pras horas/dias
 *   futuros do período (ex: ainda não chegou a hora ou o mês não fechou).
 */
export interface ChartDatum {
    date: string;
    fullDate?: string;
    spend?: number;
    revenue?: number;
    bestRevenue?: number;
    externalCosts?: number;
    profit?: number;
    roas?: number;
    conversions?: number;
    _spacer?: number;
    _isGhost?: boolean;
    _ghostHeight?: number;
}

interface Props {
    /** Dados pra plotar — quando vazio, mostra placeholder cinza com dummy data. */
    data: ChartDatum[];
    /** Skeleton overlay enquanto a 1ª fetch acontece. */
    isLoading?: boolean;
    /**
     * Quando false (cliente sem ad accounts Meta), esconde a barra vermelha de spend,
     * remove "Custo (Ads)" da legenda e do tooltip. Mantém só a barra verde de
     * Faturamento. Default true.
     */
    hasMeta?: boolean;
}

/**
 * Placeholder usado quando ainda não há dados reais — exibido em opacidade reduzida
 * só pra preencher o espaço visual.
 */
const PLACEHOLDER_DATA: ChartDatum[] = [
    { date: "Segunda", bestRevenue: 1500, spend: 300, _spacer: 120 },
    { date: "Terça", bestRevenue: 2800, spend: 500, _spacer: 120 },
    { date: "Quarta", bestRevenue: 1900, spend: 350, _spacer: 120 },
    { date: "Quinta", bestRevenue: 4200, spend: 800, _spacer: 120 },
    { date: "Sexta", bestRevenue: 5100, spend: 900, _spacer: 120 },
    { date: "Sábado", bestRevenue: 6000, spend: 1100, _spacer: 120 },
    { date: "Domingo", bestRevenue: 3500, spend: 600, _spacer: 120 },
];

interface TooltipPayload {
    payload?: ChartDatum;
    dataKey?: string;
    value?: number;
}

/**
 * Tooltip custom — escondido quando a barra é ghost (futuro do período).
 * Quando `hasMeta=false`, omite Custo (Ads) e ROAS porque cliente não tem ads vinculados.
 */
function ChartTooltip({
    active,
    payload,
    label,
    hasMeta = true,
}: Readonly<{ active?: boolean; payload?: TooltipPayload[]; label?: string; hasMeta?: boolean }>) {
    if (!active || !payload || payload.length === 0) return null;
    if (payload[0]?.payload?._isGhost) return null;

    const spend = (payload.find((p) => p.dataKey === "spend")?.value as number) || 0;
    const revenue = (payload.find((p) => p.dataKey === "bestRevenue")?.value as number) || 0;
    const roas = spend > 0 ? (revenue / spend).toFixed(2) : "—";

    return (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/95 px-5 py-4 shadow-2xl min-w-[180px]">
            <p className="mb-3 text-[11px] font-semibold text-neutral-500 tracking-wide">📅 {label}</p>
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#4ead6b]" />
                        <span className="text-xs text-neutral-400">Faturamento</span>
                    </div>
                    <span className="text-[13px] font-bold text-[#4ead6b] tabular-nums">
                        {formatCurrencyBRL(revenue)}
                    </span>
                </div>
                {hasMeta && (
                    <>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-[#d94040]" />
                                <span className="text-xs text-neutral-400">Custo (Ads)</span>
                            </div>
                            <span className="text-[13px] font-bold text-[#d94040] tabular-nums">
                                {formatCurrencyBRL(spend)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-neutral-800 pt-2 mt-1">
                            <span className="text-[11px] text-neutral-500">ROAS</span>
                            <span className="text-[13px] font-bold text-white tabular-nums">{roas}x</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

/** Skeleton com 12 barras pulsando — sobrepõe o gráfico durante a 1ª fetch. */
function ChartSkeleton() {
    return (
        <div className="absolute inset-0 z-20 flex items-end justify-around gap-2 px-14 pb-8 animate-in fade-in duration-300">
            {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex flex-1 flex-col items-stretch gap-1 max-w-[40px]">
                    <div
                        className="rounded-md bg-muted/30 animate-pulse"
                        style={{ height: `${50 + (i * 17) % 150}px`, animationDelay: `${i * 80}ms` }}
                    />
                    <div
                        className="rounded-md bg-muted/20 animate-pulse"
                        style={{ height: `${15 + (i * 7) % 30}px`, animationDelay: `${i * 80 + 40}ms` }}
                    />
                </div>
            ))}
        </div>
    );
}

/**
 * Bloco "Desempenho no Período" — BarChart empilhado de Custo (Ads) e Faturamento.
 *
 * Decisões de design:
 *  - Empilhamento `_ghostHeight` → `spend` → `_spacer` → `bestRevenue` cria o efeito
 *    "custo embaixo, gap visual, faturamento em cima" sem 2 BarCharts separados.
 *  - Cores hardcoded (#d94040, #4ead6b) por consistência com o design Lever — não
 *    mudam por tema. Se trocar tema, atualizar aqui também.
 *  - Container 340px é proposital pra caber comfortably na grid lg:col-span-3.
 */
export function PerformanceChart({ data, isLoading = false, hasMeta = true }: Readonly<Props>) {
    const chartData = data.length > 0 ? data : PLACEHOLDER_DATA;
    const isEmpty = data.length === 0;

    return (
        <Card className="bg-card border border-border/50 rounded-2xl pb-2 relative overflow-hidden shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2 z-10 relative">
                <CardTitle className="text-base font-bold capitalize text-foreground">Desempenho no Período</CardTitle>
                <div className="flex items-center gap-4 text-[10px]">
                    {hasMeta && (
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#d94040]" />
                            <span className="text-muted-foreground">Custo (Ads)</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#4ead6b]" />
                        <span className="text-muted-foreground">Faturamento</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6 z-10 relative">
                <div className="h-[340px] w-full text-xs relative">
                    {isLoading && <ChartSkeleton />}
                    <div
                        className={`h-full w-full transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                barCategoryGap="12%"
                                maxBarSize={48}
                                className={isEmpty ? "opacity-30 grayscale" : ""}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="currentColor"
                                    strokeOpacity={0.04}
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="date"
                                    stroke="currentColor"
                                    strokeOpacity={0.2}
                                    tickLine={false}
                                    axisLine={false}
                                    fontSize={10}
                                    tickMargin={10}
                                />
                                <YAxis
                                    stroke="currentColor"
                                    strokeOpacity={0.2}
                                    tickLine={false}
                                    axisLine={false}
                                    fontSize={10}
                                    tickFormatter={(value: number) =>
                                        value >= 1000 ? `R$ ${(value / 1000).toFixed(1)}k` : `R$ ${value.toFixed(0)}`
                                    }
                                    width={55}
                                />
                                <RechartsTooltip
                                    cursor={{ fill: "currentColor", fillOpacity: 0.03, radius: 6 }}
                                    content={<ChartTooltip hasMeta={hasMeta} />}
                                />
                                <Bar
                                    dataKey="_ghostHeight"
                                    name="_ghostHeight"
                                    stackId="stack"
                                    fill="currentColor"
                                    fillOpacity={0.04}
                                    radius={[6, 6, 6, 6]}
                                />
                                {hasMeta && (
                                    <Bar
                                        dataKey="spend"
                                        name="spend"
                                        stackId="stack"
                                        fill="#d94040"
                                        radius={[6, 6, 6, 6]}
                                        animationDuration={600}
                                        animationEasing="ease-out"
                                    />
                                )}
                                {hasMeta && (
                                    <Bar
                                        dataKey="_spacer"
                                        name="_spacer"
                                        stackId="stack"
                                        fill="transparent"
                                        radius={[0, 0, 0, 0]}
                                    />
                                )}
                                <Bar
                                    dataKey="bestRevenue"
                                    name="bestRevenue"
                                    stackId="stack"
                                    fill="#4ead6b"
                                    radius={[6, 6, 6, 6]}
                                    animationDuration={600}
                                    animationEasing="ease-out"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
