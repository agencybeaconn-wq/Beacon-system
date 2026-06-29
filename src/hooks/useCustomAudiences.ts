import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomAudience {
    id: string;
    name: string;
    subtype: string; // CUSTOM, LOOKALIKE, WEBSITE, etc.
    approximate_count?: number;
    description?: string;
    time_created?: string;
    delivery_status?: {
        code: number;
        description: string;
    };
}

export function useCustomAudiences(accountId?: string) {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['customAudiences', accountId],
        queryFn: async (): Promise<CustomAudience[]> => {
            if (!accountId) return [];

            console.log("🎯 [useCustomAudiences] Fetching custom audiences for:", accountId);

            // Get access token for the account
            const { data: accountData } = await supabase
                .from('ad_accounts')
                .select('access_token')
                .eq('id', accountId)
                .maybeSingle();

            if (!accountData?.access_token) {
                console.warn('[useCustomAudiences] No access token found for account:', accountId);
                return [];
            }

            // Format account ID for Meta API
            const apiAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

            // Fetch custom audiences from Meta API - Note: approximate_count was removed in v24.0
            const response = await fetch(
                `https://graph.facebook.com/v24.0/${apiAccountId}/customaudiences?fields=id,name,subtype,description,time_created&limit=100&access_token=${accountData.access_token}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[useCustomAudiences] Meta API error:', errorData);
                throw new Error(errorData.error?.message || 'Failed to fetch custom audiences');
            }

            const data = await response.json();

            console.log("✅ [useCustomAudiences] Found audiences:", data.data?.length || 0);

            if (data.data && Array.isArray(data.data)) {
                return data.data.map((audience: any) => ({
                    id: audience.id,
                    name: audience.name,
                    subtype: audience.subtype || 'CUSTOM',
                    approximate_count: audience.approximate_count,
                    description: audience.description,
                    time_created: audience.time_created,
                    delivery_status: audience.delivery_status
                })) as CustomAudience[];
            }

            return [];
        },
        enabled: !!accountId,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
        retry: 2
    });

    return {
        audiences: data || [],
        isLoading,
        error: error ? (error as Error).message : null,
        refetch
    };
}
