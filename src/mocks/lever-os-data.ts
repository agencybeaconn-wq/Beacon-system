import { Client, Task, ChecklistItem } from "@/types/lever-os";

export const MOCK_CLIENT_DETAILS: Client = {
    id: "1",
    name: "Loja Moda Fitness",
    primaryColor: "#FF6B6B",
    status: "implementation",
    serviceType: "assessoria_completa",
    financials: {
        fixedFee: 2500.00,
        variableFeePercentage: 10, // 10%
        currency: "BRL",
        contractStartDate: "2024-01-15"
    },
    progress: 35,
    credentials: [
        {
            id: "c1",
            platform: "shopify",
            name: "Loja Shopify Principial",
            url: "https://modafitness.myshopify.com/admin",
            username: "admin@modafitness.com.br",
            password: "••••••••",
            notes: "Acesso de colaborador pendente"
        },
        {
            id: "c2",
            platform: "google_ads",
            name: "Google Ads Conta 1",
            username: "ID: 123-456-7890",
            notes: "Acesso via MCC solicitado"
        }
    ],
    onboardingPhases: [
        {
            id: "phase1",
            title: "Alinhamento & Estratégia",
            isLocked: false,
            steps: [
                { id: "s1", title: "Call de Kick-off", status: "completed", assigneeRole: "head", completedAt: "2024-01-16" },
                { id: "s2", title: "Definição de Personas", status: "completed", assigneeRole: "media_buyer", completedAt: "2024-01-17" },
                { id: "s3", title: "Aprovação do Plano de Mídia", status: "completed", assigneeRole: "head", completedAt: "2024-01-18" }
            ]
        },
        {
            id: "phase2",
            title: "Coleta e Acessos",
            isLocked: false,
            steps: [
                { id: "s4", title: "Solicitar acesso Shopify", status: "completed", assigneeRole: "head" },
                { id: "s5", title: "Criar BM e Pixel", status: "in_progress", assigneeRole: "media_buyer" },
                { id: "s6", title: "Verificar acesso Google Drive", status: "pending", assigneeRole: "head" }
            ]
        },
        {
            id: "phase3",
            title: "Infraestrutura E-commerce",
            isLocked: false,
            steps: [
                { id: "s7", title: "Upload do Tema Premium (Zip)", status: "pending", assigneeRole: "dev" },
                { id: "s8", title: "Importação de Produtos (CSV)", status: "pending", assigneeRole: "dev" },
                { id: "s9", title: "Configuração Checkout CardPanda", status: "pending", assigneeRole: "dev" },
                { id: "s10", title: "Conexão de Domínio", status: "blocked", assigneeRole: "dev", description: "Aguardando cliente comprar o domínio" }
            ]
        },
        {
            id: "phase4",
            title: "Growth & Automação",
            isLocked: true,
            steps: [
                { id: "s11", title: "Configurar Reportana (WhatsApp)", status: "pending", assigneeRole: "dev" },
                { id: "s12", title: "Validar Eventos (GTM/Pixel)", status: "pending", assigneeRole: "media_buyer" }
            ]
        }
    ]
};

export const MOCK_TASKS: Task[] = [
    {
        id: "t1",
        clientId: "1",
        title: "Configurar DNS do domínio",
        description: "Apontar entradas A e CNAME para o Shopify",
        status: "backlog",
        priority: "high",
        createdAt: "2024-01-19",
        checklist: [
            { id: "cl1_1", title: "Verificar propriedade do domínio", isCompleted: false },
            { id: "cl1_2", title: "Configurar CNAME Record", isCompleted: false },
            { id: "cl1_3", title: "Configurar A Record", isCompleted: false },
            { id: "cl1_4", title: "Aguardar propagação DNS", isCompleted: false },
            { id: "cl1_5", title: "Testar domínio funcionando", isCompleted: false },
        ]
    },
    {
        id: "t2",
        clientId: "1",
        title: "Criar banners para coleção de verão",
        description: "Necessário 3 banners (Mobile e Desktop)",
        status: "todo",
        priority: "medium",
        createdAt: "2024-01-20",
        area: "design",
        checklist: [
            { id: "cl2_1", title: "Receber briefing do cliente", isCompleted: true, completedAt: "2024-01-20" },
            { id: "cl2_2", title: "Criar versão desktop (1920x600)", isCompleted: false },
            { id: "cl2_3", title: "Criar versão mobile (800x800)", isCompleted: false },
            { id: "cl2_4", title: "Exportar em formato otimizado", isCompleted: false },
            { id: "cl2_5", title: "Enviar para aprovação", isCompleted: false },
        ]
    },
    {
        id: "t3",
        clientId: "1",
        title: "Validar catálogo do Google Merchant",
        description: "Verificar se produtos foram aprovados",
        status: "in_progress",
        priority: "high",
        createdAt: "2024-01-18",
        area: "traffic",
        checklist: [
            { id: "cl3_1", title: "Acessar Google Merchant Center", isCompleted: true, completedAt: "2024-01-18" },
            { id: "cl3_2", title: "Verificar status dos produtos", isCompleted: true, completedAt: "2024-01-18" },
            { id: "cl3_3", title: "Corrigir produtos reprovados", isCompleted: false },
            { id: "cl3_4", title: "Reenviar feed atualizado", isCompleted: false },
        ]
    }
];

export const MOCK_CLIENTS_LIST = [
    { id: "1", name: "Loja Moda Fitness", color: "#FF6B6B", accounts: [{ id: "act_1", name: "Conta 01", activeCampaigns: 2 }] },
    { id: "2", name: "Restaurante Sabor & Arte", color: "#4ECDC4", accounts: [] },
    { id: "3", name: "Tech Solutions LTDA", color: "#45B7D1", accounts: [{ id: "act_2", name: "Conta Tech", activeCampaigns: 5 }] },
    { id: "4", name: "Clínica Bem Estar", color: "#96CEB4", accounts: [] },
    { id: "5", name: "Imobiliária Premium", color: "#FFEAA7", accounts: [] },
];

// Membros de equipe fake para testes de fluxo
export const MOCK_TEAM_MEMBERS = [
    {
        id: "tm1",
        name: "João Victor",
        role: "head" as const,
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=JoaoVictor&backgroundColor=b6e3f4",
        email: "joao@leverdigital.com.br"
    },
    {
        id: "tm2",
        name: "Marina Alves",
        role: "media_buyer" as const,
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=MarinaAlves&backgroundColor=ffdfbf",
        email: "marina@leverdigital.com.br"
    },
    {
        id: "tm3",
        name: "Carlos Dev",
        role: "dev" as const,
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=CarlosDev&backgroundColor=c0aede",
        email: "carlos@leverdigital.com.br"
    },
];
