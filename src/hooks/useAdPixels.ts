import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";

export interface Pixel {
    id: string;
    name: string;
}

export function useAdPixels(accountId?: string) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['adPixels', accountId],
        queryFn: async () => {
            if (!accountId) return [];

            // Get access token for the account
            const { data: accountData } = await supabase
                .from('ad_accounts')
                .select('access_token')
                .eq('id', accountId)
                .maybeSingle();

            if (!accountData?.access_token) {
                console.warn('[useAdPixels] No access token found for account:', accountId);
                return [];
            }

            // Format account ID for Meta API
            const apiAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

            // Fetch pixels from Meta API
            const response = await fetch(
                `https://graph.facebook.com/v24.0/${apiAccountId}/adspixels?fields=id,name&access_token=${accountData.access_token}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[useAdPixels] Meta API error:', errorData);
                throw new Error(errorData.error?.message || 'Failed to fetch pixels');
            }

            const data = await response.json();
            
            if (data.data && Array.isArray(data.data)) {
                return data.data.map((pixel: any) => ({
                    id: pixel.id,
                    name: pixel.name || `Pixel ${pixel.id}`
                })) as Pixel[];
            }

            return [];
        },
        enabled: !!accountId,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
        retry: 2
    });

    return {
        pixels: data || [],
        isLoading,
        error: error ? (error as Error).message : null
    };
}

