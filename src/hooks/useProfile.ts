import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Profile {
    id: string;
    email?: string; // Added email
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    headline: string | null;
    company_name: string | null;
    instagram_handle: string | null;
    phone: string | null;
    created_at: string;
    updated_at: string;
}

export interface ProfileUpdate {
    username?: string;
    full_name?: string;
    avatar_url?: string;
    headline?: string;
    company_name?: string;
    instagram_handle?: string;
    phone?: string;
}

export function useProfile() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: profile, isLoading, error } = useQuery({
        queryKey: ['profile'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (error) {
                console.error('Profile fetch error:', error);
                throw error;
            }

            // If profile doesn't exist, create it
            if (!data) {
                console.log('Profile not found, creating...');
                const { data: newProfile, error: createError } = await supabase
                    .from('profiles')
                    .insert({
                        id: user.id,
                        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
                        avatar_url: user.user_metadata?.avatar_url || null,
                    })
                    .select()
                    .single();

                if (createError) {
                    console.error('Profile creation error:', createError);
                    throw createError;
                }

                return { ...newProfile, email: user.email } as Profile;
            }

            return { ...data, email: user.email } as Profile;
        },
    });

    const updateProfile = useMutation({
        mutationFn: async (updates: ProfileUpdate) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id)
                .select()
                .single();

            if (error) throw error;

            // Sincronizar nome com team_members para que apareça em todo o sistema
            if (updates.full_name) {
                await (supabase as any)
                    .from('team_members')
                    .update({ name: updates.full_name })
                    .eq('user_id', user.id);
            }

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            toast({
                title: 'Perfil atualizado',
                description: 'Suas informações foram salvas com sucesso.',
            });
        },
        onError: (error: Error) => {
            toast({
                title: 'Erro ao atualizar perfil',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    return {
        profile,
        isLoading,
        error,
        updateProfile: updateProfile.mutate,
        isUpdating: updateProfile.isPending,
    };
}
