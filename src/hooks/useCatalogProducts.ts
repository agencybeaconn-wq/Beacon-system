import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDashboard } from '@/contexts/DashboardContext';

export interface CatalogProduct {
    id: string;
    name: string;
    description?: string;
    price: string;
    sale_price?: string;
    currency: string;
    image_url: string;
    url: string;
    brand?: string;
    availability?: string;
}

export function useCatalogProducts(catalogId?: string, productSetId?: string) {
    const { selectedAccountId } = useDashboard();

    const query = useQuery({
        queryKey: ['catalog-products', selectedAccountId, catalogId, productSetId],
        queryFn: async () => {
            console.log('🛍️ [useCatalogProducts] Fetching products...', { catalogId, productSetId });

            if (!selectedAccountId || (!catalogId && !productSetId)) {
                console.log('🛍️ [useCatalogProducts] Missing required params');
                return [];
            }

            const { data, error } = await supabase.functions.invoke('get-catalog-products', {
                body: {
                    accountId: selectedAccountId,
                    catalogId,
                    productSetId,
                    limit: 10
                }
            });

            if (error) {
                console.error('❌ [useCatalogProducts] Error:', error);
                throw new Error(error.message);
            }

            if (data?.error) {
                console.error('❌ [useCatalogProducts] API Error:', data.error);
                throw new Error(data.error);
            }

            console.log('✅ [useCatalogProducts] Found products:', data?.products?.length || 0);
            return data?.products || [];
        },
        enabled: !!selectedAccountId && !!(catalogId || productSetId),
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 1
    });

    return {
        products: query.data as CatalogProduct[] || [],
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error
    };
}
