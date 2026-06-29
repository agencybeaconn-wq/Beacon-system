import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay, addDays, startOfWeek, endOfWeek, subDays } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Settings } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DailyData {
    date: string;
    fullDate: string;
    spend: number;
    revenue: number;
    profit: number;
    roas: number;
}

interface ProfitCalendarProps {
    data: any[];
    totalProfit: number;
    totalRevenue: number;
    totalSpend: number;
    currentDateFilter: string;
    hourlyData?: any[];
    className?: string;
    onConfigClick?: () => void;
}

export function ProfitCalendar({
    data,
    totalProfit,
    totalRevenue,
    totalSpend,
    currentDateFilter,
    hourlyData,
    className,
    onConfigClick
}: ProfitCalendarProps) {
    const { t, i18n } = useTranslation();
    const currentLocale = i18n.language.startsWith('pt') ? ptBR : enUS;
    // 1. Determine local view mode based on global filter
    const viewMode = useMemo(() => {
        if (currentDateFilter === 'today') return 'today';
        if (currentDateFilter === '7d') return 'week';
        if (typeof currentDateFilter === 'string' && currentDateFilter.includes('custom')) return 'month'; // Or handle custom range
        // Default to month for 'month', 'custom' or others
        return 'month';
    }, [currentDateFilter]);

    // 2. Determine the reference date
    const referenceDate = useMemo(() => {
        if (data && data.length > 0) {
            const lastItem = data[data.length - 1];
            if (lastItem && lastItem.fullDate) {
                const date = new Date(lastItem.fullDate);
                if (!isNaN(date.getTime())) return date;
            }
        }
        return new Date();
    }, [data]);

    // 3. Filter Days based on Derived View Mode
    const calendarDays = useMemo(() => {
        let start: Date, end: Date;

        if (viewMode === 'month') {
            start = startOfMonth(referenceDate);
            end = endOfMonth(referenceDate);
            // Expand to full weeks for grid consistency
            start = startOfWeek(start);
            end = endOfWeek(end);
        } else if (viewMode === 'week') {
            start = startOfWeek(referenceDate);
            end = endOfWeek(referenceDate);
        } else {
            // Today
            start = referenceDate;
            end = referenceDate;
        }

        return eachDayOfInterval({ start, end });
    }, [referenceDate, viewMode]);

    // 4. Map Data
    const dataMap = useMemo(() => {
        const map: Record<string, DailyData> = {};
        data?.forEach(item => {
            const key = item.fullDate ? item.fullDate.split('T')[0] : '';
            if (key) map[key] = item;
        });
        return map;
    }, [data]);

    // 5. Calculate Totals based on VIEW (use props as main source for now based on user request to "merge")
    const viewTotals = useMemo(() => {
        return { profit: totalProfit, revenue: totalRevenue, spend: totalSpend };
    }, [totalProfit, totalRevenue, totalSpend]);


    const formatCurrency = (value: number) => {
        return value.toLocaleString(i18n.language.startsWith('pt') ? "pt-BR" : "en-US", {
            style: "currency",
            currency: i18n.language.startsWith('pt') ? "BRL" : "USD",
            maximumFractionDigits: 0,
        });
    };

    const margin = viewTotals.revenue > 0 ? (viewTotals.profit / viewTotals.revenue) * 100 : 0;

    return (
        <Card className={cn("flex flex-col overflow-hidden border-border/40 shadow-sm", className)}>

            {/* Header Section: Merged Profit Display (No Controls) */}
            <div className="p-6 pb-2 border-b border-border/10 bg-secondary/10 dark:bg-muted/10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                    {/* Left: Total Profit Display */}
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                {t('overview.profit_calendar.estimated_profit', 'Estimated Profit')}
                                {margin > 0 && (
                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] px-1.5 py-0 h-4">
                                        {Math.round(margin)}% {t('overview.profit_calendar.margin', 'Margin')}
                                    </Badge>
                                )}
                            </p>

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                            onClick={onConfigClick}
                                        >
                                            <Settings className="w-3.5 h-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-xs">Configurar Custos e Fixos</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <h2 className="text-2xl font-bold tracking-tight text-emerald-500">
                                {viewTotals.profit.toLocaleString(i18n.language.startsWith('pt') ? "pt-BR" : "en-US", { style: "currency", currency: i18n.language.startsWith('pt') ? "BRL" : "USD" })}
                            </h2>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 capitalize">
                            {!isNaN(referenceDate.getTime()) ? format(referenceDate, "MMMM yyyy", { locale: currentLocale }) : '--'}
                            {viewMode === 'week' && ` (${t('common.week', 'Week')})`}
                            {viewMode === 'today' && ` (${t('common.today', 'Today')})`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Calendar Grid Body */}
            <div className="p-4 flex-1 h-full min-h-0 bg-background overflow-x-auto">
                <div className={cn(
                    "grid gap-px rounded-lg overflow-hidden h-full border",
                    // Improved Visibility for Light Mode
                    "bg-gray-200 border-gray-200 dark:bg-white/5 dark:border-white/5",
                    viewMode === 'today' ? "grid-cols-1 overflow-y-auto" : "grid-cols-7",
                    // Explicit row sizing for month/week: Header Auto, Rest 1fr
                    viewMode !== 'today' && "grid-rows-[auto_1fr]",
                    viewMode === 'week' && "min-w-[600px]",
                    viewMode === 'month' && "min-w-[500px]"
                )} style={{ maxHeight: viewMode === 'today' ? '100%' : 'auto' }}>

                    {/* Headers (Only for Month/Week) */}
                    {viewMode !== 'today' && [
                        t('common.days_short.sun', 'Sun'),
                        t('common.days_short.mon', 'Mon'),
                        t('common.days_short.tue', 'Tue'),
                        t('common.days_short.wed', 'Wed'),
                        t('common.days_short.thu', 'Thu'),
                        t('common.days_short.fri', 'Fri'),
                        t('common.days_short.sat', 'Sat')
                    ].map((day) => (
                        <div key={day} className="bg-secondary/30 dark:bg-white/5 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {day}
                        </div>
                    ))}

                    {/* Today Hourly View */}
                    {viewMode === 'today' && hourlyData ? (
                        <div className="flex flex-col min-h-0 w-full bg-background">
                            {hourlyData.map((hourItem) => {
                                const profit = hourItem.profit || (hourItem.revenue - hourItem.spend) || 0;
                                const isPositive = profit >= 0;

                                return (
                                    <div key={hourItem.date} className="flex items-center gap-3 p-3 border-b border-border/40 hover:bg-muted/50 transition-colors h-14 shrink-0 w-full">
                                        <span className="text-xs text-muted-foreground w-10 text-right font-medium shrink-0">
                                            {hourItem.date}
                                        </span>
                                        <div className="flex-1 relative h-full flex items-center pr-4"> {/* Added pr-4 for spacing */}
                                            {profit !== 0 ? (
                                                <div className="flex items-center gap-3 w-full">
                                                    <div className={cn(
                                                        "text-sm font-semibold tabular-nums tracking-tight min-w-[80px]",
                                                        isPositive ? "text-emerald-500" : "text-red-500"
                                                    )}>
                                                        {profit.toLocaleString(i18n.language.startsWith('pt') ? "pt-BR" : "en-US", { style: "currency", currency: i18n.language.startsWith('pt') ? "BRL" : "USD" })}
                                                    </div>

                                                    {isPositive && (
                                                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden"> {/* Removed max-w-[240px] */}
                                                            <div
                                                                className="h-full bg-emerald-500 rounded-full"
                                                                // Use a slightly different scale for hourly view or just % of max
                                                                style={{ width: `${Math.min((profit / (totalProfit > 0 ? totalProfit * 0.08 : 1000)) * 100, 100)}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="w-full mx-2 h-2 rounded-full bg-secondary/30 dark:bg-muted/20" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Standard Month/Week Grid with Bars for Week */
                        calendarDays.map((day) => {
                            const dateKey = format(day, 'yyyy-MM-dd');
                            const dayData = dataMap[dateKey];
                            const isCurrentMonth = isSameMonth(day, referenceDate);
                            const isToday = isSameDay(day, new Date());

                            const hasProfit = dayData && dayData.profit > 0;
                            const hasLoss = dayData && dayData.profit < 0;

                            const maxWeekProfit = viewMode === 'week' ? Math.max(...calendarDays.map(d => {
                                const k = format(d, 'yyyy-MM-dd');
                                return dataMap[k]?.profit || 0;
                            }), 1000) : 0;

                            const barHeightPct = viewMode === 'week' && dayData
                                ? Math.min((Math.abs(dayData.profit) / maxWeekProfit) * 100, 100)
                                : 0;

                            const cellHeight = viewMode === 'month' ? "min-h-[55px]" : "min-h-full";

                            return (
                                <div
                                    key={day.toISOString()}
                                    className={cn(
                                        "p-2 flex flex-col transition-colors relative group",
                                        cellHeight,
                                        isCurrentMonth || viewMode !== 'month' ? "bg-background" : "bg-muted/20 opacity-50",
                                        "hover:bg-secondary/50",
                                        viewMode === 'week' ? "justify-end gap-2 pb-4" : "justify-between",
                                        isToday && "ring-1 ring-inset ring-primary/50 bg-primary/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                                    )}
                                >
                                    {/* Date Number + Trend Arrow ALIGNED */}
                                    <div className={cn(
                                        "flex items-center w-full z-20 gap-1.5",
                                        viewMode === 'week' ? "absolute top-3 inset-x-0 justify-center pointer-events-none" : "justify-between"
                                    )}>
                                        <div className={cn("flex items-center gap-1.5", viewMode === 'month' ? "w-full justify-between" : "")}>
                                            <span className={cn(
                                                "text-[10px] font-medium w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                                                isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground group-hover:bg-white/10"
                                            )}>
                                                {format(day, 'd')}
                                            </span>

                                            {/* Trend Arrow Next to Number (or right aligned in header) */}
                                            {dayData && (hasProfit || hasLoss) && (
                                                <div className="flex items-center justify-center">
                                                    {hasProfit ? (
                                                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                                                    ) : (
                                                        <TrendingDown className="w-3 h-3 text-red-500" />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {dayData ? (
                                        <>
                                            {/* Week View: Vertical Bar Visual - MANTIDO IGUAL */}
                                            {viewMode === 'week' && (
                                                <>
                                                    {/* Background Dashed Lines for Grid Effect */}
                                                    <div className="absolute inset-x-0 top-[15%] h-px border-t border-dashed border-border/40 z-0" />
                                                    <div className="absolute inset-x-0 top-[35%] h-px border-t border-dashed border-border/40 z-0" />
                                                    <div className="absolute inset-x-0 top-[55%] h-px border-t border-dashed border-border/40 z-0" />
                                                    <div className="absolute inset-x-0 top-[75%] h-px border-t border-dashed border-border/40 z-0" />

                                                    {/* Bar Container with padding for 'Ceiling' */}
                                                    <div className="flex-1 w-full flex items-end justify-center px-2 pt-10 relative z-10">
                                                        <div
                                                            className={cn(
                                                                "w-full max-w-[24px] rounded-t-sm transition-all duration-500 relative",
                                                                hasProfit ? "bg-emerald-500/20 group-hover:bg-emerald-500/30" : "bg-red-500/20 group-hover:bg-red-500/30"
                                                            )}
                                                            style={{ height: `${Math.max(barHeightPct, 4)}%` }}
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            {/* Values Container */}
                                            <div className={cn(
                                                "flex flex-col relative z-20",
                                                viewMode === 'week' ? "items-center gap-0.5 mt-auto" : "items-start mt-0 pl-1" // Mês: Alinhado esquerda, logo abaixo do dia
                                            )}>
                                                {/* ROAS Tooltip - Agora acima do valor para não cortar */}
                                                <div className={cn(
                                                    "absolute -top-6 left-0 bg-popover text-popover-foreground text-[10px] font-medium px-1.5 py-0.5 rounded shadow-sm border border-border transition-all duration-200 pointer-events-none whitespace-nowrap z-50",
                                                    viewMode === 'month' ? "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0" : "hidden"
                                                )}>
                                                    ROAS {dayData.roas.toFixed(2)}x
                                                </div>

                                                <div className={cn(
                                                    "font-bold py-0.5 rounded-[2px] transition-all",
                                                    hasProfit ? "text-emerald-500" : hasLoss ? "text-red-500" : "text-muted-foreground",
                                                    viewMode === 'week' ? "text-sm text-center" : "text-sm text-left tracking-tight"
                                                )}>
                                                    {viewMode === 'week'
                                                        ? formatCurrency(dayData.profit)
                                                        : Math.abs(dayData.profit) >= 1000
                                                            ? `${(dayData.profit / 1000).toFixed(1)}k`
                                                            : dayData.profit.toFixed(0)
                                                    }
                                                </div>

                                                {/* ROAS secundário apenas para modo Week onde há espaço embaixo */}
                                                {viewMode === 'week' && (
                                                    <div className="text-[9px] text-center text-muted-foreground">
                                                        {dayData.roas.toFixed(2)}x
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* Placeholder for Empty Data */}
                                            {viewMode === 'week' ? (
                                                <>
                                                    {/* Week View: Ghost Bar */}
                                                    <div className="absolute inset-x-0 top-[15%] h-px border-t border-dashed border-border/20 z-0" />
                                                    <div className="absolute inset-x-0 top-[35%] h-px border-t border-dashed border-border/20 z-0" />
                                                    <div className="absolute inset-x-0 top-[55%] h-px border-t border-dashed border-border/20 z-0" />
                                                    <div className="absolute inset-x-0 top-[75%] h-px border-t border-dashed border-border/20 z-0" />

                                                    <div className="flex-1 w-full flex items-end justify-center px-2 pt-10 relative z-10 opacity-40">
                                                        <div
                                                            className="w-full max-w-[24px] rounded-t-sm bg-secondary/30 dark:bg-muted/30"
                                                            style={{ height: '15%' }} // Fixed placeholder height
                                                        />
                                                    </div>
                                                    <div className="flex flex-col items-center justify-end mt-auto pb-0.5 opacity-30">
                                                        <span className="text-[10px] text-muted-foreground font-medium">-</span>
                                                    </div>
                                                </>
                                            ) : (
                                                /* Month View: Text Skeleton */
                                                <div className="flex-1 flex flex-col justify-start pl-1 pt-0.5 gap-1.5 opacity-40">
                                                    <div className="h-2.5 w-12 bg-secondary/40 rounded-[2px]" />
                                                    {/* <div className="h-2 w-8 bg-secondary/30 rounded-[2px]" /> */}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </Card>
    );
}
