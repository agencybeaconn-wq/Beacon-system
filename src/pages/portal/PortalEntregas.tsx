import { useEffect, useMemo, useState } from "react";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Loader2, PackageCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/contexts/PermissionsContext";

interface Delivery {
    id: string;
    title: string;
    start_date: string;
    due_date: string;
    status: "active" | "delivered";
}

function daysLeft(due: string): number {
    return differenceInCalendarDays(parseISO(due), new Date());
}

function elapsedPct(start: string, due: string): number {
    const total = differenceInCalendarDays(parseISO(due), parseISO(start));
    if (total <= 0) return 100;
    const used = differenceInCalendarDays(new Date(), parseISO(start));
    return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
}

/**
 * Entregas do cliente no portal — visão READ-ONLY dos projetos DELE na fila.
 * A RLS (policy pp_client_read) garante no banco que um cliente jamais vê
 * projeto de outro; este componente nem recebe a fila completa.
 */
export default function PortalEntregas() {
    const { linkedClientId } = usePermissions();
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (!linkedClientId) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const { data, error } = await (supabase as any)
                    .from("project_priorities")
                    .select("id, title, start_date, due_date, status")
                    .eq("client_id", linkedClientId)
                    .order("due_date", { ascending: true });
                if (error) throw error;
                setDeliveries(data || []);
            } catch (err: any) {
                console.error("[PortalEntregas] load:", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [linkedClientId]);

    const active = useMemo(() => deliveries.filter(d => d.status === "active"), [deliveries]);
    const delivered = useMemo(() => deliveries.filter(d => d.status === "delivered"), [deliveries]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Entregas</h1>
                <p className="text-muted-foreground mt-1">
                    Seus projetos em andamento e as datas de entrega previstas.
                </p>
            </div>

            {active.length === 0 && delivered.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-border/30 py-16 text-center">
                    <PackageCheck className="h-6 w-6 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma entrega agendada no momento.</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {active.map(d => {
                        const left = daysLeft(d.due_date);
                        const pct = elapsedPct(d.start_date, d.due_date);
                        const overdue = left < 0;
                        return (
                            <div key={d.id} className="mat-card rounded-lg p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-semibold truncate">{d.title}</p>
                                    <p className={cn(
                                        "text-sm font-semibold font-mono-numbers shrink-0",
                                        overdue ? "text-destructive" : "text-foreground",
                                    )}>
                                        {overdue ? "em finalização" : left === 0 ? "entrega hoje" : `em ${left}d`}
                                    </p>
                                </div>
                                <div className="mt-2.5 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-primary transition-[width] duration-500"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                                    <CalendarClock className="h-3 w-3" />
                                    Previsão: {format(parseISO(d.due_date), "dd 'de' MMMM yyyy", { locale: ptBR })}
                                </p>
                            </div>
                        );
                    })}

                    {delivered.length > 0 && (
                        <>
                            <p className="text-xs font-medium text-muted-foreground pt-4 pb-1">Entregues</p>
                            {delivered.map(d => (
                                <div key={d.id} className="mat-card rounded-lg p-4 flex items-center justify-between gap-3 opacity-70">
                                    <p className="font-medium truncate">{d.title}</p>
                                    <p className="text-sm text-success flex items-center gap-1.5 shrink-0">
                                        <PackageCheck className="h-4 w-4" /> Entregue
                                    </p>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
