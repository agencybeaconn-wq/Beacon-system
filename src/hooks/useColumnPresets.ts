import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Definição de todas as colunas disponíveis
export const ALL_AVAILABLE_COLUMNS = [
    // Básicas (sempre disponíveis)
    { id: 'status', label: 'Status', category: 'basic' },
    { id: 'objective', label: 'Objetivo', category: 'basic' },
    { id: 'budget', label: 'Orçamento', category: 'basic' },
    { id: 'spend', label: 'Valor Gasto', category: 'basic' },

    // Performance
    { id: 'results', label: 'Resultados', category: 'performance' },
    { id: 'cpr', label: 'Custo por Resultado', category: 'performance' },
    { id: 'cpm', label: 'CPM', category: 'performance' },
    { id: 'ctr', label: 'CTR', category: 'performance' },
    { id: 'clicks', label: 'Cliques', category: 'performance' },
    { id: 'cpc', label: 'CPC', category: 'performance' },
    { id: 'reach', label: 'Alcance', category: 'performance' },
    { id: 'impressions', label: 'Impressões', category: 'performance' },
    { id: 'frequency', label: 'Frequência', category: 'performance' },

    // Vendas (Ecommerce)
    { id: 'purchases', label: 'Compras', category: 'sales' },
    { id: 'purchase_value', label: 'Valor de Compra', category: 'sales' },
    { id: 'roas', label: 'ROAS', category: 'sales' },
    { id: 'add_to_cart', label: 'Carrinho', category: 'sales' },
    { id: 'initiate_checkout', label: 'Checkout', category: 'sales' },

    // Leads & Mensagens
    { id: 'leads', label: 'Leads', category: 'leads' },
    { id: 'cpl', label: 'Custo por Lead', category: 'leads' },
    { id: 'whatsapp', label: 'WhatsApp', category: 'leads' },
    { id: 'cpm_msg', label: 'Custo por Msg', category: 'leads' },
    { id: 'conv_rate', label: 'Taxa de Conversão', category: 'leads' },

    // Vídeo
    { id: 'video_3s', label: 'Vídeo 3s', category: 'video' },
    { id: 'video_50', label: 'Vídeo 50%', category: 'video' },
    { id: 'video_100', label: 'Vídeo 100%', category: 'video' },
    { id: 'avg_retention', label: 'Retenção Média', category: 'video' },

    // Entrega & Administração
    { id: 'bid_strategy', label: 'Estratégia de Lance', category: 'delivery' },
    { id: 'created_at', label: 'Data de Criação', category: 'delivery' },
    { id: 'updated_at', label: 'Última Alteração', category: 'delivery' },
] as const;

export type ColumnId = typeof ALL_AVAILABLE_COLUMNS[number]['id'];

export interface ColumnPreset {
    id: string;
    name: string;
    columns: string[];
    isSystem: boolean;
    isDefault: boolean;
    createdAt?: string;
}

// Presets do sistema (não podem ser editados ou excluídos)
export const SYSTEM_PRESETS: ColumnPreset[] = [
    {
        id: 'system-sales',
        name: 'campaigns.presets.sales',
        columns: ['status', 'budget', 'spend', 'purchases', 'purchase_value', 'roas', 'add_to_cart', 'initiate_checkout', 'cpr', 'impressions', 'cpm', 'reach', 'frequency', 'ctr', 'cpc'],
        isSystem: true,
        isDefault: true,
    },
    {
        id: 'system-performance',
        name: 'campaigns.presets.performance',
        columns: ['status', 'budget', 'spend', 'results', 'cpr', 'reach', 'impressions'],
        isSystem: true,
        isDefault: false,
    },
    {
        id: 'system-video',
        name: 'campaigns.presets.video',
        columns: ['status', 'cpm', 'ctr', 'clicks', 'video_3s', 'video_50', 'video_100', 'avg_retention'],
        isSystem: true,
        isDefault: false,
    },
    {
        id: 'system-leads',
        name: 'campaigns.presets.leads',
        columns: ['status', 'spend', 'leads', 'cpl', 'whatsapp', 'cpm_msg', 'conv_rate'],
        isSystem: true,
        isDefault: false,
    },
    {
        id: 'system-delivery',
        name: 'campaigns.presets.delivery',
        columns: ['status', 'objective', 'bid_strategy', 'frequency', 'reach', 'impressions', 'created_at', 'updated_at'],
        isSystem: true,
        isDefault: false,
    },
];

export function useColumnPresets() {
    const { toast } = useToast();
    const [customPresets, setCustomPresets] = useState<ColumnPreset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activePresetId, setActivePresetId] = useState<string>('system-sales');

    // Carregar presets do usuário do Supabase
    const loadPresets = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setIsLoading(false);
                return;
            }

            // Tentar carregar presets salvos do localStorage primeiro (cache)
            const cachedPresets = localStorage.getItem(`column_presets_${user.id}`);
            if (cachedPresets) {
                try {
                    const parsed = JSON.parse(cachedPresets);
                    setCustomPresets(parsed);
                } catch (e) {
                    console.warn('⚠️ [PRESETS] Erro ao parsear cache:', e);
                }
            }

            // Buscar do Supabase (fonte de verdade)
            const { data, error } = await (supabase as any)
                .from('user_column_presets')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: true });

            if (error) {
                // Tabela pode não existir ainda - não é erro crítico
                if (!error.message.includes('does not exist')) {
                    console.error('❌ [PRESETS] Erro ao carregar:', error);
                }
            } else if (data && data.length > 0) {
                const mapped: ColumnPreset[] = data.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    columns: p.columns,
                    isSystem: false,
                    isDefault: p.is_default,
                    createdAt: p.created_at,
                }));
                setCustomPresets(mapped);
                // Atualizar cache
                localStorage.setItem(`column_presets_${user.id}`, JSON.stringify(mapped));
            }

            // Carregar preset ativo do localStorage
            const savedActivePreset = localStorage.getItem(`active_preset_${user.id}`);
            if (savedActivePreset) {
                setActivePresetId(savedActivePreset);
            }
        } catch (e) {
            console.error('❌ [PRESETS] Erro ao carregar presets:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Carregar presets na inicialização
    useEffect(() => {
        loadPresets();
    }, [loadPresets]);

    // Salvar preset ativo no localStorage quando mudar
    useEffect(() => {
        const saveActivePreset = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                localStorage.setItem(`active_preset_${user.id}`, activePresetId);
            }
        };
        saveActivePreset();
    }, [activePresetId]);

    // Obter todos os presets (sistema + custom)
    const allPresets = [...SYSTEM_PRESETS, ...customPresets];

    // Obter preset ativo
    const activePreset = allPresets.find(p => p.id === activePresetId) || SYSTEM_PRESETS[0];

    // Criar novo preset
    const createPreset = useCallback(async (name: string, columns: string[]): Promise<boolean> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast({ title: 'Erro', description: 'Usuário não autenticado', variant: 'destructive' });
                return false;
            }

            const { data, error } = await (supabase as any)
                .from('user_column_presets')
                .insert({
                    user_id: user.id,
                    name,
                    columns,
                    is_default: false,
                })
                .select()
                .single();

            if (error) {
                console.error('❌ [PRESETS] Erro ao criar:', error);
                toast({ title: 'Erro', description: 'Não foi possível salvar o preset', variant: 'destructive' });
                return false;
            }

            const newPreset: ColumnPreset = {
                id: data.id,
                name: data.name,
                columns: data.columns,
                isSystem: false,
                isDefault: false,
                createdAt: data.created_at,
            };

            setCustomPresets(prev => [...prev, newPreset]);
            setActivePresetId(data.id);

            // Atualizar cache
            const updatedPresets = [...customPresets, newPreset];
            localStorage.setItem(`column_presets_${user.id}`, JSON.stringify(updatedPresets));

            toast({ title: 'Sucesso', description: `Preset "${name}" criado com sucesso!` });
            return true;
        } catch (e) {
            console.error('❌ [PRESETS] Erro ao criar preset:', e);
            toast({ title: 'Erro', description: 'Falha ao criar preset', variant: 'destructive' });
            return false;
        }
    }, [customPresets, toast]);

    // Atualizar preset existente
    const updatePreset = useCallback(async (id: string, name: string, columns: string[]): Promise<boolean> => {
        try {
            const preset = customPresets.find(p => p.id === id);
            if (!preset || preset.isSystem) {
                toast({ title: 'Erro', description: 'Não é possível editar presets do sistema', variant: 'destructive' });
                return false;
            }

            const { error } = await (supabase as any)
                .from('user_column_presets')
                .update({ name, columns, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) {
                console.error('❌ [PRESETS] Erro ao atualizar:', error);
                toast({ title: 'Erro', description: 'Não foi possível atualizar o preset', variant: 'destructive' });
                return false;
            }

            setCustomPresets(prev => prev.map(p =>
                p.id === id ? { ...p, name, columns } : p
            ));

            toast({ title: 'Sucesso', description: `Preset "${name}" atualizado!` });
            return true;
        } catch (e) {
            console.error('❌ [PRESETS] Erro ao atualizar preset:', e);
            return false;
        }
    }, [customPresets, toast]);

    // Excluir preset
    const deletePreset = useCallback(async (id: string): Promise<boolean> => {
        try {
            const preset = customPresets.find(p => p.id === id);
            if (!preset) {
                toast({ title: 'Erro', description: 'Preset não encontrado', variant: 'destructive' });
                return false;
            }

            if (preset.isSystem) {
                toast({ title: 'Erro', description: 'Não é possível excluir presets do sistema', variant: 'destructive' });
                return false;
            }

            const { error } = await (supabase as any)
                .from('user_column_presets')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('❌ [PRESETS] Erro ao excluir:', error);
                toast({ title: 'Erro', description: 'Não foi possível excluir o preset', variant: 'destructive' });
                return false;
            }

            setCustomPresets(prev => prev.filter(p => p.id !== id));

            // Se o preset excluído era o ativo, voltar para o primeiro do sistema
            if (activePresetId === id) {
                setActivePresetId('system-performance');
            }

            toast({ title: 'Sucesso', description: 'Preset excluído!' });
            return true;
        } catch (e) {
            console.error('❌ [PRESETS] Erro ao excluir preset:', e);
            return false;
        }
    }, [customPresets, activePresetId, toast]);

    // Helper para verificar se uma coluna está visível no preset ativo
    const isColumnVisible = useCallback((columnId: string): boolean => {
        return activePreset.columns.includes(columnId);
    }, [activePreset]);

    // Reordenar colunas no preset ativo
    const reorderColumns = useCallback(async (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;

        // Obter ordem atual (pode já estar customizada no localStorage)
        let currentColumns: string[];
        if (activePreset.isSystem) {
            const customOrderKey = `column_order_${activePreset.id}`;
            const savedOrder = localStorage.getItem(customOrderKey);
            currentColumns = savedOrder ? JSON.parse(savedOrder) : [...activePreset.columns];
        } else {
            currentColumns = [...activePreset.columns];
        }

        const [movedColumn] = currentColumns.splice(fromIndex, 1);
        currentColumns.splice(toIndex, 0, movedColumn);

        console.log('🔄 [PRESETS] Reordering columns:', { fromIndex, toIndex, newOrder: currentColumns });

        // Se for preset do sistema, salvar a ordem customizada no localStorage
        if (activePreset.isSystem) {
            const customOrderKey = `column_order_${activePreset.id}`;
            localStorage.setItem(customOrderKey, JSON.stringify(currentColumns));
            console.log('💾 [PRESETS] Saved custom order to localStorage:', customOrderKey);

            // Force re-render by triggering a state update
            setCustomPresets(prev => [...prev]);
        } else {
            // Para presets customizados, atualizar no banco
            await updatePreset(activePreset.id, activePreset.name, currentColumns);
        }
    }, [activePreset, updatePreset]);

    // Carregar ordem customizada para presets do sistema
    const getOrderedColumns = useCallback((): string[] => {
        if (activePreset.isSystem) {
            const customOrderKey = `column_order_${activePreset.id}`;
            const savedOrder = localStorage.getItem(customOrderKey);
            if (savedOrder) {
                try {
                    const parsed = JSON.parse(savedOrder) as string[];
                    console.log('📦 [PRESETS] Loaded custom order from localStorage:', parsed);
                    return parsed;
                } catch (e) {
                    console.warn('⚠️ [PRESETS] Erro ao carregar ordem customizada:', e);
                }
            }
        }
        return activePreset.columns;
    }, [activePreset, customPresets]); // Added customPresets as dependency to trigger re-read after reorder

    return {
        allPresets,
        customPresets,
        activePreset,
        activePresetId,
        setActivePresetId,
        isLoading,
        createPreset,
        updatePreset,
        deletePreset,
        isColumnVisible,
        reorderColumns,
        getOrderedColumns,
        availableColumns: ALL_AVAILABLE_COLUMNS,
        reload: loadPresets,
    };
}
