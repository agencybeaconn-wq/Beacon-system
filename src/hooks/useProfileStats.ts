import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProfileStats {
    totalVolume: number;
    bestRoas: number;
    memberSince: string;
    daysActive: number;
}

export function useProfileStats() {
    const { data: stats, isLoading, error } = useQuery({
        queryKey: ['profile-stats'],
        queryFn: async (): Promise<ProfileStats> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get user's ad accounts through meta_tokens
            const { data: metaTokens } = await supabase
                .from('meta_tokens')
                .select('account_id')
                .eq('user_id', user.id);

            if (!metaTokens || metaTokens.length === 0) {
                return {
                    totalVolume: 0,
                    bestRoas: 0,
                    memberSince: user.created_at,
                    daysActive: Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)),
                };
            }

            const accountIds = metaTokens.map(t => t.account_id).filter(Boolean);

            // Get campaigns for these accounts
            const { data: campaigns } = await supabase
                .from('campaigns')
                .select('id')
                .in('account_id', accountIds);

            if (!campaigns || campaigns.length === 0) {
                return {
                    totalVolume: 0,
                    bestRoas: 0,
                    memberSince: user.created_at,
                    daysActive: Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)),
                };
            }

            const campaignIds = campaigns.map(c => c.id);

            // Get total volume (sum of all spend)
            const { data: volumeData } = await supabase
                .from('insights')
                .select('spend')
                .in('entity_id', campaignIds)
                .eq('entity_type', 'CAMPAIGN');

            const totalVolume = (volumeData || []).reduce((sum, row) => {
                const spend = typeof row.spend === 'number' ? row.spend : parseFloat(row.spend) || 0;
                return sum + spend;
            }, 0);

            // Get best ROAS day
            const { data: roasData } = await supabase
                .from('insights')
                .select('roas, date')
                .in('entity_id', campaignIds)
                .eq('entity_type', 'CAMPAIGN')
                .not('roas', 'is', null)
                .order('roas', { ascending: false })
                .limit(1);

            const bestRoas = roasData && roasData.length > 0 ? roasData[0].roas : 0;

            // Calculate days active
            const daysActive = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));

            return {
                totalVolume,
                bestRoas,
                memberSince: user.created_at,
                daysActive,
            };
        },
    });

    return {
        stats,
        isLoading,
        error,
    };
}
