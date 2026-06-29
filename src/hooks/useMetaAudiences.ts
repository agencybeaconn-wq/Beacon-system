import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';

export interface MetaAudience {
    id: string;
    name: string;
    description?: string;
    type: 'CUSTOM' | 'SAVED';
    subtype?: string; // LOOKALIKE, WEBSITE, CUSTOM, SAVED
    origin: 'META';
    time_created?: string;
    approximate_count?: number;
    rule?: string;
    lookalike_spec?: any;
    retention_days?: number;
    pixel_id?: string;
    targeting?: any;
}

export function useMetaAudiences() {
    const { selectedAccountId } = useDashboard();
    const [metaAudiences, setMetaAudiences] = useState<MetaAudience[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedAccountId) {
            setMetaAudiences([]);
            return;
        }

        const fetchAudiences = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Obter o token de acesso para a conta selecionada
                const { data: accountData, error: accountError } = await supabase
                    .from('ad_accounts')
                    .select('access_token')
                    .eq('id', selectedAccountId)
                    .maybeSingle();

                if (accountError) throw accountError;

                if (!accountData?.access_token) {
                    throw new Error('Conta de anúncios sem token de acesso válido.');
                }

                const { data, error: funcError } = await supabase.functions.invoke('manage-custom-audiences', {
                    body: {
                        action: 'LIST',
                        accountId: selectedAccountId,
                        accessToken: accountData.access_token
                    }
                });

                if (funcError) throw funcError;
                if (data.error) throw new Error(data.error);

                setMetaAudiences(data.audiences || []);

            } catch (err: any) {
                console.error('Error fetching meta audiences:', err);
                setError(err.message || 'Erro ao carregar públicos do Meta.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAudiences();
    }, [selectedAccountId]);

    const deleteMetaAudience = async (audienceId: string) => {
        if (!selectedAccountId) return;

        try {
            const { data: accountData, error: accountError } = await supabase
                .from('ad_accounts')
                .select('access_token')
                .eq('id', selectedAccountId)
                .maybeSingle();

            if (accountError || !accountData?.access_token) {
                throw new Error('Erro de autenticação ao tentar excluir público.');
            }

            const { data, error: funcError } = await supabase.functions.invoke('manage-custom-audiences', {
                body: {
                    action: 'DELETE',
                    accountId: selectedAccountId,
                    accessToken: accountData.access_token,
                    audienceId
                }
            });

            if (funcError) throw funcError;
            if (data.error) throw new Error(data.error);

            // Update local state
            setMetaAudiences(prev => prev.filter(a => a.id !== audienceId));
            return true;

        } catch (err: any) {
            console.error('Error deleting meta audience:', err);
            throw err;
        }
    };

    return { metaAudiences, isLoading, error, deleteMetaAudience };
}
