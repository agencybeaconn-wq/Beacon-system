import { useTranslation } from "react-i18next";
import { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DashboardDateRange } from "@/dashboard/hooks/useDashboardData";

/** Limite superior — bloqueia datas futuras pra evitar queries Meta/Shopify vazias. */
const TODAY = new Date();

/** Formata o range pra label do botão custom: "10/05 → 24/05" ou "10/05 → ..." */
function formatRangeLabel(range: DateRange | undefined): string | null {
    if (!range?.from) return null;
    const fromStr = format(range.from, "dd/MM", { locale: ptBR });
    if (!range.to) return `${fromStr} → ...`;
    const toStr = format(range.to, "dd/MM", { locale: ptBR });
    return `${fromStr} → ${toStr}`;
}

interface Props {
    title?: string;
    subtitle?: string;
    value: DashboardDateRange;
    onChange: (value: DashboardDateRange) => void;
    customRange: DateRange | undefined;
    onCustomRange: (range: DateRange | undefined) => void;
    onRefresh: () => void;
    isRefreshing?: boolean;
}

export function DateRangeFilter({
    title,
    subtitle,
    value,
    onChange,
    customRange,
    onCustomRange,
    onRefresh,
    isRefreshing = false,
}: Props) {
    const { t } = useTranslation();

    const handleChange = (next: DashboardDateRange) => {
        onChange(next);
        if (next !== "custom") onCustomRange(undefined);
    };

    const handleCustomRange = (range: DateRange | undefined) => {
        onCustomRange(range);
        if (range?.from && range?.to) onChange("custom");
    };

    return (
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-2">
            <div className="flex-1 flex gap-4 items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">
                        {title ?? t("overview.title", "Visão Geral")}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {subtitle ?? t("overview.subtitle", "Acompanhe a performance das suas campanhas")}
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <div className="flex gap-1 items-center bg-secondary/30 p-1 rounded-md border border-white/5">
                    <Button
                        variant={value === "today" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handleChange("today")}
                        className={cn("rounded-sm text-xs h-7 px-3", value === "today" && "font-semibold")}
                    >
                        {t("common.today", "Today")}
                    </Button>
                    <Button
                        variant={value === "7d" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handleChange("7d")}
                        className={cn("rounded-sm text-xs h-7 px-3", value === "7d" && "font-semibold")}
                    >
                        7d
                    </Button>
                    <Button
                        variant={value === "month" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handleChange("month")}
                        className={cn("rounded-sm text-xs h-7 px-3", value === "month" && "font-semibold")}
                    >
                        {t("common.month", "Month")}
                    </Button>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={value === "custom" ? "default" : "ghost"}
                                size="sm"
                                className={cn(
                                    "rounded-sm h-7 gap-1.5 text-xs",
                                    value === "custom" ? "font-semibold px-3" : "px-2"
                                )}
                            >
                                <CalendarIcon className="h-3.5 w-3.5" />
                                {value === "custom" && formatRangeLabel(customRange) && (
                                    <span className="font-mono tabular-nums">{formatRangeLabel(customRange)}</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="range"
                                selected={customRange}
                                onSelect={handleCustomRange}
                                numberOfMonths={1}
                                locale={ptBR}
                                disabled={{ after: TODAY }}
                                defaultMonth={customRange?.from ?? TODAY}
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="h-9 w-9 p-0 border-border bg-card hover:bg-muted shadow-none"
                    aria-label="Atualizar dados"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={cn("text-muted-foreground", isRefreshing && "animate-spin")}
                    >
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                    </svg>
                </Button>
            </div>
        </div>
    );
}
