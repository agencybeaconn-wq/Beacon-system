import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TimeEntry {
    id: string;
    task_id: string;
    user_id: string;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
}

interface UseTaskTimerResult {
    totalSeconds: number;
    sessionsCount: number;
    isRunning: boolean;
    isLoading: boolean;
    start: () => Promise<void>;
    pause: () => Promise<void>;
}

// Converte segundos em "HH:MM:SS"
export function formatSeconds(total: number): string {
    const safe = Math.max(0, Math.floor(total));
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Cronômetro de tempo gasto em uma demanda.
 *
 * Fonte de verdade:
 * - Histórico: SUM(duration_seconds) das sessões fechadas no banco.
 * - Sessão ativa: (now - started_at) enquanto ended_at IS NULL.
 *
 * Regra UX: ao iniciar uma nova sessão, qualquer sessão aberta do mesmo usuário
 * (em qualquer outra demanda) é fechada automaticamente para impedir contagem dupla.
 */
export function useTaskTimer(taskId: string | null | undefined): UseTaskTimerResult {
    const { user } = useAuth();
    const userId = user?.id;

    const [baseSeconds, setBaseSeconds] = useState(0); // soma histórica fechada
    const [sessionsCount, setSessionsCount] = useState(0); // total de sessões (fechadas + 1 aberta)
    const [runningStart, setRunningStart] = useState<Date | null>(null); // started_at da sessão aberta
    const [runningEntryId, setRunningEntryId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [, setTick] = useState(0); // força re-render por segundo
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isRunning = runningStart !== null;

    // Carrega histórico e detecta sessão aberta
    const reload = useCallback(async () => {
        if (!taskId || !userId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const { data, error } = await (supabase as any)
                .from("task_time_entries")
                .select("id, task_id, user_id, started_at, ended_at, duration_seconds")
                .eq("task_id", taskId)
                .eq("user_id", userId)
                .order("started_at", { ascending: true });

            if (error) throw error;
            const entries: TimeEntry[] = data || [];

            let total = 0;
            let openEntry: TimeEntry | null = null;
            for (const e of entries) {
                if (e.ended_at) {
                    total += e.duration_seconds ?? 0;
                } else {
                    openEntry = e;
                }
            }
            setBaseSeconds(total);
            setSessionsCount(entries.length);
            setRunningStart(openEntry ? new Date(openEntry.started_at) : null);
            setRunningEntryId(openEntry?.id ?? null);
        } catch (err) {
            console.error("[useTaskTimer] reload error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [taskId, userId]);

    useEffect(() => {
        reload();
    }, [reload]);

    // Tick de 1s enquanto rodando
    useEffect(() => {
        if (!isRunning) {
            if (tickRef.current) {
                clearInterval(tickRef.current);
                tickRef.current = null;
            }
            return;
        }
        tickRef.current = setInterval(() => setTick(t => t + 1), 1000);
        return () => {
            if (tickRef.current) {
                clearInterval(tickRef.current);
                tickRef.current = null;
            }
        };
    }, [isRunning]);

    const liveSeconds = runningStart
        ? Math.floor((Date.now() - runningStart.getTime()) / 1000)
        : 0;
    const totalSeconds = baseSeconds + liveSeconds;

    const start = useCallback(async () => {
        if (!taskId || !userId) return;
        if (isRunning) return;
        try {
            // Fecha quaisquer sessões abertas do mesmo usuário (em qualquer task)
            const { data: openRows } = await (supabase as any)
                .from("task_time_entries")
                .select("id, started_at")
                .eq("user_id", userId)
                .is("ended_at", null);

            if (openRows && openRows.length > 0) {
                const nowIso = new Date().toISOString();
                for (const row of openRows) {
                    const startMs = new Date(row.started_at).getTime();
                    const duration = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
                    await (supabase as any)
                        .from("task_time_entries")
                        .update({ ended_at: nowIso, duration_seconds: duration })
                        .eq("id", row.id);
                }
            }

            // Nova sessão
            const { data, error } = await (supabase as any)
                .from("task_time_entries")
                .insert({ task_id: taskId, user_id: userId })
                .select("id, started_at")
                .single();
            if (error) throw error;

            setRunningEntryId(data.id);
            setRunningStart(new Date(data.started_at));
            setSessionsCount(c => c + 1);
        } catch (err) {
            console.error("[useTaskTimer] start error:", err);
            throw err;
        }
    }, [taskId, userId, isRunning]);

    const pause = useCallback(async () => {
        if (!runningEntryId || !runningStart) return;
        try {
            const nowIso = new Date().toISOString();
            const duration = Math.max(
                0,
                Math.floor((Date.now() - runningStart.getTime()) / 1000)
            );
            const { error } = await (supabase as any)
                .from("task_time_entries")
                .update({ ended_at: nowIso, duration_seconds: duration })
                .eq("id", runningEntryId);
            if (error) throw error;

            setBaseSeconds(b => b + duration);
            setRunningEntryId(null);
            setRunningStart(null);
        } catch (err) {
            console.error("[useTaskTimer] pause error:", err);
            throw err;
        }
    }, [runningEntryId, runningStart]);

    return {
        totalSeconds,
        sessionsCount,
        isRunning,
        isLoading,
        start,
        pause,
    };
}
