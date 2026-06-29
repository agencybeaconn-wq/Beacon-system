export interface ClientMetrics {
    // Traffic
    cpc: number;
    ctr: number;
    cpm: number;
    frequency: number;
    reach: number;
    spend: number;

    // Conversion
    sessions: number;
    orders: number;
    addToCart: number;
    initiateCheckout: number;
    impressions: number;
    clicks: number;

    // Derived Conversion Rates (Pre-calculated or calculated on fly)
    taxaConversaoSite: number; // (orders / sessions) * 100
    taxaAddToCart: number; // (addToCart / clicks) * 100
    taxaCheckout: number; // (initiateCheckout / addToCart) * 100 
    taxaFinalizacao: number; // (purchase / initiateCheckout) * 100
    abandonoCarrinho: number; // 100 - (orders / created_carts) * 100 - using simplified formula for now

    // Approval
    taxaAprovacao: number;
    chargebackRate: number;
    pixApprovalRate: number;

    // Profitability
    roas: number;
    cpa: number;
    margemContribuicao: number;
    lucroPorPedido: number;
    faturamento: number;
    lucro: number;
}

export interface ScoreDetail {
    trafego: number;
    conversao: number;
    aprovacao: number;
    lucratividade: number;
}

export interface HealthScoreResult {
    total: number;
    detalhes: ScoreDetail;
}

export interface ClientClassification {
    status: "ESCALAR" | "OTIMIZADO" | "BOM" | "OTIMIZAR" | "ATENÇÃO" | "CRÍTICO" | "PAUSAR" | "AVALIAR" | "SEM DADOS";
    emoji: string;
    cor: string;
    acao: string;
    urgencia: string;
    descricao: string;
}

export interface Bottleneck {
    area: string;
    problema: string;
    impacto: "CRÍTICO" | "ALTO" | "MÉDIO" | "BAIXO";
    descricao: string;
    acoes: string[];
}

export interface Recommendation {
    decisao: string;
    acao: string;
    confianca: string;
    detalhes: string[];
}

// ==========================================
// 3.1 LÓGICA DE PONTUAÇÃO
// ==========================================
import { SCORING_RULES, ScoreRule, getCustomRules } from './scoringRules';

// ==========================================
// 3.1 LÓGICA DE PONTUAÇÃO
// ==========================================
export function calculateHealthScore(cliente: ClientMetrics): HealthScoreResult {
    let pontos = {
        trafego: 0,
        conversao: 0,
        aprovacao: 0,
        lucratividade: 0
    };

    // Helper function to check if a value matches a rule
    const matchRule = (value: number, rule: ScoreRule): boolean => {
        switch (rule.operator) {
            case '>=': return value >= (rule.min ?? 0);
            case '<=': return value <= (rule.max ?? 0);
            case '>': return value > (rule.min ?? 0);
            case '<': return value < (rule.max ?? 0);
            case 'between':
                return value >= (rule.min ?? 0) && value <= (rule.max ?? 0);
            default: return false;
        }
    };

    // Use custom rules (with user overrides) instead of defaults
    const activeRules = getCustomRules();

    // Iterate over pillars and metrics to calculate score
    activeRules.forEach(pillar => {
        pillar.metrics.forEach(metric => {
            const clientValue = cliente[metric.id as keyof ClientMetrics];

            // Skip if value is undefined/null (or treat as 0/worst case depending on logic, here we skip)
            if (clientValue === undefined || clientValue === null) return;

            // Find the matching rule
            const applicableRule = metric.rules.find(rule => matchRule(clientValue, rule));

            if (applicableRule) {
                pontos[pillar.id] += applicableRule.points;
            }
        });
    });

    const scoreTotal = pontos.trafego + pontos.conversao + pontos.aprovacao + pontos.lucratividade;

    return {
        total: scoreTotal,
        detalhes: pontos
    };
}

// ==========================================
// 3.2 CLASSIFICAÇÃO AUTOMÁTICA
// ==========================================
export function classifyClient(score: number): ClientClassification {
    if (score >= 85) {
        return {
            status: "ESCALAR",
            emoji: "🟢",
            cor: "#00C853",
            acao: "ESCALAR FORTE (+50-100% budget)",
            urgencia: "AGORA",
            descricao: "Operação matadora. É hora de triplicar budget e dominar o mercado."
        };
    }
    else if (score >= 70) {
        return {
            status: "OTIMIZADO",
            emoji: "🟢",
            cor: "#00C853",
            acao: "Aumentar budget +30-50%",
            urgencia: "ESTA SEMANA",
            descricao: "Operação otimizada e saudável. Escalar com segurança."
        };
    }
    else if (score >= 60) {
        return {
            status: "BOM",
            emoji: "🟡",
            cor: "#FFD600",
            acao: "Aumentar budget +20-30%",
            urgencia: "ESTA SEMANA",
            descricao: "Resultado bom. Pequenos ajustes podem levar à escala forte."
        };
    }
    else if (score >= 50) {
        return {
            status: "OTIMIZAR",
            emoji: "🟡",
            cor: "#FFD600",
            acao: "Manter e melhorar gargalos",
            urgencia: "URGENTE",
            descricao: "Ponto de equilíbrio. Precisa de otimização de conversão/CPC."
        };
    }
    else if (score >= 40) {
        return {
            status: "ATENÇÃO",
            emoji: "🟠",
            cor: "#FF6D00",
            acao: "Reduzir e corrigir urgente",
            urgencia: "URGENTE",
            descricao: "Zona de risco. Corrigir métricas antes de continuar investindo."
        };
    }
    else if (score >= 30) {
        return {
            status: "CRÍTICO",
            emoji: "🔴",
            cor: "#D50000",
            acao: "Reduzir budget -50%, rever tudo",
            urgencia: "IMEDIATO",
            descricao: "Operação com sérios problemas de rentabilidade ou aprovação."
        };
    }
    else {
        return {
            status: "PAUSAR",
            emoji: "⛔",
            cor: "#7F1D1D",
            acao: "PAUSAR E PIVOTAR",
            urgencia: "IMEDIATO",
            descricao: "Insustentável. Necessário mudança drástica de produto ou criativo."
        };
    }
}

// ==========================================
// 4. IDENTIFICAÇÃO DE GARGALOS
// ==========================================
export function identifyBottlenecks(cliente: ClientMetrics): Bottleneck[] {
    const gargalos: Bottleneck[] = [];

    if (cliente.cpc > 1.50 || cliente.ctr < 1.0) {
        gargalos.push({
            area: "TRÁFEGO",
            problema: "CPC alto ou CTR baixo",
            impacto: "ALTO",
            descricao: "Anúncios não estão performando bem. Público errado ou criativos fracos.",
            acoes: ["Trocar criativos", "Refinar público-alvo", "Pausar anúncios ruins"]
        });
    }

    if (cliente.taxaAddToCart < 10) {
        gargalos.push({
            area: "PÁGINA DO PRODUTO",
            problema: "Poucos adicionar ao carrinho",
            impacto: "CRÍTICO",
            descricao: "Problema na proposta de valor, preço ou confiança.",
            acoes: ["Melhorar fotos", "Adicionar vídeos", "Incluir avaliações", "Adicionar urgência"]
        });
    }

    if (cliente.taxaCheckout < 45) {
        gargalos.push({
            area: "CHECKOUT",
            problema: "Muitos desistem no checkout",
            impacto: "CRÍTICO",
            descricao: "Atrito no processo de compra. Pode ser complexidade ou surpresas de custo.",
            acoes: ["Simplificar checkout", "Mostrar frete antes", "Oferecer PIX", "1-click purchase"]
        });
    }

    if (cliente.taxaAprovacao < 70) {
        gargalos.push({
            area: "GATEWAY",
            problema: "Taxa de aprovação baixa",
            impacto: "CRÍTICO",
            descricao: "Perda direta de vendas já convertidas. Pode ser limite de cartão ou antifraude agressivo.",
            acoes: ["Múltiplos subadquirentes", "Oferecer PIX", "Reduzir ticket", "Menos restrições antifraude"]
        });
    }

    if (cliente.roas < 3.0 && cliente.taxaConversaoSite > 2.0) {
        gargalos.push({
            area: "CPA",
            problema: "CPA muito alto",
            impacto: "CRÍTICO",
            descricao: "Site converte bem mas o custo de trazer clientes está caro demais.",
            acoes: ["Otimizar criativos", "Refinar público", "Pausar horários ruins", "Remarketing"]
        });
    }

    if (cliente.margemContribuicao < 25) {
        gargalos.push({
            area: "LUCRO",
            problema: "Margem muito baixa",
            impacto: "CRÍTICO",
            descricao: "Mesmo vendendo bem, a operação não é lucrativa o suficiente.",
            acoes: ["Negociar preço fornecedor", "Aumentar preço", "Mais upsell", "Trocar produto"]
        });
    }

    return gargalos;
}

// ==========================================
// 5. MATRIZ DE DECISÃO AUTOMÁTICA
// ==========================================
export function generateRecommendation(cliente: ClientMetrics): Recommendation {
    const { roas, taxaConversaoSite, taxaAprovacao, margemContribuicao, spend } = cliente;
    const score = calculateHealthScore(cliente).total;

    // ESCALAR FORTE
    if (score >= 85 && roas >= 6.0) {
        return {
            decisao: "ESCALAR AGRESSIVAMENTE",
            acao: `Aumentar budget em +50-100% (Meta R$ ${(spend * 2).toFixed(0)})`,
            confianca: "ALTA",
            detalhes: [
                "✅ Duplicar escala em campanhas vencedoras",
                "✅ Criar Lookalikes de 1% e 3% (Compradores)",
                "✅ Escalar horizontalmente (novos interesses)",
                "✅ Aumentar lances manuais se necessário"
            ]
        };
    }

    // ESCALAR MODERADO
    else if (score >= 70 && roas >= 4.0) {
        return {
            decisao: "ESCALAR MODERADAMENTE",
            acao: `Aumentar budget em +30-50%`,
            confianca: "ALTA",
            detalhes: [
                "✅ Aumentar budget em 20% a cada 2 dias",
                "🔧 Otimizar CPC via novos criativos",
                "✅ Testar públicos semelhantes (Checkout)",
                "🟡 Monitorar ROAS de perto"
            ]
        };
    }

    // MANTER E OTIMIZAR
    else if (score >= 50 && roas >= 3.0) {
        return {
            decisao: "MANTER E OTIMIZAR",
            acao: "Focar em melhorar conversão e aprovação",
            confianca: "MÉDIA",
            detalhes: [
                "🔧 Ajustar oferta/copy na página de vendas",
                "🔧 Revisar recuperação de carrinho (PIX/WhatsApp)",
                "🔧 Testar novo gateway se aprovação < 70%",
                "⚠️ NÃO aumentar budget agora"
            ]
        };
    }

    // REDUZIR OU PAUSAR
    else {
        return {
            decisao: "REDUZIR E CORRIGIR",
            acao: score < 30 ? "PAUSAR IMEDIATAMENTE" : "Reduzir budget em -50%",
            confianca: "CRÍTICA",
            detalhes: [
                "🔴 Pausar todos os anúncios com ROAS < 2.0",
                "🔴 Revisar precificação ou custo do fornecedor",
                "🔴 Testar criativos totalmente diferentes",
                "❌ Evitar queima de caixa desnecessária"
            ]
        };
    }
}
