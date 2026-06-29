import { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DataConfig {
    category: string;
    main_metrics: {
        label: string;
        field: string;
        action: 'sum' | 'avg' | 'count';
    }[];
    layout_priority: string[];
    data_types: Record<string, 'date' | 'currency' | 'text' | 'number' | 'select'>;
    charts: {
        type: 'bar' | 'line' | 'pie';
        xField: string;
        yField: string;
        title: string;
    }[];
}

export interface SheetData {
    data: any[];
    config: DataConfig | null;
    headers: string[];
}

export const METRIC_WEIGHTS: Record<string, number> = {
    'Faturamento Pago': 5,
    'Valor Convertido no Tráfego': 5,
    'ROAS': 3,
    '% Recuperação nas Automações': 3,
    '% de Pedidos Pagos': 3,
    'Conversão por Sessão': 3,
};

export const DEFAULT_SCORE_LEAD_CONFIG: DataConfig = {
    category: "Dashboard Score Lead",
    main_metrics: [],
    layout_priority: ["cliente", "score", "faturamento"],
    data_types: { "score": "number", "faturamento": "currency" },
    charts: []
};

export const parseBrazilianNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val !== 'string') return 0;

    // Remove R$, espaços, e inverte pontos/vírgulas se for formato BR (1.234,56)
    let cleaned = val.replace(/[R$\s]/g, '');
    if (cleaned.includes(',') && cleaned.includes('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
        cleaned = cleaned.replace(',', '.');
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
};

export const calculateExecutiveScore = (data: any[], config: DataConfig) => {
    if (!data || data.length === 0 || !config?.main_metrics) return 0;

    let totalScore = 0;
    let totalWeight = 0;

    config.main_metrics.forEach(metric => {
        const weight = METRIC_WEIGHTS[metric.label] || 1;
        const values = data.map(d => parseBrazilianNumber(d[metric.field])).filter(v => !isNaN(v));
        if (values.length === 0) return;

        const avgValue = values.reduce((a, b) => a + b, 0) / values.length;

        // Scaled scoring logic (Base 10)
        let metricScore = 0;
        if (metric.label.includes('%') || metric.label.includes('Taxa')) {
            metricScore = Math.min((avgValue / 100) * 10, 10);
        } else if (metric.label === 'ROAS') {
            metricScore = Math.min((avgValue / 4) * 10, 10); // Target 4.0
        } else if (metric.label.includes('Conversão')) {
            metricScore = Math.min((avgValue / 2) * 10, 10); // Target 2%
        } else {
            metricScore = avgValue > 0 ? 8 : 2;
        }

        totalScore += metricScore * weight;
        totalWeight += weight;
    });

    return totalWeight > 0 ? totalScore / totalWeight : 0;
};

export function useSmartData(clientId?: string, workspaceId?: string) {
    const [sheets, setSheets] = useState<Record<string, SheetData>>({});
    const [activeSheet, setActiveSheet] = useState<string>("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isMasterView, setIsMasterView] = useState(false);

    // Load data from Supabase on mount
    useEffect(() => {
        if (!workspaceId) {
            console.log('[useSmartData] ⏳ Aguardando workspaceId...');
            return;
        }

        const loadPersistedData = async () => {
            setIsProcessing(true);
            try {
                const isMasterViewRequest = !clientId;
                console.log(`[useSmartData] 🔍 Carregando dados (${isMasterViewRequest ? "MASTER" : "CLIENT"}: ${clientId || "Nenhum"}, Workspace: ${workspaceId})`);

                let query = (supabase as any)
                    .from('client_smart_data')
                    .select('sheets, active_sheet, client_id')
                    .eq('workspace_id', workspaceId);

                if (isMasterViewRequest) {
                    query = query.is('client_id', null);
                } else {
                    query = query.eq('client_id', clientId);
                }

                const { data: res, error } = await query.maybeSingle();

                if (res && !error && Object.keys(res.sheets || {}).length > 0) {
                    console.log(`[useSmartData] ✅ Dados ${isMasterViewRequest ? "Master" : "Cliente"} carregados.`);
                    setSheets(res.sheets);
                    setActiveSheet(res.active_sheet || Object.keys(res.sheets)[0]);
                    setIsMasterView(isMasterViewRequest);
                } else {
                    console.log('[useSmartData] ℹ️ Nenhum dado encontrado. Inicializando Dashboard Padrão...');
                    const defaultName = "Dashboard Score Lead";
                    const initialSheets = {
                        [defaultName]: {
                            data: [],
                            headers: ["cliente", "plano", "score", "faturamento", "anterior"],
                            config: DEFAULT_SCORE_LEAD_CONFIG
                        }
                    };
                    setSheets(initialSheets);
                    setActiveSheet(defaultName);
                    setIsMasterView(isMasterViewRequest);
                }

                if (error) console.error('[useSmartData] Erro ao buscar dados:', error);
            } catch (err) {
                console.error('[useSmartData] ❌ Erro Crítico no load:', err);
            } finally {
                setIsProcessing(false);
            }
        };

        loadPersistedData();
    }, [clientId, workspaceId]);

    // Save data to Supabase
    const persistData = useCallback(async (newSheets: Record<string, SheetData>, active: string, isMasterAction: boolean = false) => {
        if (!workspaceId || Object.keys(newSheets).length === 0) return;

        setIsSaving(true);
        try {
            console.log(`[useSmartData] 💾 Iniciando persistência via Lógica Explícita (${isMasterAction ? 'MASTER' : 'CLIENT'})...`);

            const payload: any = {
                workspace_id: workspaceId,
                sheets: newSheets,
                active_sheet: active,
                updated_at: new Date().toISOString()
            };

            // Definir critério de busca
            let checkQuery = (supabase as any).from('client_smart_data').select('id');

            if (isMasterAction) {
                payload.client_id = null;
                checkQuery = checkQuery.eq('workspace_id', workspaceId).is('client_id', null);
            } else if (clientId) {
                payload.client_id = clientId;
                checkQuery = checkQuery.eq('client_id', clientId);
            } else {
                console.warn('[useSmartData] ⚠️ Impossível salvar: sem ClientID e não é Master.');
                return;
            }

            // 1. Verificar se já existe
            const { data: existing, error: findError } = await checkQuery.maybeSingle();

            if (findError) {
                console.error('[useSmartData] ❌ Erro ao verificar existência no banco:', findError);
                throw findError;
            }

            let result;
            if (existing?.id) {
                // 2a. UPDATE
                console.log(`[useSmartData] 🔄 Registro encontrado (ID: ${existing.id}). Atualizando...`);
                const { data, error } = await (supabase as any)
                    .from('client_smart_data')
                    .update(payload)
                    .eq('id', existing.id)
                    .select();
                result = { data, error };
            } else {
                // 2b. INSERT
                console.log(`[useSmartData] ➕ Nenhum registro encontrado. Criando novo...`);
                const { data, error } = await (supabase as any)
                    .from('client_smart_data')
                    .insert(payload)
                    .select();
                result = { data, error };
            }

            if (result.error) {
                console.error('[useSmartData] ❌ Erro na operação de escrita:', result.error);
                throw result.error;
            }

            console.log('[useSmartData] ✅ Sucesso Absoluto:', result.data);
            toast.success(isMasterAction ? 'Master da Agência atualizado com sucesso!' : 'Dados salvos e seguros!');

        } catch (err: any) {
            console.error('[useSmartData] ❌ Erro Fatal na Persistência:', err);
            toast.error(`Falha no salvamento: ${err?.message || 'Erro desconhecido'}`);
        } finally {
            setIsSaving(false);
        }
    }, [clientId, workspaceId]);

    const inferSchemaWithAI = async (headers: string[], sample: any[]) => {
        try {
            const prompt = `
        Analise o seguinte esquema de planilha e sugira uma visualização inteligente para um Dashboard executivo:
        Colunas: ${headers.join(', ')}
        Amostra (3 linhas): ${JSON.stringify(sample)}
        
        IMPORTANTE: Se as colunas indicarem métricas financeiras (valor, receita, gasto, investimento), use "currency" no data_types.
        
        Retorne APENAS um JSON no formato:
        {
          "category": "Título Curto do Dashboard",
          "main_metrics": [{"label": "Nome da Métrica", "field": "Campo", "action": "sum|avg|count"}],
          "layout_priority": ["Colunas primárias para tabela"],
          "data_types": {"coluna": "date|currency|text|number|select"},
          "charts": [{"type": "bar|line|pie", "xField": "CampoX", "yField": "CampoY", "title": "Título do Gráfico"}]
        }
      `;

            const { data, error } = await supabase.functions.invoke('lads-brain', {
                body: { message: prompt, raw_mode: true }
            });

            if (error || !data?.response) throw new Error('AI Failure');

            const cleanedResponse = (data?.response || "").replace(/```json|```/g, '').trim();
            if (!cleanedResponse) throw new Error('Empty AI response');

            const parsed = JSON.parse(cleanedResponse);

            // Força a tipagem correta das ações para evitar lints
            if (parsed && typeof parsed === 'object') {
                if (parsed.main_metrics) {
                    parsed.main_metrics = (parsed.main_metrics || []).map((m: any) => ({
                        ...m,
                        action: ['sum', 'avg', 'count'].includes(m.action) ? m.action : 'count'
                    }));
                }
                return parsed as DataConfig;
            }
            throw new Error('Invalid JSON format from AI');
        } catch (err) {
            console.error('[useSmartData] AI Inference Error:', err);
            return {
                category: "Resumo de Dados",
                main_metrics: (headers || []).slice(0, 3).map(h => ({
                    label: h,
                    field: h,
                    action: 'count' as const
                })),
                layout_priority: (headers || []).slice(0, 5),
                data_types: {},
                charts: []
            };
        }
    };


    const cleanSheetData = (ws: XLSX.WorkSheet) => {
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        let headerIndex = -1;

        // Procura a primeira linha com conteúdo real
        for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
            const row = rawRows[i];
            if (row && row.filter(cell => cell !== null && cell !== "").length >= 3) {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex === -1) return { data: [], headers: [] };

        const headers = rawRows[headerIndex].map((h, i) => h?.toString() || `Col_${i}`);
        const dataRows = rawRows.slice(headerIndex + 1);

        const cleanedData = dataRows
            .filter(row => row.some(cell => cell !== null && cell !== ""))
            .map(row => {
                const obj: any = {};
                headers.forEach((h, idx) => {
                    obj[h] = row[idx];
                });
                return obj;
            });

        return { data: cleanedData, headers };
    };

    const processFile = useCallback(async (file: File) => {
        setIsProcessing(true);
        const reader = new FileReader();

        if (file.name.endsWith('.csv')) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    try {
                        const data = results.data;
                        const headers = results.meta.fields || [];
                        const aiConfig = await inferSchemaWithAI(headers, data.slice(0, 3));
                        const sheetSet = { "Principal": { data, headers, config: aiConfig } };
                        setSheets(sheetSet);
                        setActiveSheet("Principal");
                        await persistData(sheetSet, "Principal");
                        setIsProcessing(false);
                        toast.success('CSV processado e salvo!');
                    } catch (err) {
                        console.error('CSV Processing Error:', err);
                        setIsProcessing(false);
                        toast.error('Grave: Erro ao processar arquivo CSV');
                    }
                },
                error: (err) => {
                    console.error('Parse Error:', err);
                    setIsProcessing(false);
                    toast.error('Erro ao ler CSV');
                }
            });
        } else {
            reader.onload = async (e) => {
                try {
                    const bstr = e.target?.result;
                    const wb = XLSX.read(bstr, { type: 'binary' });

                    const newSheets: Record<string, SheetData> = {};
                    let firstValidSheet = "";

                    for (const sheetName of wb.SheetNames) {
                        const ws = wb.Sheets[sheetName];
                        const { data, headers } = cleanSheetData(ws);

                        if (data.length > 0) {
                            if (!firstValidSheet) firstValidSheet = sheetName;
                            newSheets[sheetName] = { data, headers, config: null };
                        }
                    }

                    if (!firstValidSheet) throw new Error('Planilha sem dados válidos');

                    // Trigger AI for first sheet to show progress
                    const firstData = newSheets[firstValidSheet];
                    const aiConfig = await inferSchemaWithAI(firstData.headers, firstData.data.slice(0, 3));
                    newSheets[firstValidSheet].config = aiConfig;

                    setSheets(newSheets);
                    setActiveSheet(firstValidSheet);
                    await persistData(newSheets, firstValidSheet);

                    setIsProcessing(false);
                    toast.success('Documento processado e salvo!');
                } catch (err) {
                    console.error(err);
                    setIsProcessing(false);
                    toast.error('Grave: Erro ao processar arquivo');
                }
            };
            reader.readAsBinaryString(file);
        }
    }, [clientId, workspaceId, persistData]);

    const switchSheet = async (name: string) => {
        if (!sheets[name]) return;
        setActiveSheet(name);

        if (!sheets[name].config) {
            const config = await inferSchemaWithAI(sheets[name].headers, sheets[name].data.slice(0, 3));
            setSheets(prev => {
                if (!prev[name]) return prev;
                const updated = { ...prev, [name]: { ...prev[name], config } };
                // Delay persistence to after state update
                setTimeout(() => persistData(updated, name), 100);
                return updated;
            });
        } else {
            persistData(sheets, name);
        }
    };

    return {
        sheets,
        activeSheet,
        isMasterView,
        rawData: sheets[activeSheet]?.data || [],
        config: sheets[activeSheet]?.config ? {
            category: "Análise de Dados",
            main_metrics: [],
            layout_priority: [],
            charts: [],
            data_types: {},
            ...sheets[activeSheet].config
        } : null,
        isProcessing,
        isSaving,
        processFile,
        switchSheet,
        persistData, // CRITICAL: Export this correctly
        parseBrazilianNumber,
        calculateExecutiveScore,
        importSystemClients: async () => {
            if (!activeSheet || !sheets[activeSheet]) return;
            setIsProcessing(true);
            try {
                const { data: clients, error } = await (supabase as any)
                    .from('agency_clients')
                    .select('name')
                    .eq('is_archived', false)
                    .order('name');

                if (error) throw error;

                if (clients?.length) {
                    const existingClients = new Set(sheets[activeSheet].data.map(r => r.cliente || r.Cliente));
                    const newRows = clients
                        .filter((c: any) => !existingClients.has(c.name))
                        .map((c: any) => ({
                            cliente: c.name,
                            plano: 'STD',
                            score: 0,
                            faturamento: 0,
                            anterior: 0
                        }));

                    if (newRows.length > 0) {
                        const newData = [...sheets[activeSheet].data, ...newRows];
                        const updated = {
                            ...sheets,
                            [activeSheet]: { ...sheets[activeSheet], data: newData }
                        };
                        setSheets(updated);
                        await persistData(updated, activeSheet);
                        toast.success(`${newRows.length} clientes importados do sistema!`);
                    } else {
                        toast.info('Todos os clientes do sistema já estão na lista.');
                    }
                }
            } catch (err) {
                console.error('Error importing clients:', err);
                toast.error('Erro ao importar clientes.');
            } finally {
                setIsProcessing(false);
            }
        },
        setRawData: (newData: any[]) => {
            if (!activeSheet || !sheets[activeSheet]) return;
            const updated = {
                ...sheets,
                [activeSheet]: { ...sheets[activeSheet], data: newData }
            };
            setSheets(updated);
            persistData(updated, activeSheet);
        }
    };
}
