import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { useToast } from '@/hooks/use-toast';

export interface ProductFeature {
    id: string;
    product_id: string;
    name: string;
    description?: string;
    sort_order: number;
    category?: string;
    is_checked?: boolean;
    subtasks?: { id: string; title: string; completed: boolean }[];
    assigned_member_id?: string;
    created_at: string;
}

export interface AgencyProduct {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    category: 'flagship' | 'fixed' | 'avulso';
    pricing_type: 'fixed' | 'percentage' | 'unique';
    price?: string;
    price_note?: string;
    icon_name: string;
    color: string;
    detailed_description?: string;
    is_flagship: boolean;
    created_at: string;
    updated_at: string;
    features?: ProductFeature[];
    groups?: { id: string; label: string; icon?: string; color?: string }[];
}

export interface CreateProductInput {
    name: string;
    description?: string;
    category: 'flagship' | 'fixed' | 'avulso';
    pricing_type: 'fixed' | 'percentage' | 'unique';
    price?: string;
    icon_name?: string;
    color?: string;
    is_flagship?: boolean;
    features?: string[];
    groups?: { id: string; label: string; icon?: string; color?: string }[];
}

export function useAgencyProducts() {
    const { user } = useAuth();
    const { workspaceId } = useDashboard();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch all products with their features
    const productsQuery = useQuery({
        queryKey: ['agency_products', workspaceId],
        queryFn: async () => {
            let query = (supabase as any)
                .from('agency_products')
                .select('*');

            // Filter by workspace if available
            if (workspaceId) {
                query = query.eq('workspace_id', workspaceId);
            }

            const { data: products, error } = await query
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Fetch features for each product
            const productIds = products?.map((p: AgencyProduct) => p.id) || [];
            if (productIds.length === 0) return [];

            const { data: features, error: featuresError } = await (supabase as any)
                .from('agency_product_features')
                .select('*')
                .in('product_id', productIds)
                .order('sort_order', { ascending: true });

            if (featuresError) throw featuresError;

            // Merge features into products
            return products.map((product: AgencyProduct) => ({
                ...product,
                features: features?.filter((f: ProductFeature) => f.product_id === product.id) || []
            }));
        },
        enabled: !!user && !!workspaceId
    });

    // Create product
    const createProduct = useMutation({
        mutationFn: async (input: CreateProductInput) => {
            if (!user) throw new Error('User not authenticated');

            const { data: product, error } = await (supabase as any)
                .from('agency_products')
                .insert({
                    user_id: user.id,
                    workspace_id: workspaceId,
                    name: input.name,
                    description: input.description,
                    category: input.category,
                    pricing_type: input.pricing_type,
                    price: input.price,
                    icon_name: input.icon_name || 'Package',
                    color: input.color || '#7C3AED',
                    is_flagship: input.is_flagship || false,
                    groups: input.groups || undefined
                })
                .select()
                .single();

            if (error) throw error;

            // Create features if provided
            if (input.features && input.features.length > 0) {
                const featureInserts = input.features.map((name, idx) => ({
                    product_id: product.id,
                    name,
                    sort_order: idx
                }));

                const { error: featuresError } = await (supabase as any)
                    .from('agency_product_features')
                    .insert(featureInserts);

                if (featuresError) throw featuresError;
            }

            return product;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agency_products'] });
            toast({ title: 'Produto criado', description: 'O produto foi adicionado com sucesso.' });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'Erro', description: error.message });
        }
    });

    // Update product name/details
    const updateProduct = useMutation({
        mutationFn: async ({ id, ...updates }: Partial<AgencyProduct> & { id: string }) => {
            const { error } = await (supabase as any)
                .from('agency_products')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agency_products'] });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'Erro ao atualizar', description: error.message });
        }
    });

    // Delete product
    const deleteProduct = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase as any)
                .from('agency_products')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agency_products'] });
            toast({ title: 'Produto excluído' });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'Erro', description: error.message });
        }
    });

    // Add feature to product
    const addFeature = useMutation({
        mutationFn: async ({ productId, name, category, is_checked }: { productId: string; name: string, category?: string, is_checked?: boolean }) => {
            const { data: existing } = await (supabase as any)
                .from('agency_product_features')
                .select('sort_order')
                .eq('product_id', productId)
                .order('sort_order', { ascending: false })
                .limit(1);

            const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

            const { error } = await (supabase as any)
                .from('agency_product_features')
                .insert({
                    product_id: productId,
                    name,
                    category: category || 'Geral',
                    is_checked: is_checked || false,
                    sort_order: nextOrder
                });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agency_products'] });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'Erro', description: error.message });
        }
    });

    // Update feature
    const updateFeature = useMutation({
        mutationFn: async ({ id, ...updates }: {
            id: string;
            name?: string;
            description?: string;
            category?: string;
            is_checked?: boolean;
            sort_order?: number;
            subtasks?: { id: string; title: string; completed: boolean }[];
            assigned_member_id?: string | null;
        }) => {
            const { error } = await (supabase as any)
                .from('agency_product_features')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agency_products'] });
        }
    });

    // Update multiple features in batch
    const updateFeaturesBatch = useMutation({
        mutationFn: async (updates: {
            id: string;
            name?: string;
            category?: string;
            is_checked?: boolean;
            sort_order?: number;
            subtasks?: any;
            assigned_member_id?: string;
        }[]) => {
            const { error } = await (supabase as any)
                .from('agency_product_features')
                .upsert(updates, { onConflict: 'id' });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agency_products'] });
            toast({ title: 'Ordem salva', description: 'A nova organização foi salva com sucesso.' });
        },
        onError: (error: any) => {
            console.error('[updateFeaturesBatch] Error:', error);
            toast({ variant: 'destructive', title: 'Erro ao salvar ordem', description: error.message });
        }
    });

    // Delete feature
    const deleteFeature = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase as any)
                .from('agency_product_features')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agency_products'] });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'Erro', description: error.message });
        }
    });

    return {
        products: productsQuery.data as AgencyProduct[] || [],
        isLoading: productsQuery.isLoading,
        error: productsQuery.error,
        refetch: productsQuery.refetch,
        createProduct,
        updateProduct,
        deleteProduct,
        addFeature,
        updateFeature,
        updateFeaturesBatch,
        deleteFeature
    };
}

// Helper functions
export const getCategoryLabel = (category: AgencyProduct['category']) => {
    switch (category) {
        case 'flagship': return 'Solução Completa';
        case 'fixed': return 'Mensal Fixo';
        case 'avulso': return 'Avulso';
    }
};

export const getPricingLabel = (type: AgencyProduct['pricing_type']) => {
    switch (type) {
        case 'fixed': return 'Mensal Fixo';
        case 'percentage': return '% + Fixo';
        case 'unique': return 'Pagamento Único';
    }
};

export const getPricingColor = (type: AgencyProduct['pricing_type']) => {
    switch (type) {
        case 'fixed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
        case 'percentage': return 'bg-violet-500/10 text-violet-600 border-violet-500/20';
        case 'unique': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    }
};

export const ICON_OPTIONS = [
    'Star', 'Package', 'ShoppingBag', 'Code', 'Palette', 'Zap',
    'Globe', 'ImageIcon', 'Workflow', 'Calendar', 'TrendingUp'
];

export const COLOR_OPTIONS = [
    '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6',
    '#EC4899', '#8B5CF6', '#06B6D4', '#9333EA', '#84CC16'
];
