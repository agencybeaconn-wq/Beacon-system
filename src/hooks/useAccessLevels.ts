import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AccessLevel {
    id: string;
    workspace_id: string;
    name: string;
    permissions_config: {
        [key: string]: 'none' | 'view' | 'edit'
    };
    created_at: string;
}

export function useAccessLevels() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const getWorkspaceId = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: wsData } = await supabase
            .from('workspaces')
            .select('id')
            .eq('owner_id', user.id)
            .single();

        return wsData?.id;
    };

    const levelsQuery = useQuery({
        queryKey: ['agency_access_levels'],
        queryFn: async () => {
            const workspaceId = await getWorkspaceId();
            if (!workspaceId) return [];

            const { data, error } = await (supabase as any)
                .from('agency_access_levels')
                .select('*')
                .eq('workspace_id', workspaceId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data as AccessLevel[];
        }
    });

    const createLevel = useMutation({
        mutationFn: async ({ name, permissions_config }: { name: string; permissions_config: any }) => {
            const workspaceId = await getWorkspaceId();
            if (!workspaceId) throw new Error("Workspace not found");

            const { data, error } = await (supabase as any)
                .from('agency_access_levels')
                .insert({
                    workspace_id: workspaceId,
                    name,
                    permissions_config
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agency_access_levels'] });
            toast({ title: "Nível de acesso criado!" });
        },
        onError: (error: any) => {
            toast({ variant: "destructive", title: "Erro ao criar nível", description: error.message });
        }
    });

    const updateLevel = useMutation({
        mutationFn: async ({ id, name, permissions_config }: { id: string; name: string; permissions_config: any }) => {
            const { data, error } = await (supabase as any)
                .from('agency_access_levels')
                .update({
                    name,
                    permissions_config
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agency_access_levels'] });
            toast({ title: "Nível de acesso atualizado!" });
        },
        onError: (error: any) => {
            toast({ variant: "destructive", title: "Erro ao atualizar nível", description: error.message });
        }
    });

    const deleteLevel = useMutation({
        mutationFn: async (id: string) => {
            // 1. Delete associated assignments first (Manual Cascade)
            const { error: cascadeError } = await (supabase as any)
                .from('member_access_levels')
                .delete()
                .eq('access_level_id', id);

            if (cascadeError) {
                console.error("Error deleting associations:", cascadeError);
                // Continue anyway, maybe it's soft delete or different error
            }

            // 2. Delete the level itself
            const { error } = await (supabase as any)
                .from('agency_access_levels')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agency_access_levels'] });
            toast({ title: "Nível de acesso removido" });
        },
        onError: (error: any) => {
            toast({ variant: "destructive", title: "Erro ao remover nível", description: error.message });
        }
    });

    return {
        levels: levelsQuery.data || [],
        isLoading: levelsQuery.isLoading,
        createLevel,
        updateLevel,
        deleteLevel
    };
}
