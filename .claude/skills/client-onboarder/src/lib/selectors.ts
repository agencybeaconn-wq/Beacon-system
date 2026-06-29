// Seletores centralizados — refinar no primeiro run real, são fallbacks múltiplos.
// Dev Dashboard usa Polaris, IDs/data-testids podem mudar.
// Lever System usa shadcn/Tailwind, geralmente texto visível serve.

// Validados contra a UI real do Dev Dashboard (org Lever Digital, PT-BR) em 2026-05-28.
// Navegação por URL (/apps/{id}/versions, /settings) é preferida a clicar no submenu
// (que fica não-visível). Selectors estruturais (name="version[...]") são estáveis.
export const DEV_DASHBOARD_SELECTORS = {
  // Apps list — "Criar app" é um <a> que navega pra /apps/new (não é modal)
  buttonCreateApp: 'text=Criar app',
  // ⚠️ O Shopify TRUNCA o nome do app (~30 chars) na criação. Ex: "Lever System - Respeita Esportes"
  // vira "Lever System - Respeita Esport". Buscar o nome completo NUNCA casa → cria duplicado a cada
  // run. Usar um PREFIXO (sobrevive à truncagem); has-text casa por substring.
  appCardByName: (name: string) => `a:has-text("${name.slice(0, 26)}")`,

  // Create app page (/apps/new) — card "Começar pelo Dev Dashboard"
  inputAppName: 'input[name="app_form[name]"]',
  buttonCreate: 'button[type="submit"]:has-text("Criar")',

  // Nova versão (página do app ou /versions) → form "Criar versão"
  buttonNewVersion: 'a:has-text("Nova versão"), button:has-text("Nova versão")',
  inputAppUrl: 'input[name="version[app_module_data][app_home][app_url]"]',
  textareaScopes: 'textarea[name="version[app_module_data][app_access][app_scopes]"]',
  textareaOptionalScopes: 'textarea[name="version[app_module_data][app_access][app_optional_scopes]"]',
  textareaRedirectUrls: 'textarea[name="version[app_module_data][app_access][redirect_url_allowlist]"]',
  selectWebhookApi: 'select[name="version[app_module_data][webhooks][api_version]"]',
  buttonLaunch: 'button[type="submit"]:has-text("Lançar")',

  // Configurações (/apps/{id}/settings) → bloco Credenciais
  // clientId + secret são os inputs com data-copy-to-clipboard-target="source"
  // (clientId casa hex32; secret começa com shpss_). Desambiguação por valor no código.
  credentialInputs: 'input[data-copy-to-clipboard-target="source"]',
  buttonRevealSecret: 'button[aria-label="Revelar chave secreta do cliente"]',
} as const;

export const LEVER_SYSTEM_SELECTORS = {
  // Client switcher (top-left)
  clientSwitcher: 'button:has-text("Visão Geral"), button[role="combobox"]:first-of-type',
  clientSearchInput: 'input[placeholder*="Buscar cliente"]',
  clientOptionByName: (name: string) => `[role="option"]:has-text("${name}"), text="${name}"`,

  // Sidebar
  sidebarConnections: 'text=Conexões',
  sidebarClientConfig: 'text=Configurações',

  // Connections page (cliente-scoped)
  cardShopify: 'text=ECOMMERCE ENGINE',
  inputShopifyDomain: 'input[placeholder*="myshopify"]',
  inputClientId: 'input:near(:text("CLIENT ID"))',
  inputClientSecret: 'input:near(:text("CLIENT SECRET"))',
  buttonSaveCredentials: 'button:has-text("Salvar Credenciais")',
  buttonVerify: 'button:has-text("Verificar Conexão")',
  statusConnected: 'text=CONECTADO',
  statusPending: 'text=PENDENTE',
} as const;

// Solicitar acesso à loja (collaborator request) — /stores/collaborations/new. Validado 2026-05-28.
export const COLLAB_REQUEST_SELECTORS = {
  inputStoreUrl: 'input[name="store_url"]', // digita só o handle (sufixo .myshopify.com é fixo na UI)
  inputCollabCode: 'input[name="collaborator_request_code"]', // só renderiza após domínio válido; muitas lojas EXIGEM
  buttonSelectAll: 'text=Selecionar tudo',  // marca todas as permissões de colaborador
  buttonSubmit: 'button:has-text("Solicitar acesso")',
} as const;

// Shopify Partners — tela de Distribuição (Custom) + geração do link de instalação.
// Validados 2026-05-28. Custom distribution é IRREVERSÍVEL (2 modais de confirmação).
export const PARTNERS_SELECTORS = {
  // Tela de escolha de método (só aparece se ainda não é custom)
  optionCustom: 'text=Distribuição personalizada',
  buttonSelectMethod: 'button:has-text("Selecionar")',
  buttonConfirmCustom: 'button:has-text("Selecionar distribuição personalizada")',
  // Form do link (após custom já ativo)
  inputShopDomain: 'Domínio da loja', // usado com getByLabel
  buttonGenerateLink: 'button:has-text("Gerar link")',
} as const;

// Tela de autorização/instalação OAuth do Shopify (admin/oauth/authorize ou accounts.shopify.com).
// Aparece quando o app ainda não foi instalado ou pede novos escopos. Pode auto-redirecionar
// (sem tela) se já instalado com os mesmos escopos — por isso o clique é best-effort.
export const SHOPIFY_OAUTH_SELECTORS = {
  // Botão de confirmação — vários textos possíveis (PT/EN, install/update/reauthorize)
  buttonAuthorize: [
    'button:has-text("Install")',
    'button:has-text("Instalar")',
    'button:has-text("Update app")',
    'button:has-text("Atualizar app")',
    'button:has-text("Authorize")',
    'button:has-text("Autorizar")',
    'button:has-text("Reauthorize")',
    'button:has-text("Reautorizar")',
    'button[type="submit"]',
  ].join(', '),
} as const;
