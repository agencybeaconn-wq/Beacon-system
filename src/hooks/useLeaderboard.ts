import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AuthorityTier } from '@/lib/authorityUtils';
import { calculateTier } from '@/lib/authorityUtils';

export interface LeaderboardEntry {
    rank: number;
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
    instagram_handle: string | null;
    lifetime_spend: number;
    highest_roas: number;
    tier: AuthorityTier;
    isCurrentUser: boolean;
}

export function useLeaderboard() {
    const { data: leaderboard, isLoading, error } = useQuery({
        queryKey: ['leaderboard'],
        queryFn: async (): Promise<LeaderboardEntry[]> => {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            const currentUserId = user?.id;

            // 1. Fetch top 50 user_authority ordered by lifetime_spend
            const { data: authorityData, error: authorityError } = await supabase
                .from('user_authority')
                .select('user_id, lifetime_spend, highest_roas')
                .order('lifetime_spend', { ascending: false })
                .limit(50);

            if (authorityError) {
                console.error('Leaderboard authority fetch error:', authorityError);
                throw authorityError;
            }

            if (!authorityData || authorityData.length === 0) {
                return [];
            }

            // 2. Fetch profiles for these users
            const userIds = authorityData.map(a => a.user_id);
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, username, instagram_handle')
                .in('id', userIds);

            if (profilesError) {
                console.error('Leaderboard profiles fetch error:', profilesError);
                throw profilesError;
            }

            // 3. Merge data
            const profilesMap = new Map(profilesData?.map(p => [p.id, p]));

            const leaderboard: LeaderboardEntry[] = authorityData.map((authority, index) => {
                const profile = profilesMap.get(authority.user_id);
                const lifetimeSpend = authority.lifetime_spend || 0;
                const tier = calculateTier(lifetimeSpend);

                return {
                    rank: index + 1,
                    user_id: authority.user_id,
                    full_name: profile?.full_name || null,
                    avatar_url: profile?.avatar_url || null,
                    username: profile?.username || null,
                    instagram_handle: profile?.instagram_handle || null,
                    lifetime_spend: lifetimeSpend,
                    highest_roas: authority.highest_roas || 0,
                    tier,
                    isCurrentUser: authority.user_id === currentUserId,
                };
            });

            return leaderboard;
        },
    });

    return {
        leaderboard: leaderboard || [],
        isLoading,
        error,
    };
}
