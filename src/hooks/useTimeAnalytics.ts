import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TimeAnalyticsRange {
    startDate: string; // "YYYY-MM-DD HH:mm:ss"
    endDate: string;
}

interface RawEntry {
    id: string;
    task_id: string;
    user_id: string;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    client_tasks: {
        id: string;
        title: string | null;
        area: string | null;
        project_type: string | null;
        client_id: string | null;
        agency_clients?: {
            id: string;
            name: string | null;
            client_type: string | null;
        } | null;
    } | null;
}

export interface TimeBucket {
    key: string;
    label: string;
    seconds: number;
    sessions: number;
}

export interface TimeAnalyticsResult {
    totalSeconds: number;
    totalSessions: number;
    avgSessionSeconds: number;
    distinctTasks: number;
    byArea: TimeBucket[];
    byClient: TimeBucket[];
    byType: TimeBucket[]; // fixo / avulso (com herança do cliente)
    byMember: TimeBucket[];
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
}

const AREA_LABEL: Record<string, string> = {
    traffic: "Tráfego",
    design: "Design",
    copy: "Copy",
    strategy: "Estratégia",
    dev: "Dev",
};

function labelFor(key: string, map: Record<string, string>): string {
    return map[key] || key;
}

function normType(entry: RawEntry): 'fixo' | 'avulso' {
    const task = entry.client_tasks;
    const explicit = task?.project_type;
    if (explicit === 'fixo') return 'fixo';
    if (explicit === 'avulso') return 'avulso';
    const clientType = task?.agency_clients?.client_type;
    return clientType === 'fixo' ? 'fixo' : 'avulso';
}

export function useTimeAnalytics(range: TimeAnalyticsRange): TimeAnalyticsResult {
    const [entries, setEntries] = useState<RawEntry[]>([]);
    const [memberNames, setMemberNames] = useState<Map<string, string>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Buscar entries com durations fechadas DENTRO do período
            // Critério simples: started_at dentro do range (sessão iniciada no período)
            const { data, error: err } = await (supabase as any)
                .from('task_time_entries')
                .select(`
                    id, task_id, user_id, started_at, ended_at, duration_seconds,
                    client_tasks:task_id (
                        id, title, area, project_type, client_id,
                        agency_clients:client_id ( id, name, client_type )
                    )
                `)
                .gte('started_at', range.startDate)
                .lte('started_at', range.endDate);

            if (err) throw err;
            const rows = (data as RawEntry[]) || [];
            setEntries(rows);

            // Buscar nomes dos membros envolvidos
            const userIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)));
            if (userIds.length > 0) {
                const { data: profiles } = await (supabase as any)
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds);
                const nameMap = new Map<string, string>();
                for (const p of (profiles as any[]) || []) {
                    nameMap.set(p.id, p.full_name || 'Membro');
                }
                setMemberNames(nameMap);
            } else {
                setMemberNames(new Map());
            }
        } catch (e: any) {
            console.error('[useTimeAnalytics] error:', e);
            setError(e?.message || 'Erro ao carregar analytics de tempo');
            setEntries([]);
        } finally {
            setIsLoading(false);
        }
    }, [range.startDate, range.endDate]);

    useEffect(() => {
        load();
    }, [load]);

    const result = useMemo<Omit<TimeAnalyticsResult, 'isLoading' | 'error' | 'refetch'>>(() => {
        // Só contabilizamos sessões fechadas (com duration_seconds)
        const closed = entries.filter(e => e.duration_seconds != null && e.duration_seconds > 0);

        const totalSeconds = closed.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
        const totalSessions = closed.length;
        const avgSessionSeconds = totalSessions > 0 ? Math.round(totalSeconds / totalSessions) : 0;
        const distinctTasks = new Set(closed.map(e => e.task_id)).size;

        const bucket = (key: string, label: string, map: Map<string, TimeBucket>) => {
            const existing = map.get(key);
            if (existing) return existing;
            const nb: TimeBucket = { key, label, seconds: 0, sessions: 0 };
            map.set(key, nb);
            return nb;
        };

        const areaMap = new Map<string, TimeBucket>();
        const clientMap = new Map<string, TimeBucket>();
        const typeMap = new Map<string, TimeBucket>();
        const memberMap = new Map<string, TimeBucket>();

        for (const e of closed) {
            const secs = e.duration_seconds || 0;
            const task = e.client_tasks;

            const areaKey = task?.area || 'sem_area';
            const areaLabel = task?.area ? labelFor(task.area, AREA_LABEL) : 'Sem setor';
            const a = bucket(areaKey, areaLabel, areaMap);
            a.seconds += secs; a.sessions += 1;

            const clientKey = task?.client_id || 'sem_cliente';
            const clientLabel = task?.agency_clients?.name || 'Sem cliente';
            const c = bucket(clientKey, clientLabel, clientMap);
            c.seconds += secs; c.sessions += 1;

            const tKey = normType(e);
            const tLabel = tKey === 'fixo' ? 'Fixo (MRR)' : 'Avulso';
            const t = bucket(tKey, tLabel, typeMap);
            t.seconds += secs; t.sessions += 1;

            const memberKey = e.user_id;
            const memberLabel = memberNames.get(e.user_id) || 'Membro';
            const m = bucket(memberKey, memberLabel, memberMap);
            m.seconds += secs; m.sessions += 1;
        }

        const sortDesc = (arr: TimeBucket[]) => [...arr].sort((a, b) => b.seconds - a.seconds);

        return {
            totalSeconds,
            totalSessions,
            avgSessionSeconds,
            distinctTasks,
            byArea: sortDesc(Array.from(areaMap.values())),
            byClient: sortDesc(Array.from(clientMap.values())),
            byType: sortDesc(Array.from(typeMap.values())),
            byMember: sortDesc(Array.from(memberMap.values())),
        };
    }, [entries, memberNames]);

    return {
        ...result,
        isLoading,
        error,
        refetch: load,
    };
}
