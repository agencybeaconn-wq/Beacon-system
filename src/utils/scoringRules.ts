import { MousePointer, ShoppingCart, CreditCard, DollarSign } from 'lucide-react';

export interface ScoreRule {
    range: string;
    points: number;
    min?: number;
    max?: number;
    operator?: '>=' | '<=' | '>' | '<' | 'between';
}

export interface MetricConfig {
    id: string;
    name: string;
    maxScore: number;
    rules: ScoreRule[];
    formatValue?: (val: number) => string;
}

export interface PillarConfig {
    id: 'trafego' | 'conversao' | 'aprovacao' | 'lucratividade';
    name: string;
    weight: number;
    icon: any; // Lucide icon
    color: string;
    bgColor: string;
    borderColor: string;
    metrics: MetricConfig[];
}

// Calibrado para nicho camisa de futebol (benchmark real Lever, mai/2026).
// Top 4 reais: Mantos PH, Diario, Brasileiríssimo, Colecionador.
export const DEFAULT_SCORING_RULES: PillarConfig[] = [
    {
        id: 'trafego',
        name: 'Tráfego',
        weight: 20,
        icon: MousePointer,
        color: 'text-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
        metrics: [
            {
                id: 'cpc',
                name: 'CPC (Custo por Clique)',
                maxScore: 10,
                rules: [
                    { range: '≤ R$ 0.40', points: 10, max: 0.40, operator: '<=' },
                    { range: 'R$ 0.41 - R$ 0.60', points: 7, min: 0.41, max: 0.60, operator: 'between' },
                    { range: 'R$ 0.61 - R$ 0.90', points: 4, min: 0.61, max: 0.90, operator: 'between' },
                    { range: '> R$ 0.90', points: 0, min: 0.91, operator: '>' },
                ]
            },
            {
                id: 'ctr',
                name: 'CTR (Taxa de Clique)',
                maxScore: 10,
                rules: [
                    { range: '≥ 4.5%', points: 10, min: 4.5, operator: '>=' },
                    { range: '3.5% - 4.49%', points: 7, min: 3.5, max: 4.49, operator: 'between' },
                    { range: '2.5% - 3.49%', points: 5, min: 2.5, max: 3.49, operator: 'between' },
                    { range: '1.5% - 2.49%', points: 2, min: 1.5, max: 2.49, operator: 'between' },
                    { range: '< 1.5%', points: 0, max: 1.49, operator: '<' },
                ]
            }
        ]
    },
    {
        id: 'conversao',
        name: 'Conversão',
        weight: 30,
        icon: ShoppingCart,
        color: 'text-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        borderColor: 'border-purple-200 dark:border-purple-800',
        metrics: [
            {
                id: 'taxaConversaoSite',
                name: 'Taxa de Conversão do Site',
                maxScore: 15,
                rules: [
                    { range: '≥ 1.5%', points: 15, min: 1.5, operator: '>=' },
                    { range: '1.0% - 1.49%', points: 11, min: 1.0, max: 1.49, operator: 'between' },
                    { range: '0.7% - 0.99%', points: 7, min: 0.7, max: 0.99, operator: 'between' },
                    { range: '0.4% - 0.69%', points: 3, min: 0.4, max: 0.69, operator: 'between' },
                    { range: '< 0.4%', points: 0, max: 0.39, operator: '<' },
                ]
            },
            {
                id: 'taxaCheckout',
                name: 'Taxa de Checkout (IC/ATC)',
                maxScore: 8,
                rules: [
                    { range: '≥ 30%', points: 8, min: 30, operator: '>=' },
                    { range: '25% - 29%', points: 6, min: 25, max: 29, operator: 'between' },
                    { range: '20% - 24%', points: 3, min: 20, max: 24, operator: 'between' },
                    { range: '15% - 19%', points: 1, min: 15, max: 19, operator: 'between' },
                    { range: '< 15%', points: 0, max: 14.99, operator: '<' },
                ]
            },
            {
                id: 'abandonoCarrinho',
                name: 'Abandono de Carrinho',
                maxScore: 7,
                rules: [
                    { range: '≤ 70%', points: 7, max: 70, operator: '<=' },
                    { range: '71% - 80%', points: 5, min: 71, max: 80, operator: 'between' },
                    { range: '81% - 85%', points: 3, min: 81, max: 85, operator: 'between' },
                    { range: '86% - 90%', points: 1, min: 86, max: 90, operator: 'between' },
                    { range: '> 90%', points: 0, min: 91, operator: '>' },
                ]
            }
        ]
    },
    {
        id: 'aprovacao',
        name: 'Aprovação',
        weight: 20,
        icon: CreditCard,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        metrics: [
            {
                id: 'taxaAprovacao',
                name: 'Taxa de Aprovação Geral',
                maxScore: 16,
                rules: [
                    { range: '≥ 85%', points: 16, min: 85, operator: '>=' },
                    { range: '80% - 84%', points: 13, min: 80, max: 84, operator: 'between' },
                    { range: '75% - 79%', points: 10, min: 75, max: 79, operator: 'between' },
                    { range: '70% - 74%', points: 6, min: 70, max: 74, operator: 'between' },
                    { range: '60% - 69%', points: 3, min: 60, max: 69, operator: 'between' },
                    { range: '< 60%', points: 0, max: 59.99, operator: '<' },
                ]
            },
            {
                id: 'chargebackRate',
                name: 'Taxa de Chargeback',
                maxScore: 4,
                rules: [
                    { range: '≤ 0.5%', points: 4, max: 0.5, operator: '<=' },
                    { range: '0.6% - 1.0%', points: 3, min: 0.6, max: 1.0, operator: 'between' },
                    { range: '1.1% - 2.0%', points: 1, min: 1.1, max: 2.0, operator: 'between' },
                    { range: '> 2.0%', points: 0, min: 2.1, operator: '>' },
                ]
            }
        ]
    },
    {
        id: 'lucratividade',
        name: 'Lucratividade',
        weight: 30,
        icon: DollarSign,
        color: 'text-amber-500',
        bgColor: 'bg-amber-50 dark:bg-amber-900/20',
        borderColor: 'border-amber-200 dark:border-amber-800',
        metrics: [
            {
                id: 'roas',
                name: 'ROAS (Retorno Sobre Pub.)',
                maxScore: 18,
                rules: [
                    { range: '≥ 6.50', points: 18, min: 6.50, operator: '>=' },
                    { range: '5.00 - 6.49', points: 14, min: 5.00, max: 6.49, operator: 'between' },
                    { range: '4.00 - 4.99', points: 10, min: 4.00, max: 4.99, operator: 'between' },
                    { range: '3.00 - 3.99', points: 6, min: 3.00, max: 3.99, operator: 'between' },
                    { range: '2.00 - 2.99', points: 2, min: 2.00, max: 2.99, operator: 'between' },
                    { range: '< 2.00', points: 0, max: 1.99, operator: '<' },
                ]
            },
            {
                id: 'margemContribuicao',
                name: 'Margem de Contribuição',
                maxScore: 12,
                rules: [
                    { range: '≥ 25%', points: 12, min: 25, operator: '>=' },
                    { range: '20% - 24%', points: 9, min: 20, max: 24, operator: 'between' },
                    { range: '15% - 19%', points: 6, min: 15, max: 19, operator: 'between' },
                    { range: '10% - 14%', points: 3, min: 10, max: 14, operator: 'between' },
                    { range: '5% - 9%', points: 1, min: 5, max: 9, operator: 'between' },
                    { range: '< 5%', points: 0, max: 4.99, operator: '<' },
                ]
            }
        ]
    }
];

// Backwards compat: export as SCORING_RULES
// This will be the active rules (default or customised)
// v2 — calibração nicho camisa (mai/2026). Invalida overrides antigos da régua legada.
const STORAGE_KEY = 'lever_scoring_custom_v2';

export function getCustomRules(): PillarConfig[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return DEFAULT_SCORING_RULES;

        const custom = JSON.parse(stored);
        // Merge custom overrides onto defaults (preserve icons which can't be serialised)
        return DEFAULT_SCORING_RULES.map((defPillar, pi) => {
            const cp = custom[pi];
            if (!cp) return defPillar;
            return {
                ...defPillar,
                weight: cp.weight ?? defPillar.weight,
                metrics: defPillar.metrics.map((defMetric, mi) => {
                    const cm = cp.metrics?.[mi];
                    if (!cm) return defMetric;
                    return {
                        ...defMetric,
                        maxScore: cm.maxScore ?? defMetric.maxScore,
                        rules: defMetric.rules.map((defRule, ri) => {
                            const cr = cm.rules?.[ri];
                            if (!cr) return defRule;
                            return {
                                ...defRule,
                                points: cr.points ?? defRule.points,
                            };
                        })
                    };
                })
            };
        });
    } catch (e) {
        console.error('[scoringRules] Erro ao carregar regras customizadas do localStorage, revertendo para defaults:', e);
        return DEFAULT_SCORING_RULES;
    }
}

export function saveCustomRules(pillars: PillarConfig[]) {
    // Save only the numeric overrides (no icons/functions)
    const slim = pillars.map(p => ({
        weight: p.weight,
        metrics: p.metrics.map(m => ({
            maxScore: m.maxScore,
            rules: m.rules.map(r => ({ points: r.points }))
        }))
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
}

export function resetCustomRules() {
    localStorage.removeItem(STORAGE_KEY);
}

// Active rules — used by calculateHealthScore and UI
export const SCORING_RULES = DEFAULT_SCORING_RULES;
