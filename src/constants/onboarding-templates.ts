import { OnboardingTemplate, PhaseTemplate } from '@/types/onboarding';

// =============================================================================
// TEMPLATES: Fases e tarefas geradas automaticamente por tipo de onboarding
// =============================================================================

// ---------------------------------------------------------------------------
// MRR START — 7 fases sequenciais
// ---------------------------------------------------------------------------
const MRR_START_PHASES: PhaseTemplate[] = [
  {
    phase_key: 'pre_onboarding',
    phase_name: 'Pré-Onboarding',
    phase_order: 0,
    due_days_offset: 0,
    tasks: [
      { task_key: 'registrar_cliente', task_name: 'Registrar cliente no sistema Lever', task_order: 1, is_required: true },
      { task_key: 'criar_grupo_whatsapp', task_name: 'Criar grupo no WhatsApp', task_order: 2, is_required: true },
      { task_key: 'adicionar_membros_grupo', task_name: 'Adicionar membros da equipe ao grupo (CS + Designer + Tráfego)', task_order: 3, is_required: true },
      { task_key: 'enviar_boas_vindas', task_name: 'Enviar mensagem de boas-vindas padrão', task_order: 4, is_required: true },
      { task_key: 'conceder_acesso_portal', task_name: 'Conceder acesso ao Portal do Cliente', task_order: 5, is_required: true },
    ],
  },
  {
    phase_key: 'briefing_coleta',
    phase_name: 'Briefing e Coleta de Dados',
    phase_order: 1,
    due_days_offset: 3,
    tasks: [
      { task_key: 'acompanhar_briefing', task_name: 'Acompanhar preenchimento do briefing', task_order: 1, is_required: true },
      { task_key: 'solicitar_faltantes', task_name: 'Solicitar informações faltantes ao cliente', task_order: 2, is_required: false },
      { task_key: 'solicitar_acessos', task_name: 'Solicitar acessos: Shopify, Meta Ads, Google Analytics', task_order: 3, is_required: true },
      { task_key: 'briefing_validado', task_name: 'Marcar briefing como VALIDADO', task_order: 4, is_required: true },
    ],
  },
  {
    phase_key: 'design_producao_visual',
    phase_name: 'Processo de Design e Produção Visual',
    phase_order: 2,
    due_days_offset: 5,
    tasks: [
      { task_key: 'produzir_banners', task_name: 'Desenvolver banners (Hero, coleção, promo, categoria)', task_order: 1, is_required: true },
      { task_key: 'produzir_copy', task_name: 'Produzir copy para comunicação visual', task_order: 2, is_required: true },
      { task_key: 'criar_arte_visual', task_name: 'Criar arte visual do site', task_order: 3, is_required: true },
      { task_key: 'ajustar_logo', task_name: 'Ajustar logo (se necessário)', task_order: 4, is_required: false },
      { task_key: 'revisar_responsividade', task_name: 'Revisar responsividade mobile e desktop', task_order: 5, is_required: true },
    ],
  },
  {
    phase_key: 'implementacao_site',
    phase_name: 'Implementação — Site e Tema',
    phase_order: 3,
    due_days_offset: 7,
    tasks: [
      // Site e Tema
      { task_key: 'instalar_tema', task_name: 'Instalar/configurar Tema Lever (se aplicável)', task_order: 1, is_required: false },
      { task_key: 'configurar_identidade', task_name: 'Configurar cores e identidade visual', task_order: 2, is_required: true },
      { task_key: 'criar_paginas', task_name: 'Criar/ajustar páginas: Home, Coleções, Produto, Sobre, Contato', task_order: 3, is_required: true },
      { task_key: 'configurar_menu', task_name: 'Configurar menu de navegação e categorias', task_order: 4, is_required: true },
      { task_key: 'configurar_checkout', task_name: 'Configurar checkout (Shopify/CartPanda/Yampi)', task_order: 5, is_required: true },
      { task_key: 'inserir_politicas', task_name: 'Inserir políticas: troca, devolução, privacidade, termos', task_order: 6, is_required: true },
      { task_key: 'configurar_frete', task_name: 'Configurar informações de frete e entrega', task_order: 7, is_required: true },
      { task_key: 'inserir_banners', task_name: 'Inserir banners no site', task_order: 8, is_required: true },
      // Produtos e Preços (merged)
      { task_key: 'precos_base', task_name: 'Configurar preços base por tipo de produto', task_order: 9, is_required: true },
      { task_key: 'acrescimos', task_name: 'Configurar acréscimos (Patch, 2GG, 3GG, 4GG, Personalização, Manga Longa)', task_order: 10, is_required: true },
      { task_key: 'ofertas', task_name: 'Configurar ofertas: Pague X Leve Y, promoções customizadas', task_order: 11, is_required: false },
      { task_key: 'validar_moeda', task_name: 'Validar moeda correta', task_order: 12, is_required: true },
    ],
  },
  {
    phase_key: 'erro_zero',
    phase_name: 'Revisão Erro Zero — QA',
    phase_order: 4,
    due_days_offset: 7,
    tasks: [
      { task_key: 'revisar_paginas', task_name: 'Revisar TODAS as páginas do site (visual + funcional)', task_order: 1, is_required: true },
      { task_key: 'testar_compra_completa', task_name: 'Testar compra completa (carrinho → checkout → pagamento)', task_order: 2, is_required: true },
      { task_key: 'verificar_precos', task_name: 'Verificar preços e acréscimos em todos os produtos', task_order: 3, is_required: true },
      { task_key: 'conferir_banners', task_name: 'Conferir banners em mobile e desktop', task_order: 4, is_required: true },
      { task_key: 'validar_politicas', task_name: 'Validar políticas e páginas institucionais', task_order: 5, is_required: true },
      { task_key: 'conferir_pixel', task_name: 'Conferir pixel e rastreamento', task_order: 6, is_required: true },
      { task_key: 'documentar_pendencias', task_name: 'Documentar pendências (resolver em até 24h)', task_order: 7, is_required: false },
      { task_key: 'aprovacao_qa', task_name: 'Marcar como APROVADO ou PENDENTE', task_order: 8, is_required: true },
    ],
  },
  {
    phase_key: 'implementacao_trafego',
    phase_name: 'Implementação — Tráfego Pago',
    phase_order: 5,
    due_days_offset: 7,
    tasks: [
      { task_key: 'configurar_pixel', task_name: 'Configurar pixel/API de conversão (Meta, Google)', task_order: 1, is_required: true },
      { task_key: 'estrutura_campanhas', task_name: 'Criar estrutura inicial de campanhas', task_order: 2, is_required: true },
      { task_key: 'primeiros_criativos', task_name: 'Produzir primeiros criativos com direcionamento', task_order: 3, is_required: true },
      { task_key: 'ativar_campanhas', task_name: 'Ativar campanhas iniciais', task_order: 4, is_required: true },
    ],
  },
  {
    phase_key: 'kickoff_cliente',
    phase_name: 'Growth Class e Kick-Off com Cliente',
    phase_order: 6,
    due_days_offset: 10,
    tasks: [
      { task_key: 'agendar_kickoff', task_name: 'Agendar reunião de Kick-Off com o cliente', task_order: 1, is_required: true },
      { task_key: 'apresentar_implementacao', task_name: 'Apresentar tudo que foi implementado', task_order: 2, is_required: true },
      { task_key: 'mostrar_dashboards', task_name: 'Mostrar dashboards e métricas disponíveis', task_order: 3, is_required: true },
      { task_key: 'growth_class', task_name: 'Realizar Growth Class', task_order: 4, is_required: true },
      { task_key: 'plantar_semente', task_name: 'Plantar Semente: definir 1º desafio/meta do mês', task_order: 5, is_required: true },
      { task_key: 'alinhar_comunicacao', task_name: 'Alinhar frequência de comunicação', task_order: 6, is_required: true },
      { task_key: 'confirmar_entendimento', task_name: 'Confirmar que cliente entendeu o plano', task_order: 7, is_required: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// MRR GROWTH — Fases adicionais sobre MRR Start (entre Site e QA)
// ---------------------------------------------------------------------------
const MRR_GROWTH_EXTRA_PHASES: PhaseTemplate[] = [
  {
    phase_key: 'implementacao_automacoes',
    phase_name: 'Implementação — Automações',
    phase_order: 3.1,
    due_days_offset: 10,
    parallel_group: 'implementacao_growth',
    tasks: [
      { task_key: 'recuperacao_carrinho', task_name: 'Implementar fluxos de recuperação de carrinho abandonado', task_order: 1, is_required: true },
      { task_key: 'automacoes_conversao', task_name: 'Configurar automações de conversão e recuperação de vendas', task_order: 2, is_required: true },
      { task_key: 'testar_automacoes', task_name: 'Testar todos os fluxos automáticos', task_order: 3, is_required: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// AVULSO — TEMA
// ---------------------------------------------------------------------------
const AVULSO_TEMA_PHASES: PhaseTemplate[] = [
  {
    phase_key: 'registro',
    phase_name: 'Registro',
    phase_order: 0,
    due_days_offset: 0,
    tasks: [
      { task_key: 'registrar_cliente', task_name: 'Registrar cliente no sistema', task_order: 1, is_required: true },
      { task_key: 'classificar_avulso_tema', task_name: 'Classificar como Avulso — Tema', task_order: 2, is_required: true },
    ],
  },
  {
    phase_key: 'licenca',
    phase_name: 'Geração de Licença',
    phase_order: 1,
    due_days_offset: 1,
    tasks: [
      { task_key: 'gerar_licenca', task_name: 'Gerar licença do Tema Lever', task_order: 1, is_required: true },
      { task_key: 'enviar_licenca', task_name: 'Enviar licença ao cliente', task_order: 2, is_required: true },
      { task_key: 'confirmar_ativacao', task_name: 'Confirmar ativação pelo cliente', task_order: 3, is_required: true },
      { task_key: 'concluir', task_name: 'Marcar como concluído', task_order: 4, is_required: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// AVULSO — REFORMULAÇÃO (briefing simplificado)
// ---------------------------------------------------------------------------
const AVULSO_REFORMULACAO_PHASES: PhaseTemplate[] = [
  {
    phase_key: 'pre_onboarding',
    phase_name: 'Pré-Onboarding',
    phase_order: 0,
    due_days_offset: 0,
    tasks: [
      { task_key: 'registrar_cliente', task_name: 'Registrar cliente no sistema', task_order: 1, is_required: true },
      { task_key: 'classificar_avulso_reformulacao', task_name: 'Classificar como Avulso — Reformulação', task_order: 2, is_required: true },
      { task_key: 'criar_grupo_whatsapp', task_name: 'Criar grupo no WhatsApp', task_order: 3, is_required: true },
      { task_key: 'adicionar_membros', task_name: 'Adicionar membros da equipe (CS + Designer + Técnico)', task_order: 4, is_required: true },
      { task_key: 'enviar_boas_vindas', task_name: 'Enviar mensagem de boas-vindas', task_order: 5, is_required: true },
    ],
  },
  {
    phase_key: 'briefing_reformulacao',
    phase_name: 'Briefing de Reformulação',
    phase_order: 1,
    due_days_offset: 3,
    tasks: [
      { task_key: 'enviar_briefing', task_name: 'Enviar briefing tipo REFORMULAÇÃO', task_order: 1, is_required: true },
      { task_key: 'acompanhar_briefing', task_name: 'Acompanhar preenchimento do briefing', task_order: 2, is_required: true },
      { task_key: 'solicitar_acessos', task_name: 'Solicitar acessos: Shopify admin', task_order: 3, is_required: true },
      { task_key: 'briefing_validado', task_name: 'Marcar briefing como VALIDADO', task_order: 4, is_required: true },
    ],
  },
  {
    phase_key: 'implementacao',
    phase_name: 'Implementação',
    phase_order: 2,
    due_days_offset: 10,
    tasks: [
      { task_key: 'ajustar_layout', task_name: 'Ajustar layout completo do site', task_order: 1, is_required: true },
      { task_key: 'configurar_identidade', task_name: 'Configurar cores e identidade visual', task_order: 2, is_required: true },
      { task_key: 'criar_paginas', task_name: 'Criar/ajustar todas as páginas', task_order: 3, is_required: true },
      { task_key: 'configurar_menu', task_name: 'Configurar menu e categorias', task_order: 4, is_required: true },
      { task_key: 'configurar_checkout', task_name: 'Configurar checkout', task_order: 5, is_required: true },
      { task_key: 'inserir_politicas', task_name: 'Inserir políticas', task_order: 6, is_required: true },
      { task_key: 'configurar_frete', task_name: 'Configurar frete', task_order: 7, is_required: true },
      { task_key: 'produzir_banners', task_name: 'Produzir e inserir banners', task_order: 8, is_required: true },
      { task_key: 'responsividade', task_name: 'Ajustar responsividade', task_order: 9, is_required: true },
    ],
  },
  {
    phase_key: 'revisao_entrega',
    phase_name: 'Revisão e Entrega',
    phase_order: 3,
    due_days_offset: 12,
    tasks: [
      { task_key: 'revisao_erro_zero', task_name: 'Revisão completa (Erro Zero)', task_order: 1, is_required: true },
      { task_key: 'testar_compra', task_name: 'Testar fluxo de compra', task_order: 2, is_required: true },
      { task_key: 'apresentar_cliente', task_name: 'Apresentar ao cliente', task_order: 3, is_required: true },
      { task_key: 'coletar_aprovacao', task_name: 'Coletar aprovação', task_order: 4, is_required: true },
      { task_key: 'concluir', task_name: 'Marcar como concluído', task_order: 5, is_required: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// AVULSO — ARTE/DESIGN
// ---------------------------------------------------------------------------
const AVULSO_ARTE_PHASES: PhaseTemplate[] = [
  {
    phase_key: 'registro',
    phase_name: 'Registro',
    phase_order: 0,
    due_days_offset: 0,
    tasks: [
      { task_key: 'registrar_cliente', task_name: 'Registrar cliente no sistema', task_order: 1, is_required: true },
      { task_key: 'classificar_avulso_arte', task_name: 'Classificar como Avulso — Arte/Design', task_order: 2, is_required: true },
    ],
  },
  {
    phase_key: 'briefing_arte',
    phase_name: 'Briefing de Arte',
    phase_order: 1,
    due_days_offset: 2,
    tasks: [
      { task_key: 'enviar_briefing', task_name: 'Enviar briefing tipo ARTE_DESIGN', task_order: 1, is_required: true },
      { task_key: 'coletar_tipo', task_name: 'Coletar tipo de arte (logo, banner, criativos, identidade)', task_order: 2, is_required: true },
      { task_key: 'coletar_referencias', task_name: 'Coletar referências visuais', task_order: 3, is_required: true },
      { task_key: 'coletar_cores', task_name: 'Coletar cores e paleta', task_order: 4, is_required: true },
      { task_key: 'coletar_textos', task_name: 'Coletar textos e conteúdo', task_order: 5, is_required: true },
      { task_key: 'coletar_formatos', task_name: 'Coletar tamanhos e formatos', task_order: 6, is_required: true },
      { task_key: 'coletar_quantidade', task_name: 'Coletar quantidade de peças', task_order: 7, is_required: true },
      { task_key: 'coletar_prazo', task_name: 'Coletar prazo desejado', task_order: 8, is_required: true },
      { task_key: 'briefing_validado', task_name: 'Marcar briefing como VALIDADO', task_order: 9, is_required: true },
    ],
  },
  {
    phase_key: 'producao',
    phase_name: 'Produção',
    phase_order: 2,
    due_days_offset: 7,
    tasks: [
      { task_key: 'criar_pecas', task_name: 'Criar peças conforme briefing', task_order: 1, is_required: true },
      { task_key: 'enviar_v1', task_name: 'Enviar primeira versão para aprovação', task_order: 2, is_required: true },
      { task_key: 'aplicar_ajustes', task_name: 'Aplicar ajustes solicitados (até 2 rodadas)', task_order: 3, is_required: false },
      { task_key: 'versao_final', task_name: 'Enviar versão final', task_order: 4, is_required: true },
    ],
  },
  {
    phase_key: 'entrega',
    phase_name: 'Entrega',
    phase_order: 3,
    due_days_offset: 9,
    tasks: [
      { task_key: 'enviar_arquivos', task_name: 'Enviar arquivos finais nos formatos acordados', task_order: 1, is_required: true },
      { task_key: 'confirmar_recebimento', task_name: 'Confirmar recebimento pelo cliente', task_order: 2, is_required: true },
      { task_key: 'concluir', task_name: 'Marcar como concluído', task_order: 3, is_required: true },
    ],
  },
];

// =============================================================================
// EXPORTED TEMPLATES MAP
// =============================================================================

export const ONBOARDING_TEMPLATES: Record<string, OnboardingTemplate> = {
  mrr_start: {
    template_key: 'mrr_start',
    phases: MRR_START_PHASES,
  },
  mrr_growth: {
    template_key: 'mrr_growth',
    phases: [
      ...MRR_START_PHASES,
      ...MRR_GROWTH_EXTRA_PHASES,
    ].sort((a, b) => a.phase_order - b.phase_order),
  },
  avulso_tema: {
    template_key: 'avulso_tema',
    phases: AVULSO_TEMA_PHASES,
  },
  avulso_reformulacao: {
    template_key: 'avulso_reformulacao',
    phases: AVULSO_REFORMULACAO_PHASES,
  },
  avulso_arte: {
    template_key: 'avulso_arte',
    phases: AVULSO_ARTE_PHASES,
  },
};

export function getTemplateForType(type: string): OnboardingTemplate | null {
  return ONBOARDING_TEMPLATES[type] || null;
}
