import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import { useEffect } from "react";

export interface ProductSet {
    id: string;
    name: string;
    product_count?: number;
}

export interface ProductCatalog {
    id: string;
    name: string;
    product_count?: number;
    vertical?: string;
    product_sets: ProductSet[];
}

export function useProductCatalogs() {
    const { selectedAccountId } = useDashboard();

    // 🔍 DEBUG: Log when hook is called
    useEffect(() => {
        console.log('📦 [useProductCatalogs] Hook mounted/updated. selectedAccountId:', selectedAccountId);
    }, [selectedAccountId]);

    const query = useQuery({
        queryKey: ['product-catalogs', selectedAccountId],
        queryFn: async (): Promise<ProductCatalog[]> => {
            console.log('📦 [useProductCatalogs] queryFn CALLED for account:', selectedAccountId);

            if (!selectedAccountId) {
                console.log('📦 [useProductCatalogs] No account selected, returning empty');
                return [];
            }

            console.log('📦 [useProductCatalogs] Invoking get-product-catalogs...');
            const { data, error } = await supabase.functions.invoke('get-product-catalogs', {
                body: { accountId: selectedAccountId }
            });

            console.log('📦 [useProductCatalogs] Raw response:', { data, error });

            if (error) {
                console.error('❌ [useProductCatalogs] Error:', error);
                throw error;
            }

            if (data.error) {
                console.error('❌ [useProductCatalogs] API Error:', data.error);
                throw new Error(data.error);
            }

            console.log('📦 [useProductCatalogs] Response:', {
                count: data.catalogs?.length,
                data: data.catalogs,
                debug: data.debug // 🔍 Debug info from edge function
            });

            // Log debug info if present
            if (data.debug) {
                console.log('🔍 [useProductCatalogs] Edge Function Debug:', data.debug);
            }

            return data.catalogs || [];
        },
        enabled: !!selectedAccountId,
        staleTime: 0, // 🔧 DEBUG: Disable cache for testing
        gcTime: 0, // 🔧 DEBUG: Don't keep in garbage collection
        retry: 1
    });

    // 🔍 DEBUG: Log query state
    useEffect(() => {
        console.log('📦 [useProductCatalogs] Query state:', {
            isLoading: query.isLoading,
            isFetching: query.isFetching,
            isError: query.isError,
            dataLength: query.data?.length,
            error: query.error
        });
    }, [query.isLoading, query.isFetching, query.isError, query.data, query.error]);

    return {
        catalogs: query.data || [],
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch
    };
}
