import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import {
    Calendar as CalendarIcon,
    RefreshCw,
    GraduationCap
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboard } from "@/contexts/DashboardContext";
import { useAcademyFinancials } from "@/hooks/useAcademyFinancials";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

import { AcademyOverviewCards } from "@/components/financial/academy/AcademyOverviewCards";
import { AcademyRevenueTab } from "@/components/financial/academy/AcademyRevenueTab";
import { AcademyExpensesTab } from "@/components/financial/academy/AcademyExpensesTab";
import { AcademyDREView } from "@/components/financial/academy/AcademyDREView";

const FinanceiroAcademy = () => {
    const { t } = useTranslation();
    const { dateFilter, dateRange, setDateFilter, setDateRange } = useDashboard();
    const academyData = useAcademyFinancials();

    const [activeTab, setActiveTabRaw] = useState(() => {
        return localStorage.getItem('financeiro_academy_active_tab') || 'overview';
    });

    const setActiveTab = (val: string) => {
        setActiveTabRaw(val);
        localStorage.setItem('financeiro_academy_active_tab', val);
    };

    const handleDateFilterChange = (value: string) => {
        setDateFilter(value as any);
        if (value !== "custom") {
            setDateRange(undefined);
        }
    };

    const [calendarOpen, setCalendarOpen] = useState(false);

    const handleCustomRange = (range: DateRange | undefined) => {
        setDateRange(range as any);
        if (range?.from && range?.to) {
            setDateFilter("custom" as any);
            setCalendarOpen(false);
        }
    };

    if (academyData.isLoading) {
        return (
            <div className="flex-1 space-y-10 p-10 pt-10 min-h-screen w-full bg-background">
                <div className="flex items-start gap-4 mb-4">
                    <Skeleton className="p-3 w-14 h-14 rounded-xl shrink-0" />
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-48" />
                        <Skeleton className="h-6 w-64" />
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 space-y-6 p-10 pt-10 min-h-screen w-full bg-background">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">Financeiro Academy</h1>
                    <p className="text-muted-foreground mt-1 max-w-2xl">Controle financeiro dos cursos e treinamentos da Beacon Academy.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <TabsList className="h-10 mr-2">
                        <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                        <TabsTrigger value="revenue">Receitas</TabsTrigger>
                        <TabsTrigger value="expenses">Despesas</TabsTrigger>
                        <TabsTrigger value="dre">DRE</TabsTrigger>
                    </TabsList>

                    <div className="flex gap-1 items-center bg-secondary/30 p-1 rounded-md border border-white/5 mr-2">
                        <Button
                            variant={dateFilter === "today" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => handleDateFilterChange("today")}
                            className={cn("rounded-sm text-xs h-7 px-3", dateFilter === "today" && "font-semibold")}
                        >
                            {t('common.today', 'Today')}
                        </Button>
                        <Button
                            variant={dateFilter === "7d" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => handleDateFilterChange("7d")}
                            className={cn("rounded-sm text-xs h-7 px-3", dateFilter === "7d" && "font-semibold")}
                        >
                            7d
                        </Button>
                        <Button
                            variant={dateFilter === "month" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => handleDateFilterChange("month")}
                            className={cn("rounded-sm text-xs h-7 px-3", dateFilter === "month" && "font-semibold")}
                        >
                            {t('common.month', 'Month')}
                        </Button>
                        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={dateFilter === "custom" ? "default" : "ghost"}
                                    size="sm"
                                    className={cn("rounded-sm h-7 px-2", dateFilter === "custom" && "font-semibold")}
                                >
                                    <CalendarIcon className="h-3.5 w-3.5" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                    mode="range"
                                    selected={dateRange as any}
                                    onSelect={handleCustomRange as any}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => academyData.refetch()}
                        className="h-8 px-3 border-white/5 bg-secondary/30 hover:bg-white/5"
                        disabled={academyData.isLoading}
                    >
                        <RefreshCw className={cn("h-4 w-4 mr-2", academyData.isLoading && "animate-spin")} />
                        {t('common.refresh', 'Atualizar')}
                    </Button>
                </div>
            </div>

            <div className="space-y-6">
                <TabsContent value="overview" className="space-y-6 mt-0">
                    <AcademyOverviewCards
                        summary={academyData.summary}
                        isLoading={academyData.isLoading}
                    />

                    {/* Tabela resumida de receitas recentes */}
                    <AcademyRevenueTab
                        isLoading={academyData.isLoading}
                        revenues={academyData.revenues}
                        monthReference={academyData.monthReference}
                        addRevenue={academyData.addRevenue}
                        updateRevenue={academyData.updateRevenue}
                        deleteRevenue={academyData.deleteRevenue}
                    />
                </TabsContent>

                <TabsContent value="revenue">
                    <AcademyRevenueTab
                        isLoading={academyData.isLoading}
                        revenues={academyData.revenues}
                        monthReference={academyData.monthReference}
                        addRevenue={academyData.addRevenue}
                        updateRevenue={academyData.updateRevenue}
                        deleteRevenue={academyData.deleteRevenue}
                    />
                </TabsContent>

                <TabsContent value="expenses">
                    <AcademyExpensesTab
                        isLoading={academyData.isLoading}
                        expenses={academyData.expenses}
                        monthReference={academyData.monthReference}
                        addExpense={academyData.addExpense}
                        updateExpense={academyData.updateExpense}
                        deleteExpense={academyData.deleteExpense}
                    />
                </TabsContent>

                <TabsContent value="dre">
                    <AcademyDREView
                        revenues={academyData.revenues}
                        expenses={academyData.expenses}
                    />
                </TabsContent>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-4 rounded-lg border border-border/50">
                <GraduationCap className="h-4 w-4" />
                Financeiro Academy — dados inseridos manualmente, sem vínculo com clientes da agência.
            </div>
        </Tabs>
    );
};

export default FinanceiroAcademy;
