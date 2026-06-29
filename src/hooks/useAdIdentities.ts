import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";

export interface Identity {
    id: string;
    name: string;
    username?: string;
    picture_url?: string;
    page_id_vinculada?: string; // Para Instagrams: ID da página do Facebook vinculada
    is_page_backed?: boolean; // Flag to identify ad-ready actors
}

export interface AdIdentities {
    pages: Identity[];
    instagramAccounts: Identity[];
    isLoading: boolean;
    error: string | null;
}

export function useAdIdentities(accountId?: string) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['adIdentities', accountId],
        queryFn: async () => {
            if (!accountId) return { pages: [], instagramAccounts: [] };

            console.log("🔍 [useAdIdentities] Calling get-ad-identities for accountId:", accountId);

            const { data, error } = await supabase.functions.invoke('get-ad-identities', {
                body: { accountId }
            });

            console.log("🔍 [useAdIdentities] Raw Response:", { data, error, success: data?.success });

            if (error) throw error;
            if (!data.success) throw new Error(data.error || "Erro ao buscar identidades");

            console.log("✅ [useAdIdentities] Pages found:", data.pages?.length || 0);

            return {
                pages: (data.pages || []) as Identity[],
                instagramAccounts: (data.instagramAccounts || []) as Identity[]
            };
        },
        enabled: !!accountId,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
        retry: 2
    });

    return {
        pages: data?.pages || [],
        instagramAccounts: data?.instagramAccounts || [],
        isLoading,
        error: error ? (error as Error).message : null
    };
}
