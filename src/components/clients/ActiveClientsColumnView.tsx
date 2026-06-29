import { useMemo } from "react";
import { ActiveClientCard } from "./ActiveClientCard";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Repeat } from "lucide-react";

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
    tasksByStatus?: any;
    onboardingStatus?: string;
    currentPhaseName?: string | null;
    onboardingProgress?: number;
    onboardingTotalTasks?: number;
    onboardingCompletedTasks?: number;
}

interface ActiveClientsColumnViewProps {
    clients: ActiveClientData[];
    onSelectClient: (id: string) => void;
}

function getEffectiveDeadline(c: ActiveClientData): number | null {
    const raw = c.project_deadline || c.latestDueDate;
    if (!raw) return null;
    const ms = new Date(raw).getTime();
    return Number.isNaN(ms) ? null : ms;
}

function sortByPriority(clients: ActiveClientData[]): ActiveClientData[] {
    const now = Date.now();
    return [...clients].sort((a, b) => {
        const dA = getEffectiveDeadline(a);
        const dB = getEffectiveDeadline(b);

        const overdueA = dA !== null && dA < now;
        const overdueB = dB !== null && dB < now;

        // 1. Atrasados sempre antes de não-atrasados
        if (overdueA !== overdueB) return overdueA ? -1 : 1;

        if (overdueA && overdueB) {
            // Ambos atrasados: mais atrasado (deadline menor) primeiro
            return (dA as number) - (dB as number);
        }

        // Nenhum atrasado: mais próximo do vencimento primeiro; sem prazo vai pro fim
        const vA = dA ?? Infinity;
        const vB = dB ?? Infinity;
        if (vA !== vB) return vA - vB;

        // 2. Desempate: mais demandas ativas primeiro
        return b.activeTaskCount - a.activeTaskCount;
    });
}

export function ActiveClientsColumnView({ clients, onSelectClient }: ActiveClientsColumnViewProps) {
    const { fixoClients, avulsoClients } = useMemo(() => {
        const fixo = clients.filter(c => c.client_type === 'fixo');
        const avulso = clients.filter(c => c.client_type !== 'fixo');
        return {
            fixoClients: sortByPriority(fixo),
            avulsoClients: sortByPriority(avulso),
        };
    }, [clients]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Coluna Fixo (MRR) */}
            <div className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-emerald-500/20">
                    <Repeat className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-500">
                        Fixo (MRR)
                    </h3>
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-0 text-[10px] font-bold">
                        {fixoClients.length}
                    </Badge>
                </div>
                {fixoClients.length > 0 ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 auto-rows-fr items-stretch">
                        {fixoClients.map(client => (
                            <ActiveClientCard
                                key={client.id}
                                client={client}
                                onSelect={onSelectClient}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                        Nenhum cliente fixo com demandas ativas.
                    </p>
                )}
            </div>

            {/* Coluna Avulso */}
            <div className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-orange-500/20">
                    <Briefcase className="w-4 h-4 text-orange-500" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-orange-500">
                        Avulso
                    </h3>
                    <Badge className="bg-orange-500/10 text-orange-500 border-0 text-[10px] font-bold">
                        {avulsoClients.length}
                    </Badge>
                </div>
                {avulsoClients.length > 0 ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 auto-rows-fr items-stretch">
                        {avulsoClients.map(client => (
                            <ActiveClientCard
                                key={client.id}
                                client={client}
                                onSelect={onSelectClient}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                        Nenhum cliente avulso com demandas ativas.
                    </p>
                )}
            </div>
        </div>
    );
}
