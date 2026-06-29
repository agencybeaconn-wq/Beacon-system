import { useState, useMemo, useEffect, Component, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign, Info, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrencyBRLCompact as formatCurrency } from "@/lib/formatters";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("Calendar Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 text-center border border-red-200 bg-red-50 rounded-xl">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="text-red-700 font-medium">Não foi possível carregar o calendário.</p>
                    <p className="text-xs text-red-500 mt-1">Verifique o console para mais detalhes.</p>
                </div>
            );
        }
        return this.props.children;
    }
}

interface CalendarEvent {
    id: string;
    date: Date;
    title: string;
    amount: number;
    type: 'income' | 'expense';
    status: 'paid' | 'pending';
    subtype?: 'sale' | 'entry' | 'balance' | 'invoice' | 'expense' | 'one_off' | 'staff';
    isOneOff?: boolean;
}

interface FinancialCalendarProps {
    invoices: any[];
    expenses: any[];
    sales?: any[];
    oneOffReceivables?: any[];
    staffFinancials?: any[];
    staffPayDay?: number;
    monthReference?: string;
    dateFilter?: 'today' | '7d' | 'month' | 'custom';
    chartsData?: any;
    className?: string;
}

// Helper para parse seguro de datas
const safeParseDate = (dateStr: string | null | undefined): Date => {
    if (!dateStr) return new Date();
    try {
        const parsed = parseISO(dateStr);
        if (isNaN(parsed.getTime())) return new Date();
        return parsed;
    } catch (e) {
        return new Date();
    }
};

export const FinancialCalendar = (props: FinancialCalendarProps) => (
    <ErrorBoundary>
        <FinancialCalendarContent {...props} />
    </ErrorBoundary>
);

function FinancialCalendarContent({
    invoices,
    expenses,
    sales = [],
    oneOffReceivables = [],
    staffFinancials = [],
    staffPayDay = 5,
    monthReference,
    dateFilter = 'month',
    chartsData,
    className
}: FinancialCalendarProps) {
    const [currentDate, setCurrentDate] = useState<Date>(() => {
        if (monthReference) {
            try {
                const parsed = parseISO(monthReference + '-01');
                if (!isNaN(parsed.getTime())) return parsed;
            } catch (e) {
                // ignore
            }
        }
        return new Date();
    });

    useEffect(() => {
        if (monthReference && dateFilter === 'month') {
            try {
                const parsed = parseISO(monthReference + '-01');
                if (!isNaN(parsed.getTime())) {
                    setCurrentDate(parsed);
                } else {
                    console.error("Invalid month reference (NaN):", monthReference);
                }
            } catch (e) {
                console.error("Invalid month reference:", monthReference);
            }
        } else if (dateFilter === 'today' || dateFilter === '7d') {
            setCurrentDate(new Date());
        }
    }, [monthReference, dateFilter]);

    // Ensure currentDate is valid before using it
    const validCurrentDate = useMemo(() => {
        return isNaN(currentDate.getTime()) ? new Date() : currentDate;
    }, [currentDate]);

    const events = useMemo(() => {
        // --- INVOICES → income events ---
        const invEvents: CalendarEvent[] = (invoices || []).filter(item => !!item).map(inv => ({
            id: inv.id,
            date: safeParseDate(inv.due_date),
            title: `Fatura: ${inv.agency_clients?.name || 'Cliente'}`,
            amount: inv.amount || 0,
            type: 'income',
            status: inv.status === 'paid' ? 'paid' : 'pending',
            subtype: 'invoice' as const,
            isOneOff: true
        }));

        // --- EXPENSES → expense events ---
        const expEvents: CalendarEvent[] = (expenses || []).filter(item => !!item).map(exp => ({
            id: exp.id,
            date: safeParseDate(exp.due_date),
            title: exp.description || 'Despesa',
            amount: exp.amount || 0,
            type: 'expense',
            status: exp.status === 'paid' ? 'paid' : 'pending',
            subtype: 'expense' as const
        }));

        // --- SALES → split into multiple events for partial payments ---
        const salesEvents: CalendarEvent[] = [];
        for (const sale of (sales || []).filter(item => !!item)) {
            const saleDate = safeParseDate(sale.sale_date);
            const clientLabel = sale.client_name || 'Cliente';
            const serviceLabel = sale.service ? ` - ${sale.service}` : '';

            if (sale.status === 'pago') {
                // Fully paid: single green event on sale_date
                salesEvents.push({
                    id: sale.id,
                    date: saleDate,
                    title: `✅ Venda: ${clientLabel}${serviceLabel}`,
                    amount: sale.total_amount || 0,
                    type: 'income',
                    status: 'paid',
                    subtype: 'sale'
                });
            } else if (sale.status === 'parcial') {
                // Partial: sale event (yellow) + entry received + future balance
                salesEvents.push({
                    id: sale.id,
                    date: saleDate,
                    title: `🟡 Venda (parcial): ${clientLabel}${serviceLabel}`,
                    amount: sale.total_amount || 0,
                    type: 'income',
                    status: 'pending',
                    subtype: 'sale'
                });

                // Entry received on sale_date
                if (sale.entry_amount > 0) {
                    salesEvents.push({
                        id: `${sale.id}-entry`,
                        date: saleDate,
                        title: `💰 Entrada: ${clientLabel}`,
                        amount: sale.entry_amount,
                        type: 'income',
                        status: 'paid',
                        subtype: 'entry'
                    });
                }

                // Balance due on balance_due_date
                if (sale.balance_due_date) {
                    const balance = (sale.total_amount || 0) - (sale.entry_amount || 0);
                    if (balance > 0) {
                        salesEvents.push({
                            id: `${sale.id}-balance`,
                            date: safeParseDate(sale.balance_due_date),
                            title: `📅 Saldo: ${clientLabel}`,
                            amount: balance,
                            type: 'income',
                            status: 'pending',
                            subtype: 'balance'
                        });
                    }
                }
            } else {
                // Pending: sale event (red)
                salesEvents.push({
                    id: sale.id,
                    date: saleDate,
                    title: `🔴 Venda (pendente): ${clientLabel}${serviceLabel}`,
                    amount: sale.total_amount || 0,
                    type: 'income',
                    status: 'pending',
                    subtype: 'sale'
                });

                // If has balance_due_date, show future payment
                if (sale.balance_due_date) {
                    salesEvents.push({
                        id: `${sale.id}-balance`,
                        date: safeParseDate(sale.balance_due_date),
                        title: `📅 Pagamento futuro: ${clientLabel}`,
                        amount: sale.total_amount || 0,
                        type: 'income',
                        status: 'pending',
                        subtype: 'balance'
                    });
                }
            }
        }

        // --- ONE-OFF RECEIVABLES ---
        const oneOffEvents: CalendarEvent[] = (oneOffReceivables || []).filter(item => !!item).map(rec => ({
            id: rec.id,
            date: safeParseDate(rec.due_date),
            title: `Avulso: ${rec.client_name} - ${rec.service}`,
            amount: rec.amount || 0,
            type: 'income',
            status: rec.status === 'paid' ? 'paid' : 'pending',
            subtype: 'one_off' as const,
            isOneOff: true
        }));

        // --- STAFF PAYROLL ---
        const staffEvents: CalendarEvent[] = (staffFinancials || []).filter(item => !!item && item.email).map(staff => {
            const payDay = staffPayDay || 5;
            let date = new Date();

            try {
                date = new Date(validCurrentDate.getFullYear(), validCurrentDate.getMonth(), payDay);
                if (isNaN(date.getTime())) {
                    date = new Date();
                }
            } catch (e) {
                date = new Date();
            }

            return {
                id: `staff-${staff.id}`,
                date,
                title: `Salário: ${staff.email.split('@')[0]}`,
                amount: staff.base_salary || 0,
                type: 'expense',
                status: 'pending',
                subtype: 'staff' as const
            };
        });

        return [...invEvents, ...expEvents, ...salesEvents, ...oneOffEvents, ...staffEvents];
    }, [invoices, expenses, sales, oneOffReceivables, staffFinancials, validCurrentDate, staffPayDay]);

    const stats = useMemo(() => {
        // Se temos chartsData (dados reais de tráfego), usamos eles para somar ao lucro
        // senão usamos apenas faturas e despesas
        const operationalData = (chartsData?.dailyEvolution || []).filter((d: any) => {
            if (!d.fullDate) return false;
            try {
                const parsedDate = parseISO(d.fullDate);
                if (isNaN(parsedDate.getTime())) return false;
                return dateFilter === 'month' ? isSameMonth(parsedDate, validCurrentDate) : true;
            } catch (e) {
                return false;
            }
        });

        const opRevenue = operationalData.reduce((acc: number, d: any) => acc + (d.revenue || 0), 0);
        const opSpend = operationalData.reduce((acc: number, d: any) => acc + (d.spend || 0), 0);

        const monthEvents = events.filter(e => {
            try {
                return isSameMonth(e.date, validCurrentDate);
            } catch (e) { return false; }
        });

        const income = monthEvents.filter(e => e.type === 'income' && !e.isOneOff).reduce((acc, e) => acc + e.amount, 0) + opRevenue;
        const expense = monthEvents.filter(e => e.type === 'expense').reduce((acc, e) => acc + e.amount, 0) + opSpend;
        const profit = income - expense;
        const margin = income > 0 ? (profit / income) * 100 : 0;

        return { income, expense, profit, margin };
    }, [events, validCurrentDate, chartsData, dateFilter]);

    const formatCompact = (val: number) => {
        if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`;
        return val.toFixed(0);
    };

    // --- VIEW COMPONENTS ---

    const MonthView = () => {
        const calendarDays = useMemo(() => {
            try {
                const start = startOfWeek(startOfMonth(validCurrentDate), { weekStartsOn: 0 });
                const end = endOfWeek(endOfMonth(validCurrentDate), { weekStartsOn: 0 });
                return eachDayOfInterval({ start, end });
            } catch (e) {
                // Fallback safe week
                const now = new Date();
                const start = startOfWeek(startOfMonth(now), { weekStartsOn: 0 });
                const end = endOfWeek(endOfMonth(now), { weekStartsOn: 0 });
                return eachDayOfInterval({ start, end });
            }
        }, [validCurrentDate]);

        return (
            <div className="grid grid-cols-7 gap-0.5 rounded-xl overflow-hidden border border-border/50 bg-border/50">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
                    <div key={day} className="bg-muted/30 py-3 text-center text-[10px] font-black text-muted-foreground/60 tracking-widest border-b border-border/40">
                        {day}
                    </div>
                ))}
                {calendarDays.map((day) => {
                    const isCurrentMonth = isSameMonth(day, validCurrentDate);
                    const dayEvents = events.filter(e => isSameDay(e.date, day));

                    // Dados operacionais do dia - Usar comparação de string para evitar problemas de fuso horário
                    const dayStr = format(day, 'yyyy-MM-dd');
                    const opDay = (chartsData?.dailyEvolution || []).find((d: any) => d.fullDate === dayStr);
                    const dailyOpRevenue = opDay?.revenue || 0;
                    const dailyOpSpend = opDay?.spend || 0;

                    const dailyIncome = dayEvents.filter(e => e.type === 'income' && !e.isOneOff).reduce((acc, e) => acc + e.amount, 0) + dailyOpRevenue;
                    const dailyExpense = dayEvents.filter(e => e.type === 'expense').reduce((acc, e) => acc + e.amount, 0) + dailyOpSpend;
                    const dailyProfit = dailyIncome - dailyExpense;
                    const isToday = isSameDay(day, new Date());
                    const dailyRoas = dailyOpSpend > 0 ? dailyOpRevenue / dailyOpSpend : 0;

                    const hasOverdueInvoice = dayEvents.some(e => e.type === 'income' && (e as any).status === 'overdue');

                    return (
                        <TooltipProvider key={day.toISOString()}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className={cn(
                                        "min-h-[100px] p-3 flex flex-col justify-between transition-all duration-300 relative group",
                                        isCurrentMonth ? "bg-background" : "bg-muted/10 opacity-40",
                                        "hover:bg-secondary/40 cursor-default",
                                        isToday && "ring-2 ring-inset ring-primary/40 bg-primary/5",
                                        hasOverdueInvoice && "ring-1 ring-inset ring-destructive shadow-[inset_0_0_12px_rgba(239,68,68,0.1)]"
                                    )}>
                                        <div className="flex items-start justify-between">
                                            <span className={cn(
                                                "text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                                                isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                                            )}>
                                                {format(day, 'd')}
                                            </span>
                                            {dailyProfit !== 0 && (
                                                <div className="flex items-center gap-1.5">
                                                    {hasOverdueInvoice && <AlertCircle className="w-3.5 h-3.5 text-destructive animate-pulse" />}
                                                    {dailyProfit > 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                                                </div>
                                            )}
                                            {dailyProfit === 0 && hasOverdueInvoice && (
                                                <div className="flex items-center gap-1.5">
                                                    <AlertCircle className="w-3.5 h-3.5 text-destructive animate-pulse" />
                                                </div>
                                            )}
                                        </div>
                                        {dailyProfit !== 0 && (
                                            <div className="flex flex-col items-end mt-auto">
                                                <div className={cn("text-xs font-black tracking-tight font-mono", dailyProfit > 0 ? "text-emerald-500" : "text-red-500")}>
                                                    {formatCompact(dailyProfit)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="p-3 border-border/40 shadow-xl bg-background/95 backdrop-blur-md max-w-[240px]">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pb-1 border-b border-border/10">
                                            {format(day, "d 'de' MMMM", { locale: ptBR })}
                                        </p>

                                        {dayEvents.length > 0 && (
                                            <div className="space-y-1.5 py-1">
                                                {dayEvents.slice(0, 5).map((e, idx) => (
                                                    <div key={idx} className="flex justify-between items-start gap-3">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                                                                e.subtype === 'balance' ? "bg-yellow-500" :
                                                                    e.subtype === 'entry' ? "bg-blue-500" :
                                                                        e.type === 'income' ? "bg-emerald-500" : "bg-red-500"
                                                            )} />
                                                            <span className="text-[10px] text-muted-foreground truncate leading-tight">{e.title}</span>
                                                        </div>
                                                        <span className={cn("text-[10px] font-bold shrink-0", e.type === 'income' ? "text-emerald-500/80" : "text-red-500/80")}>
                                                            {formatCompact(e.amount)}
                                                        </span>
                                                    </div>
                                                ))}
                                                {dayEvents.length > 5 && (
                                                    <p className="text-[9px] text-muted-foreground italic pl-3">+ {dayEvents.length - 5} outros itens</p>
                                                )}
                                            </div>
                                        )}

                                        <div className="pt-2 border-t border-border/10 space-y-1">
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-muted-foreground font-medium">Receitas</span>
                                                <span className="font-bold text-emerald-500">+{formatCurrency(dailyIncome)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-muted-foreground font-medium">Despesas</span>
                                                <span className="font-bold text-red-500">-{formatCurrency(dailyExpense)}</span>
                                            </div>
                                            {dailyRoas > 0 && (
                                                <div className="flex justify-between items-center text-[11px]">
                                                    <span className="text-muted-foreground font-medium">ROAS</span>
                                                    <span className="font-bold text-yellow-500">{dailyRoas.toFixed(2)}x</span>
                                                </div>
                                            )}
                                        </div>
                                        <Separator className="my-1 opacity-50" />
                                        <div className="flex justify-between items-center text-xs pt-0.5">
                                            <span className="font-black text-[10px] uppercase tracking-wider">Líquido</span>
                                            <span className={cn("font-black text-sm", dailyProfit >= 0 ? "text-emerald-500" : "text-red-500")}>
                                                {formatCurrency(dailyProfit)}
                                            </span>
                                        </div>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                })}
            </div>
        );
    };

    const WeekView = () => {
        const last7Days = useMemo(() => {
            const days = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                days.push(d);
            }
            return days;
        }, []);

        const maxProfit = useMemo(() => {
            const profits = last7Days.map(day => {
                const opDay = (chartsData?.dailyEvolution || []).find((d: any) => {
                    if (!d.fullDate) return false;
                    try {
                        return isSameDay(parseISO(d.fullDate), day);
                    } catch (e) {
                        return false;
                    }
                });
                return Math.abs((opDay?.revenue || 0) - (opDay?.spend || 0));
            });
            return Math.max(...profits, 1000);
        }, [last7Days, chartsData]);

        return (
            <div className="flex gap-4 h-[300px] w-full pt-10 px-4 relative">
                {/* Linhas de grade horizontais */}
                <div className="absolute inset-x-4 inset-y-0 flex flex-col justify-between pointer-events-none opacity-20 py-10">
                    {[1, 2, 3, 4].map(i => <div key={i} className="w-full border-t border-dashed border-muted-foreground" />)}
                </div>

                {last7Days.map(day => {
                    const opDay = (chartsData?.dailyEvolution || []).find((d: any) => {
                        try {
                            return d.fullDate && isSameDay(parseISO(d.fullDate), day);
                        } catch {
                            return false;
                        }
                    });
                    const profit = (opDay?.revenue || 0) - (opDay?.spend || 0);
                    const height = Math.min((Math.abs(profit) / maxProfit) * 100, 100);
                    const roas = opDay?.spend > 0 ? opDay.revenue / opDay.spend : 0;

                    return (
                        <div key={day.toISOString()} className="flex-1 flex flex-col items-center justify-end h-full gap-3 group z-10">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center mb-1">
                                <span className="text-[10px] font-bold text-yellow-500">ROAS {roas.toFixed(2)}</span>
                                <span className={cn("text-xs font-black", profit >= 0 ? "text-emerald-500" : "text-red-500")}>
                                    {formatCompact(profit)}
                                </span>
                            </div>
                            <div className="w-full max-w-[40px] bg-muted/20 rounded-t-sm relative overflow-hidden h-full flex flex-col justify-end">
                                <div
                                    className={cn("w-full transition-all duration-1000 ease-out rounded-t-sm", profit >= 0 ? "bg-emerald-500/30 border-t-2 border-emerald-500" : "bg-red-500/30 border-t-2 border-red-500")}
                                    style={{ height: `${height}%` }}
                                />
                            </div>
                            <div className="text-center">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{format(day, 'eee', { locale: ptBR })}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const TodayView = () => {
        const hourlyData = chartsData?.hourlyEvolution || [];
        const maxOp = Math.max(...hourlyData.map((h: any) => h.revenue || 0), 100);

        // Get today's financial events
        const todayEvents = events.filter(e => isSameDay(e.date, new Date()));

        return (
            <div className="space-y-4">
                {/* Today's Events */}
                {todayEvents.length > 0 && (
                    <div className="space-y-2 p-4">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Eventos de Hoje</h3>
                        {todayEvents.map((e, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-background hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={cn("w-2 h-2 rounded-full shrink-0",
                                        e.subtype === 'balance' ? "bg-yellow-500" :
                                            e.subtype === 'entry' ? "bg-blue-500" :
                                                e.type === 'income' ? "bg-emerald-500" : "bg-red-500"
                                    )} />
                                    <span className="text-sm truncate">{e.title}</span>
                                    <Badge variant="outline" className={cn("text-[10px] shrink-0",
                                        e.status === 'paid' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                    )}>
                                        {e.status === 'paid' ? 'PAGO' : 'PENDENTE'}
                                    </Badge>
                                </div>
                                <span className={cn("text-sm font-bold shrink-0 ml-4",
                                    e.type === 'income' ? "text-emerald-500" : "text-red-500"
                                )}>
                                    {e.type === 'income' ? '+' : '-'}{formatCurrency(e.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Hourly Performance Chart */}
                {hourlyData.length > 0 && (
                    <div className="space-y-2 p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Performance por Hora</h3>
                        {hourlyData.map((hour: any) => {
                            const width = (hour.revenue / maxOp) * 100;
                            return (
                                <div key={hour.date} className="flex items-center gap-4 group">
                                    <span className="text-[11px] font-mono font-bold text-muted-foreground w-10 text-right">{hour.date}</span>
                                    <div className="flex-1 h-6 bg-muted/10 rounded-sm relative group-hover:bg-muted/20 transition-colors">
                                        <div
                                            className="absolute inset-y-0 left-0 bg-emerald-500/20 border-r-2 border-emerald-500 transition-all duration-1000"
                                            style={{ width: `${width}%` }}
                                        />
                                        <div className="absolute inset-0 flex items-center px-3 justify-between">
                                            <span className="text-[10px] font-bold text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {formatCurrency(hour.revenue)}
                                            </span>
                                            {hour.roas > 0 && <span className="text-[10px] font-bold text-yellow-500 font-mono">ROAS {hour.roas.toFixed(2)}</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Empty state */}
                {todayEvents.length === 0 && hourlyData.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <Info className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm font-medium">Nenhum evento financeiro para hoje.</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Card className={cn("flex flex-col overflow-hidden border-none shadow-none bg-transparent", className)}>
            {/* Calendar View Switcher */}
            <div className="bg-transparent">
                {dateFilter === 'month' || dateFilter === 'custom' ? <MonthView /> :
                    dateFilter === '7d' ? <WeekView /> :
                        <TodayView />}
            </div>
        </Card>
    );
}
