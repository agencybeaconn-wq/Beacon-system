import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';

export interface TeamMember {
    id: string; // workspace_member_id
    user_id: string;
    role: string;
    email: string; // used for matching calendar attendees
    profile: {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
    } | null;
}

export function useAgencyTeam() {
    const { workspaceId } = useDashboard();

    const teamQuery = useQuery({
        queryKey: ['team_members', workspaceId],
        queryFn: async () => {
            if (!workspaceId) return [];

            // 1. Fetch team_members - only ACTIVE, exclude clients
            const { data: members, error: membersError } = await (supabase as any)
                .from('team_members')
                .select('id, user_id, email, name, role, user_type, status')
                .eq('workspace_id', workspaceId)
                .eq('status', 'active')
                .neq('role', 'cliente')
                .neq('role', 'client')
                .neq('user_type', 'client');

            if (membersError) {
                console.error('[useAgencyTeam] Error fetching members:', membersError);
                throw membersError;
            }

            // 2. Deduplicate by email (case-insensitive) - keep the one with user_id
            const seen = new Map<string, any>();
            for (const m of (members || [])) {
                const key = (m.email || m.id).toLowerCase();
                const existing = seen.get(key);
                if (!existing || (m.user_id && !existing.user_id)) {
                    seen.set(key, m);
                }
            }

            // 2.5. Cross-check against agency_clients to exclude client emails
            const { data: clientsData } = await (supabase as any)
                .from('agency_clients')
                .select('portal_email')
                .eq('workspace_id', workspaceId);
            const clientEmails = new Set(
                (clientsData || [])
                    .map((c: any) => (c.portal_email || '').toLowerCase().trim())
                    .filter((e: string) => e.length > 0)
            );
            // Remove members whose email matches a known client
            for (const [key, m] of seen) {
                if (m.email && clientEmails.has(m.email.toLowerCase().trim())) {
                    seen.delete(key);
                }
            }

            // 3. Batch fetch real profiles for avatar and name
            const userIds = Array.from(seen.values())
                .map((m: any) => m.user_id)
                .filter(Boolean);

            let profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
            if (userIds.length > 0) {
                const { data: profiles } = await (supabase as any)
                    .from('profiles')
                    .select('id, full_name, avatar_url')
                    .in('id', userIds);

                for (const p of (profiles || [])) {
                    profileMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url });
                }
            }

            // 4. Map to TeamMember with real name + avatar + email
            const finalTeam: TeamMember[] = Array.from(seen.values()).map((m: any) => {
                const prof = m.user_id ? profileMap.get(m.user_id) : null;
                return {
                    id: m.id,
                    user_id: m.user_id || `invited_${m.id}`,
                    role: m.role,
                    email: (m.email || '').toLowerCase().trim(),
                    profile: {
                        id: m.user_id || m.id,
                        full_name: (prof?.full_name && prof.full_name.trim() && !prof.full_name.includes('@'))
                            ? prof.full_name.trim()
                            : (m.name && m.name.trim() && !m.name.includes('@'))
                            ? m.name.trim()
                            : m.email?.split('@')[0] || 'Membro',
                        avatar_url: prof?.avatar_url || null
                    }
                };
            });

            return finalTeam;
        },
        enabled: !!workspaceId
    });

    return {
        members: teamQuery.data || [],
        isLoading: teamQuery.isLoading,
        error: teamQuery.error
    };
}
