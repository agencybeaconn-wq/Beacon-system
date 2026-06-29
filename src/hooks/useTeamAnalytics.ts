import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";

export interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar_url?: string;
    phone?: string;
}

export interface TaskRecord {
    id: string;
    status: string;
    assignee_id: string | null;
    area: string | null;
    priority: string;
    created_at: string;
    due_date: string | null;
    completed_at: string | null;
    client_id: string;
    title: string;
}

export interface SectorMetrics {
    sector: string;
    label: string;
    total: number;
    done: number;
    inProgress: number;
    pending: number;
    blocked: number;
    color: string;
}

export interface MemberMetrics {
    member: TeamMember;
    total: number;
    done: number;
    inProgress: number;
    pending: number;
    blocked: number;
    other: number;
    overdue: number;
    avgDeliveryDays: number | null;
}

export interface TeamAnalytics {
    // Raw data
    tasks: TaskRecord[];
    members: TeamMember[];
    isLoading: boolean;

    // Summary stats
    totalTasks: number;
    inProgressTasks: number;
    doneTasks: number;
    overdueTasks: number;
    blockedTasks: number;
    backlogTasks: number;

    // Derived
    avgDeliveryDays: number | null;
    sectorMetrics: SectorMetrics[];
    memberMetrics: MemberMetrics[];
    priorityBreakdown: { priority: string; label: string; count: number; color: string }[];
}

const SECTOR_CONFIG: Record<string, { label: string; color: string }> = {
    traffic: { label: "Tráfego", color: "#f59e0b" },
    design: { label: "Design", color: "#8b5cf6" },
    dev: { label: "Dev", color: "#3b82f6" },
    copy: { label: "Copy", color: "#10b981" },
    strategy: { label: "Estratégia", color: "#ef4444" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    low: { label: "Baixa", color: "#6b7280" },
    medium: { label: "Normal", color: "#3b82f6" },
    high: { label: "Alta", color: "#f59e0b" },
    critical: { label: "Urgente", color: "#ef4444" },
};

export interface AnalyticsDateRange {
    startDate: string; // "YYYY-MM-DD HH:mm:ss"
    endDate: string;
}

export function useTeamAnalytics(dateRange?: AnalyticsDateRange): TeamAnalytics & { refetch: () => void } {
    const { workspaceId } = useDashboard();
    const [tasks, setTasks] = useState<TaskRecord[]>([]);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        if (!workspaceId) return;
            setIsLoading(true);
            try {
                // Fetch tasks: workspace-matched + null workspace (two queries to avoid .or() 400 error)
                const selectCols = "id, status, assignee_id, area, priority, created_at, due_date, completed_at, client_id, title, archived_at";

                const [wsResult, nullResult] = await Promise.all([
                    (supabase as any).from("client_tasks").select(selectCols).eq("workspace_id", workspaceId).is("archived_at", null),
                    (supabase as any).from("client_tasks").select(selectCols).is("workspace_id", null).is("archived_at", null),
                ]);

                if (wsResult.error) throw wsResult.error;
                if (nullResult.error) throw nullResult.error;

                // Merge and deduplicate by id
                const allTasks = [...(wsResult.data || []), ...(nullResult.data || [])];
                const seen = new Set<string>();
                const tasksData = allTasks.filter((t: any) => {
                    if (seen.has(t.id)) return false;
                    seen.add(t.id);
                    return true;
                });

                console.log('[useTeamAnalytics] Tasks:', tasksData.length);
                const uniqueStatuses = [...new Set(tasksData.map((t: any) => t.status))];
                console.log('[useTeamAnalytics] Unique statuses:', uniqueStatuses);

                // Fetch team members
                const { data: membersData, error: membersErr } = await (supabase as any)
                    .from("team_members")
                    .select("user_id, name, email, role, user_type, phone")
                    .eq("workspace_id", workspaceId)
                    .in("status", ["active", "invited"])
                    .neq("user_type", "client");

                if (membersErr) throw membersErr;

                // Batch-fetch profiles for avatar_url and full_name
                const userIds = (membersData || []).map((m: any) => m.user_id).filter(Boolean);
                let profileMap = new Map<string, { full_name: string | null; avatar_url: string | null; phone: string | null }>();
                if (userIds.length > 0) {
                    const { data: profiles } = await (supabase as any)
                        .from('profiles')
                        .select('id, full_name, avatar_url, phone')
                        .in('id', userIds);
                    for (const p of (profiles || [])) {
                        profileMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url, phone: p.phone });
                    }
                }

                setTasks(tasksData || []);
                setMembers(
                    (membersData || [])
                        .filter((m: any) => m.user_id)
                        .map((m: any) => {
                            const prof = profileMap.get(m.user_id);
                            return {
                                id: m.user_id,
                                name: (prof?.full_name && prof.full_name.trim() && !prof.full_name.includes('@'))
                                    ? prof.full_name.trim()
                                    : (m.name && m.name.trim() && !m.name.includes('@'))
                                    ? m.name.trim()
                                    : m.email?.split("@")[0] || "Sem nome",
                                email: m.email || "",
                                role: m.role || "member",
                                avatar_url: prof?.avatar_url || undefined,
                                phone: m.phone || prof?.phone || undefined,
                            };
                        })
                );
            } catch (err) {
                console.error("[useTeamAnalytics] Error:", err);
            } finally {
                setIsLoading(false);
            }
        };

    useEffect(() => {
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    // Serializar dateRange para deps estáveis do useMemo
    const dateRangeKey = dateRange ? `${dateRange.startDate}|${dateRange.endDate}` : 'all';

    const analytics = useMemo<Omit<TeamAnalytics, "tasks" | "members" | "isLoading"> & { filteredTasks: TaskRecord[] }>(() => {
        const now = new Date();

        // Helper: check status categories
        // DB statuses found: concluido., completed, pending, todo, em_progresso, backlog, in_progress, blocked, triage
        const isDone = (s: string) => s === 'done' || s === 'completed' || s === 'concluido.';
        const isInProgress = (s: string) => s === 'in_progress' || s === 'em_progresso';
        const isPending = (s: string) => s === 'pending' || s === 'todo';
        const isBlocked = (s: string) => s === 'blocked';
        const isBacklog = (s: string) => s === 'backlog' || s === 'triage';

        // --- Filtragem por período (client-side) ---
        let filteredTasks = tasks;
        if (dateRange) {
            const rangeStart = new Date(dateRange.startDate);
            const rangeEnd = new Date(dateRange.endDate);
            filteredTasks = tasks.filter(t => {
                const created = new Date(t.created_at);
                const completed = t.completed_at ? new Date(t.completed_at) : null;
                // Task ativa no período: criada antes do fim E (não concluída OU concluída após o início)
                return created <= rangeEnd && (!completed || completed >= rangeStart);
            });
        }

        // --- Summary Stats ---
        const totalTasks = filteredTasks.length;
        const doneTasks = filteredTasks.filter((t) => isDone(t.status)).length;
        const inProgressTasks = filteredTasks.filter((t) => isInProgress(t.status)).length;
        const blockedTasks = filteredTasks.filter((t) => isBlocked(t.status)).length;
        const backlogTasks = filteredTasks.filter((t) => isBacklog(t.status)).length;
        const overdueTasks = filteredTasks.filter((t) => {
            if (!t.due_date) return false;
            if (isDone(t.status)) return false;
            return new Date(t.due_date) < now;
        }).length;

        // --- Avg Delivery Days ---
        const completedTasks = filteredTasks.filter((t) => isDone(t.status) && t.completed_at);
        let avgDeliveryDays: number | null = null;
        if (completedTasks.length > 0) {
            const totalDays = completedTasks.reduce((acc, t) => {
                const created = new Date(t.created_at);
                const completed = new Date(t.completed_at!);
                const diffDays = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
                return acc + Math.max(diffDays, 0);
            }, 0);
            avgDeliveryDays = Math.round((totalDays / completedTasks.length) * 10) / 10;
        }

        // --- Sector Metrics ---
        const sectorMetrics: SectorMetrics[] = Object.entries(SECTOR_CONFIG).map(([key, config]) => {
            const sectorTasks = filteredTasks.filter((t) => t.area === key);
            return {
                sector: key,
                label: config.label,
                total: sectorTasks.length,
                done: sectorTasks.filter((t) => isDone(t.status)).length,
                inProgress: sectorTasks.filter((t) => isInProgress(t.status)).length,
                pending: sectorTasks.filter((t) => isPending(t.status)).length,
                blocked: sectorTasks.filter((t) => isBlocked(t.status)).length,
                color: config.color,
            };
        });

        // Add "Sem setor" for unassigned areas
        const noSectorTasks = filteredTasks.filter((t) => !t.area || !SECTOR_CONFIG[t.area]);
        if (noSectorTasks.length > 0) {
            sectorMetrics.push({
                sector: "none",
                label: "Sem setor",
                total: noSectorTasks.length,
                done: noSectorTasks.filter((t) => isDone(t.status)).length,
                inProgress: noSectorTasks.filter((t) => isInProgress(t.status)).length,
                pending: noSectorTasks.filter((t) => isPending(t.status)).length,
                blocked: noSectorTasks.filter((t) => isBlocked(t.status)).length,
                color: "#9ca3af",
            });
        }

        // Sort by total descending
        sectorMetrics.sort((a, b) => b.total - a.total);

        // --- Member Metrics ---
        const memberMetrics: MemberMetrics[] = members.map((member) => {
            const memberTasks = filteredTasks.filter((t) => t.assignee_id === member.id);
            const memberDoneCount = memberTasks.filter((t) => isDone(t.status)).length;
            const memberDoneWithDate = memberTasks.filter((t) => isDone(t.status) && t.completed_at);
            const memberOverdue = memberTasks.filter((t) => {
                if (!t.due_date) return false;
                if (isDone(t.status)) return false;
                return new Date(t.due_date) < now;
            }).length;

            let memberAvg: number | null = null;
            if (memberDoneWithDate.length > 0) {
                const totalDays = memberDoneWithDate.reduce((acc, t) => {
                    const created = new Date(t.created_at);
                    const completed = new Date(t.completed_at!);
                    return acc + Math.max((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24), 0);
                }, 0);
                memberAvg = Math.round((totalDays / memberDoneWithDate.length) * 10) / 10;
            }

            const mInProgress = memberTasks.filter((t) => isInProgress(t.status)).length;
            const mPending = memberTasks.filter((t) => isPending(t.status)).length;
            const mBlocked = memberTasks.filter((t) => isBlocked(t.status)).length;
            const mOther = memberTasks.length - memberDoneCount - mInProgress - mPending - mBlocked;

            return {
                member,
                total: memberTasks.length,
                done: memberDoneCount,
                inProgress: mInProgress,
                pending: mPending,
                blocked: mBlocked,
                other: Math.max(mOther, 0),
                overdue: memberOverdue,
                avgDeliveryDays: memberAvg,
            };
        });

        // Sort by total descending
        memberMetrics.sort((a, b) => b.total - a.total);

        // --- Priority Breakdown ---
        const priorityBreakdown = Object.entries(PRIORITY_CONFIG).map(([key, config]) => ({
            priority: key,
            label: config.label,
            count: filteredTasks.filter((t) => t.priority === key).length,
            color: config.color,
        }));

        return {
            totalTasks,
            inProgressTasks,
            doneTasks,
            overdueTasks,
            blockedTasks,
            backlogTasks,
            avgDeliveryDays,
            sectorMetrics,
            memberMetrics,
            priorityBreakdown,
            filteredTasks,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasks, members, dateRangeKey]);

    return {
        tasks: analytics.filteredTasks,
        members,
        isLoading,
        ...analytics,
        refetch: fetchData,
    };
}
