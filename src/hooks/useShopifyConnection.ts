import { useState, useCallback } from 'react';
import {
    pushBulkChanges,
    fetchShopifyProducts,
    type HandleChange,
    type BulkUpdateResult,
    type FetchProductsResult,
} from '@/services/shopifyService';

interface UseShopifyReturn {
    pushChanges: (changes: HandleChange[]) => Promise<BulkUpdateResult>;
    fetchProducts: () => Promise<FetchProductsResult>;
    pushing: boolean;
    fetching: boolean;
}

/**
 * Hook for Shopify integration: push changes and fetch products.
 * Accepts optional clientId to route requests to the correct store.
 */
export function useShopify(clientId?: string): UseShopifyReturn {
    const [pushing, setPushing] = useState(false);
    const [fetching, setFetching] = useState(false);

    const pushChangesHandler = useCallback(
        async (changes: HandleChange[]): Promise<BulkUpdateResult> => {
            setPushing(true);
            try {
                return await pushBulkChanges(changes, clientId);
            } finally {
                setPushing(false);
            }
        },
        [clientId]
    );

    const fetchProductsHandler = useCallback(
        async (): Promise<FetchProductsResult> => {
            setFetching(true);
            try {
                return await fetchShopifyProducts(clientId);
            } finally {
                setFetching(false);
            }
        },
        [clientId]
    );

    return {
        pushChanges: pushChangesHandler,
        fetchProducts: fetchProductsHandler,
        pushing,
        fetching,
    };
}
