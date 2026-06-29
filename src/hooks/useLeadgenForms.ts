import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LeadgenForm {
    id: string;
    name: string;
    status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
    leads_count: number;
    is_active: boolean;
    created_time?: string;
    questions?: Array<{
        type: string;
        key: string;
        label?: string;
    }>;
}

interface UseLeadgenFormsOptions {
    pageId?: string;
    accountId?: string;
    autoFetch?: boolean;
}

interface UseLeadgenFormsReturn {
    forms: LeadgenForm[];
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    activeFormsCount: number;
}

export function useLeadgenForms(options: UseLeadgenFormsOptions = {}): UseLeadgenFormsReturn {
    const { pageId, accountId, autoFetch = true } = options;

    const [forms, setForms] = useState<LeadgenForm[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchForms = useCallback(async () => {
        if (!pageId) {
            console.log('[useLeadgenForms] No pageId provided, skipping fetch');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log(`[useLeadgenForms] Fetching lead forms for page: ${pageId}`);

            const { data, error: fnError } = await supabase.functions.invoke('list-leadgen-forms', {
                body: {
                    pageId,
                    accountId
                }
            });

            if (fnError) {
                throw new Error(fnError.message);
            }

            if (!data.success) {
                throw new Error(data.error || 'Erro ao buscar formulários');
            }

            const fetchedForms = data.forms || [];
            console.log(`[useLeadgenForms] Found ${fetchedForms.length} forms`);

            setForms(fetchedForms);
        } catch (err: any) {
            console.error('[useLeadgenForms] Error:', err);
            setError(err.message || 'Erro ao buscar formulários de lead');
            setForms([]);
        } finally {
            setIsLoading(false);
        }
    }, [pageId, accountId]);

    useEffect(() => {
        if (autoFetch && pageId) {
            fetchForms();
        }
    }, [autoFetch, pageId, fetchForms]);

    const activeFormsCount = forms.filter(f => f.is_active).length;

    return {
        forms,
        isLoading,
        error,
        refetch: fetchForms,
        activeFormsCount
    };
}

export type { LeadgenForm };
