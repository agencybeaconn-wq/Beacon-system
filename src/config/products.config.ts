import { Package, Star, Calendar, ShoppingBag, Palette, Zap, Code, Globe, ImageIcon, Workflow } from "lucide-react";

export type ProductCategory = "flagship" | "fixed" | "avulso";
export type PricingType = "fixed" | "percentage" | "unique";

export interface ProductItem {
    id: string;
    name: string;
    description: string;
    category: ProductCategory;
    pricingType: PricingType;
    price?: string;
    priceNote?: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    features: string[];
    detailedDescription?: string;
    isFlagship?: boolean;
}

export const PRODUCTS: ProductItem[] = [
    // ⭐ FLAGSHIP
    {
        id: "assessoria-360",
        name: "Assessoria 360",
        description: "Solução completa para escalar seu e-commerce com resultados reais.",
        category: "flagship",
        pricingType: "percentage",
        price: "A partir de R$ 5.000 + % sobre faturamento",
        priceNote: "Consulte valores personalizados",
        icon: Star,
        color: "#7C3AED",
        isFlagship: true,
        features: [
            "Estratégia de Growth completa",
            "Análise 360° de negócio",
            "Tema Shopify Premium",
            "Gestão de Tráfego Pago (Meta + Google)",
            "Automações de Marketing (E-mail, WhatsApp)",
            "Relatórios e Dashboards em tempo real",
            "Calls mensais de alinhamento",
        ],
        detailedDescription: "Nossa assessoria flagship inclui tudo que você precisa para escalar seu e-commerce. Desde a estratégia inicial até a execução e otimização contínua, nossa equipe cuida de todas as pontas do seu negócio digital."
    },

    // 📅 PRODUTOS FIXOS MENSAIS
    {
        id: "gestao-trafego-criativos",
        name: "Gestão de Tráfego + Criativos",
        description: "Campanhas otimizadas com criativos de alta conversão.",
        category: "fixed",
        pricingType: "fixed",
        price: "R$ 3.500/mês",
        priceNote: "+ ad spend mínimo de R$ 5.000",
        icon: ShoppingBag,
        color: "#10B981",
        features: [
            "Gestão completa de Meta Ads",
            "Criação de até 20 criativos/mês",
            "Testes A/B contínuos",
            "Relatório semanal de performance",
            "Otimização de públicos e orçamento",
        ],
        detailedDescription: "Serviço mensal de gestão de tráfego pago com foco em resultados. Inclui criação de criativos profissionais e otimização constante das campanhas."
    },
    {
        id: "manutencao-shopify",
        name: "Manutenção Shopify",
        description: "Suporte técnico contínuo para sua loja Shopify.",
        category: "fixed",
        pricingType: "fixed",
        price: "R$ 1.500/mês",
        icon: Code,
        color: "#F59E0B",
        features: [
            "Suporte técnico prioritário",
            "Atualizações de tema e apps",
            "Correções de bugs",
            "Pequenas alterações de layout",
            "Monitoramento de performance",
        ],
        detailedDescription: "Mantenha sua loja Shopify sempre funcionando perfeitamente. Nossa equipe técnica cuida de todas as atualizações e correções necessárias."
    },

    // 📦 PRODUTOS AVULSOS/UNITÁRIOS
    {
        id: "temas-shopify",
        name: "Temas Shopify",
        description: "Temas personalizados de alta conversão.",
        category: "avulso",
        pricingType: "unique",
        price: "A partir de R$ 8.000",
        icon: Palette,
        color: "#EC4899",
        features: [
            "Design exclusivo e responsivo",
            "Otimizado para conversão",
            "Compatível com OS 2.0",
            "Integrações nativas Shopify",
            "30 dias de suporte pós-entrega",
        ],
        detailedDescription: "Desenvolva um tema único para sua marca. Nossos temas são criados com foco em UX e conversão, seguindo as melhores práticas do mercado."
    },
    {
        id: "automacoes",
        name: "Implementação de Automações",
        description: "Fluxos automatizados para escalar suas vendas.",
        category: "avulso",
        pricingType: "unique",
        price: "A partir de R$ 2.500",
        icon: Zap,
        color: "#8B5CF6",
        features: [
            "Fluxos de e-mail marketing",
            "Automações de WhatsApp",
            "Recuperação de carrinho abandonado",
            "Upsell e cross-sell automatizado",
            "Integração com CRM",
        ],
        detailedDescription: "Automatize processos repetitivos e aumente suas vendas com fluxos inteligentes de comunicação com seus clientes."
    },
    {
        id: "scripts-shopify",
        name: "Scripts Shopify",
        description: "Scripts customizados para funcionalidades avançadas.",
        category: "avulso",
        pricingType: "unique",
        price: "A partir de R$ 1.000",
        icon: Code,
        color: "#EF4444",
        features: [
            "Descontos progressivos",
            "Frete grátis condicional",
            "Bundles personalizados",
            "Checkout customizado",
            "Integrações especiais",
        ],
        detailedDescription: "Scripts Liquid personalizados para adicionar funcionalidades exclusivas à sua loja Shopify."
    },
    {
        id: "criacao-sites",
        name: "Criação de Sites",
        description: "Sites institucionais e landing pages de alta conversão.",
        category: "avulso",
        pricingType: "unique",
        price: "A partir de R$ 5.000",
        icon: Globe,
        color: "#3B82F6",
        features: [
            "Design responsivo moderno",
            "Otimização para SEO",
            "Integração com analytics",
            "Formulários de captação",
            "CMS para edição fácil",
        ],
        detailedDescription: "Criamos sites institucionais e landing pages focados em conversão e performance."
    },
    {
        id: "pacotes-criativos",
        name: "Pacotes de Criativos",
        description: "Criativos profissionais para suas campanhas.",
        category: "avulso",
        pricingType: "unique",
        price: "A partir de R$ 1.500",
        icon: ImageIcon,
        color: "#06B6D4",
        features: [
            "10 criativos estáticos",
            "3 vídeos curtos (Reels/TikTok)",
            "Adaptação multi-formato",
            "2 rodadas de revisão",
            "Entrega em alta qualidade",
        ],
        detailedDescription: "Pacotes de criativos profissionais para suas campanhas de mídia paga. Inclui imagens e vídeos otimizados."
    },
    {
        id: "n8n-automacoes",
        name: "n8n - Automações Avançadas",
        description: "Workflows avançados com n8n para integrações complexas.",
        category: "avulso",
        pricingType: "unique",
        price: "A partir de R$ 3.000",
        icon: Workflow,
        color: "#9333EA",
        features: [
            "Integrações multi-plataforma",
            "Sincronização de dados",
            "Webhooks customizados",
            "Automações de backoffice",
            "Documentação completa",
        ],
        detailedDescription: "Automatize processos complexos com workflows n8n. Ideal para integrações entre diferentes sistemas e automações de backoffice."
    },
];

// Helper functions
export const getProductsByCategory = (category: ProductCategory) =>
    PRODUCTS.filter(p => p.category === category);

export const getFlagshipProduct = () =>
    PRODUCTS.find(p => p.isFlagship);

export const getPricingLabel = (type: PricingType): string => {
    switch (type) {
        case "fixed": return "Mensal Fixo";
        case "percentage": return "% + Fixo";
        case "unique": return "Pagamento Único";
    }
};

export const getPricingColor = (type: PricingType): string => {
    switch (type) {
        case "fixed": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
        case "percentage": return "bg-violet-500/10 text-violet-600 border-violet-500/20";
        case "unique": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    }
};
