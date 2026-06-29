/**
 * useBriefings — Hook CRUD para Briefings Internos
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Briefing {
    id: string;
    workspace_id: string;
    client_name: string;
    client_group_id: string | null;
    answers: Record<string, any>;
    ai_summary: string | null;
    status: 'draft' | 'completed';
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export function useBriefings() {
    const [briefings, setBriefings] = useState<Briefing[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);

    const getWorkspace = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        // Try owner first
        const { data: ownedWs } = await (supabase as any)
            .from('workspaces')
            .select('id')
            .eq('owner_id', user.id)
            .limit(1);

        if (ownedWs && ownedWs.length > 0) {
            setWorkspaceId(ownedWs[0].id);
            return ownedWs[0];
        }

        // Try team member
        const { data: memberWs } = await (supabase as any)
            .from('team_members')
            .select('workspace_id')
            .eq('user_id', user.id)
            .limit(1);

        if (memberWs && memberWs.length > 0) {
            setWorkspaceId(memberWs[0].workspace_id);
            return { id: memberWs[0].workspace_id };
        }

        return null;
    }, []);

    const fetchBriefings = useCallback(async () => {
        setIsLoading(true);
        try {
            const ws = await getWorkspace();
            if (!ws) { setIsLoading(false); return; }

            const { data, error } = await (supabase as any)
                .from('briefings')
                .select('*')
                .eq('workspace_id', ws.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBriefings(data || []);
        } catch (err: any) {
            console.error('Erro ao carregar briefings:', err);
        } finally {
            setIsLoading(false);
        }
    }, [getWorkspace]);

    useEffect(() => { fetchBriefings(); }, [fetchBriefings]);

    const createBriefing = async (clientName: string, clientGroupId: string | null, answers: Record<string, any>): Promise<Briefing | null> => {
        try {
            const ws = await getWorkspace();
            if (!ws) throw new Error('Workspace não encontrado');
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await (supabase as any)
                .from('briefings')
                .insert({
                    workspace_id: ws.id,
                    client_name: clientName,
                    client_group_id: clientGroupId,
                    answers,
                    status: 'completed',
                    created_by: user?.id,
                })
                .select()
                .single();

            if (error) throw error;
            toast.success('Briefing criado com sucesso!');
            await fetchBriefings();
            return data;
        } catch (err: any) {
            toast.error('Erro ao criar briefing: ' + err.message);
            return null;
        }
    };

    const updateBriefingSummary = async (id: string, summary: string) => {
        try {
            const { error } = await (supabase as any)
                .from('briefings')
                .update({ ai_summary: summary, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            setBriefings(prev => prev.map(b => b.id === id ? { ...b, ai_summary: summary } : b));
        } catch (err: any) {
            toast.error('Erro ao salvar resumo: ' + err.message);
        }
    };

    const deleteBriefing = async (id: string) => {
        try {
            const { error } = await (supabase as any)
                .from('briefings')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Briefing excluído');
            setBriefings(prev => prev.filter(b => b.id !== id));
        } catch (err: any) {
            toast.error('Erro ao excluir: ' + err.message);
        }
    };

    return { briefings, isLoading, workspaceId, createBriefing, updateBriefingSummary, deleteBriefing, refetch: fetchBriefings };
}
