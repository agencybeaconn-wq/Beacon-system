import { supabase } from '@/integrations/supabase/client';

/** Full product data grouped by handle, sent to the Edge Function */
export interface HandleChange {
    handle: string;
    /** Product-level fields: { 'Title': '...', 'Tags': '...', 'Vendor': '...' } */
    productFields: Record<string, string>;
    /** All variants as array of field maps: [{ 'Option1 Value': 'P', 'Variant Price': '29.90' }, ...] */
    variants: Record<string, string>[];
}

export interface BulkUpdateResult {
    success: boolean;
    summary?: {
        totalHandles: number;
        productsCreated: number;
        productsUpdated: number;
        variantsUpdated: number;
        successCount: number;
        errorCount: number;
        errors: string[];
    };
    error?: string;
}

/**
 * Push Handle-based bulk changes to Shopify via the Edge Function.
 * Products that exist will be updated; products that don't exist will be created.
 */
export async function pushBulkChanges(
    changes: HandleChange[],
    clientId?: string
): Promise<BulkUpdateResult> {
    const { data, error } = await supabase.functions.invoke('shopify-bulk-update', {
        body: { changes, clientId },
    });

    if (error) {
        return { success: false, error: error.message };
    }

    return data as BulkUpdateResult;
}

export interface FetchProductsResult {
    success: boolean;
    productCount?: number;
    rows?: Record<string, string>[];
    error?: string;
}

/**
 * Fetch all products from the connected Shopify store.
 * Returns rows in the same format as a Shopify CSV export.
 */
export async function fetchShopifyProducts(clientId?: string): Promise<FetchProductsResult> {
    const { data, error } = await supabase.functions.invoke('shopify-fetch-products', {
        body: { clientId },
    });

    if (error) {
        return { success: false, error: error.message };
    }

    return data as FetchProductsResult;
}
