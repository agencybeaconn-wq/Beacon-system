import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, AlertTriangle, CalendarClock, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface TasksByStatus {
    todo: number;
    in_progress: number;
    validation: number;
    revision: number;
    review: number;
    pending: number;
}

interface ActiveClientData {
    id: string;
    name: string;
    project_name: string | null;
    logo_url: string | null;
    client_type: string | null;
    created_at: string;
    project_deadline: string | null;
    primaryColor?: string;
    activeTaskCount: number;
    latestDueDate: string | null;
    tasksByStatus?: TasksByStatus;
}

interface ActiveClientCardProps {
    client: ActiveClientData;
    onSelect: (id: string) => void;
}

function computeDeadline(deadline: string | null, latestDueDate: string | null) {
    // Prioridade: project_deadline > latestDueDate (onboarding não influencia)
    const raw = deadline || latestDueDate;
    if (!raw) return { daysDiff: null as number | null, isOverdue: false, hasDeadline: false, date: null as Date | null };

    const deadlineDate = new Date(raw);
    const now = new Date();
    const MS_DAY = 1000 * 60 * 60 * 24;
    const daysDiff = Math.ceil((deadlineDate.getTime() - now.getTime()) / MS_DAY);
    const isOverdue = now > deadlineDate;

    return { daysDiff, isOverdue, hasDeadline: true, date: deadlineDate };
}

const formatDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

const statusLabels: Record<string, { label: string; chipBg: string; chipText: string; chipBorder: string }> = {
    in_progress: { label: "Em progresso", chipBg: "bg-blue-500/15",   chipText: "text-blue-300",   chipBorder: "border-blue-500/40" },
    validation:  { label: "Validação",    chipBg: "bg-amber-500/15",  chipText: "text-amber-300",  chipBorder: "border-amber-500/40" },
    revision:    { label: "Revisão",      chipBg: "bg-purple-500/15", chipText: "text-purple-300", chipBorder: "border-purple-500/40" },
    review:      { label: "Review",       chipBg: "bg-cyan-500/15",   chipText: "text-cyan-300",   chipBorder: "border-cyan-500/40" },
    todo:        { label: "A fazer",      chipBg: "bg-zinc-500/15",   chipText: "text-zinc-300",   chipBorder: "border-zinc-500/40" },
    pending:     { label: "Pendente",     chipBg: "bg-zinc-400/15",   chipText: "text-zinc-300",   chipBorder: "border-zinc-400/40" },
};

export function ActiveClientCard({ client, onSelect }: ActiveClientCardProps) {
    const displayName = client.name;
    const initials = displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

    const deadline = computeDeadline(client.project_deadline, client.latestDueDate);

    const urgency: 'overdue' | 'critical' | 'warning' | 'safe' | 'none' =
        !deadline.hasDeadline ? 'none'
        : deadline.isOverdue ? 'overdue'
        : deadline.daysDiff! <= 2 ? 'critical'
        : deadline.daysDiff! <= 5 ? 'warning'
        : 'safe';

    const urgencyStyles = {
        overdue:  { bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-500 dark:text-red-400',         ring: 'ring-red-500/20' },
        critical: { bg: 'bg-red-500/5',      border: 'border-red-500/20',     text: 'text-red-500 dark:text-red-400',         ring: 'ring-red-500/15' },
        warning:  { bg: 'bg-orange-500/5',   border: 'border-orange-500/20',  text: 'text-orange-600 dark:text-orange-400',   ring: 'ring-orange-500/15' },
        safe:     { bg: 'bg-emerald-500/5',  border: 'border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/15' },
        none:     { bg: 'bg-muted/40',       border: 'border-border/60',      text: 'text-muted-foreground',                  ring: 'ring-border' },
    }[urgency];

    // Breakdown de demandas — só mostrar status significativos.
    // Filtra "pending" porque já é subentendido em "X demandas em aberto".
    // Só renderiza a lista se tiver algo realmente informativo (ex: em progresso, validação).
    const activeStatuses = Object.entries(client.tasksByStatus || {})
        .filter(([status, count]) => count > 0 && status !== 'pending')
        .sort(([, a], [, b]) => b - a);

    return (
        <Card
            className={cn(
                "group relative h-full flex flex-col hover:border-primary/40 hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden rounded-xl",
                urgency === 'overdue' && "ring-1 ring-red-500/20 border-red-500/20"
            )}
            onClick={() => onSelect(client.id)}
        >
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <Avatar className="h-10 w-10 border-2 border-border">
                        <AvatarImage src={client.logo_url || ""} />
                        <AvatarFallback
                            className="font-bold text-xs"
                            style={{
                                backgroundColor: (client.primaryColor || '#666') + '20',
                                color: client.primaryColor || '#666',
                            }}
                        >
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <Badge
                        className={cn(
                            "text-[9px] font-bold uppercase tracking-wider border-0 px-2 py-0.5",
                            client.client_type === 'fixo'
                                ? "bg-emerald-500/10 text-emerald-500"
                                : "bg-orange-500/10 text-orange-500"
                        )}
                    >
                        {client.client_type === 'fixo' ? 'Fixo' : 'Avulso'}
                    </Badge>
                </div>
                <CardTitle className="mt-2 text-base font-bold truncate">{client.name}</CardTitle>
                {client.project_name && (
                    <p className="text-[11px] text-muted-foreground truncate">{client.project_name}</p>
                )}
            </CardHeader>

            <CardContent className="space-y-3 flex-1 pt-0">
                {/* Painel grande de prazo — leitura instantânea de prioridade */}
                <div
                    className={cn(
                        "rounded-xl border p-3 flex items-center gap-3",
                        urgencyStyles.bg,
                        urgencyStyles.border
                    )}
                >
                    <div className={cn("shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-background/80 ring-1", urgencyStyles.ring)}>
                        {urgency === 'overdue' ? (
                            <AlertTriangle className={cn("w-5 h-5", urgencyStyles.text)} />
                        ) : urgency === 'none' ? (
                            <CalendarCheck className={cn("w-5 h-5", urgencyStyles.text)} />
                        ) : (
                            <CalendarClock className={cn("w-5 h-5", urgencyStyles.text)} />
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        {urgency === 'overdue' ? (
                            <>
                                <div className={cn("text-lg font-black leading-none tracking-tight", urgencyStyles.text)}>
                                    ATRASADO
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-1">
                                    {Math.abs(deadline.daysDiff!)}d desde o prazo{deadline.date ? ` · ${formatDate(deadline.date)}` : ''}
                                </div>
                            </>
                        ) : urgency === 'none' ? (
                            <>
                                <div className="text-lg font-black leading-none tracking-tight text-zinc-400">
                                    Sem prazo
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-1">
                                    Defina um prazo para priorizar
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-baseline gap-1.5">
                                    <span className={cn("text-3xl font-black leading-none tracking-tight tabular-nums", urgencyStyles.text)}>
                                        {deadline.daysDiff}
                                    </span>
                                    <span className={cn("text-sm font-bold", urgencyStyles.text)}>
                                        {deadline.daysDiff === 1 ? 'dia' : 'dias'}
                                    </span>
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-1">
                                    Vence em {deadline.date ? formatDate(deadline.date) : '—'}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Bloco de demandas — grande e escaneável */}
                {client.activeTaskCount > 0 && (
                    <div className="rounded-xl border border-border/40 bg-muted/30 p-3 space-y-2.5">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black leading-none tabular-nums text-foreground">
                                {client.activeTaskCount}
                            </span>
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                {client.activeTaskCount === 1 ? 'demanda em aberto' : 'demandas em aberto'}
                            </span>
                        </div>

                        {activeStatuses.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {activeStatuses.map(([status, count]) => {
                                    const info = statusLabels[status];
                                    if (!info) return null;
                                    return (
                                        <div
                                            key={status}
                                            className={cn(
                                                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1",
                                                info.chipBg,
                                                info.chipBorder
                                            )}
                                        >
                                            <span className={cn("text-sm font-bold tabular-nums", info.chipText)}>
                                                {count}
                                            </span>
                                            <span className={cn("text-[11px] font-semibold", info.chipText)}>
                                                {info.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            <CardFooter className="mt-auto pt-3">
                <Button
                    className="w-full font-bold text-sm h-9 group-hover:bg-primary"
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect(client.id);
                    }}
                >
                    Ver Projeto
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
            </CardFooter>
        </Card>
    );
}
