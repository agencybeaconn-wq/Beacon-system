// @ts-ignore: Deno types
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
// Utility imports (modularized code)
import { getAccessToken } from "./utils/token-recovery.ts";
import { getOpenAIMessage, getFirstToolCall, callOpenAIWithRetry } from "./utils/openai-helpers.ts";
import { processConversationHistory } from "./utils/history-sanitizer.ts";
// Consolidated system prompt (English-first)
import { getSystemPrompt } from "./prompts/system-prompt.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// @ts-ignore: Deno global
serve(instrument("lads-brain", async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // 🔥 LOGS DE RASTREAMENTO: Extrair body completo primeiro
    const body = await req.json();
    // LOG DE DEBUG DO BODY (Ação 3) - Simplificado para economizar memória
    console.log("🔥 [LADS-BRAIN] Body recebido (resumo):", JSON.stringify({
      hasMessage: !!body.message,
      hasCampaignData: !!body.campaignData,
      hasConversationHistory: !!body.conversationHistory,
      conversationHistoryLength: body.conversationHistory?.length || 0,
      hasAccountId: !!body.accountId,
      accountId: body.accountId
    }));
    const { message, campaignData, conversationHistory: rawConversationHistory, accountId, activeDraftCard, accountDefaults } = body;
    // LOG: Verificar se Draft Card ativo foi enviado
    console.log("📋 [LADS-BRAIN] Draft Card ativo recebido:", activeDraftCard);
    // --- LÓGICA DE FAXINA ROBUSTA (ADVANCED SANITIZER) ---
    // Objetivo: Garantir que NENHUMA mensagem órfã chegue na OpenAI
    // Regras:
    // 1. Remover assistant messages com tool_calls SEM respostas correspondentes
    // 2. Remover tool/function responses SEM tool_calls correspondentes
    // 3. Converter 'function' role para 'tool' role (OpenAI v1.0+ prefere 'tool')
    function sanitizeConversationHistory(rawHistory) {
      if (!Array.isArray(rawHistory) || rawHistory.length === 0) {
        return [];
      }
      console.log(`🧹 [SANITIZER] Iniciando limpeza de ${rawHistory.length} mensagens...`);
      // Passo 1: Converter 'function' → 'tool' e normalizar estrutura
      const normalized = rawHistory.filter((msg)=>msg !== null && typeof msg === 'object') // Filter nulls
      .map((msg)=>{
        if (msg.role === 'function') {
          return {
            role: 'tool',
            tool_call_id: msg.name || msg.tool_call_id || 'unknown',
            content: msg.content || ''
          };
        }
        return msg;
      });
      // Passo 2: Construir mapa de tool_call_ids esperados vs. respondidos
      const expectedToolCallIds = new Set();
      const respondedToolCallIds = new Set();
      normalized.forEach((msg)=>{
        if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
          msg.tool_calls.forEach((tc)=>{
            if (tc.id) expectedToolCallIds.add(tc.id);
          });
        }
        if (msg.role === 'tool' && msg.tool_call_id) {
          respondedToolCallIds.add(msg.tool_call_id);
        }
      });
      // Passo 3: Identificar IDs órfãos
      const orphanedCallIds = new Set([
        ...expectedToolCallIds
      ].filter((id)=>!respondedToolCallIds.has(id)));
      const orphanedResponseIds = new Set([
        ...respondedToolCallIds
      ].filter((id)=>!expectedToolCallIds.has(id)));
      if (orphanedCallIds.size > 0) {
        console.warn(`⚠️ [SANITIZER] Tool Calls órfãos detectados (sem resposta): [${Array.from(orphanedCallIds).join(', ')}]`);
      }
      if (orphanedResponseIds.size > 0) {
        console.warn(`⚠️ [SANITIZER] Tool Responses órfãs detectadas (sem chamada): [${Array.from(orphanedResponseIds).join(', ')}]`);
      }
      // Passo 4: Remover mensagens órfãs
      const cleaned = normalized.filter((msg, index)=>{
        // Remover assistant messages que contenham tool_calls órfãos
        if (msg.role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
          const hasOrphanedCall = msg.tool_calls.some((tc)=>orphanedCallIds.has(tc.id));
          if (hasOrphanedCall) {
            console.warn(`🗑️ [SANITIZER] Removendo assistant message com tool_call órfão: índice ${index}`);
            return false;
          }
        }
        // Remover tool responses órfãs
        if (msg.role === 'tool' && orphanedResponseIds.has(msg.tool_call_id)) {
          console.warn(`🗑️ [SANITIZER] Removendo tool response órfã: tool_call_id=${msg.tool_call_id}`);
          return false;
        }
        return true;
      });
      console.log(`✅ [SANITIZER] Limpeza concluída: ${rawHistory.length} → ${cleaned.length} mensagens`);
      return cleaned;
    }
    // 🔧 ROBUSTNESS: Truncate conversation history to prevent token overflow
    // Keeps first 2 messages (context) + last N messages
    function truncateHistory(history, maxMessages = 20) {
      if (!Array.isArray(history) || history.length <= maxMessages) {
        return history;
      }
      // Keep first 2 messages (usually system context) + most recent messages
      const contextMessages = history.slice(0, 2);
      const recentMessages = history.slice(-(maxMessages - 2));
      console.log(`📋 [TRUNCATE] History truncated: ${history.length} → ${contextMessages.length + recentMessages.length} messages`);
      return [
        ...contextMessages,
        ...recentMessages
      ];
    }
    // 🔧 ROBUSTNESS: Compress large tool RESPONSE content to reduce payload size
    // NOTE: We do NOT compress tool_calls arguments as that would create invalid JSON
    function compressToolCallContent(history) {
      return history.map((msg)=>{
        // Compress large tool responses (keep first 800 chars) - this is SAFE
        if (msg.role === 'tool' && msg.content && msg.content.length > 1500) {
          console.log(`🗜️ [COMPRESS] Compressing tool response: ${msg.content.length} → 800 chars`);
          return {
            ...msg,
            content: msg.content.substring(0, 800) + '\n... [RESPONSE TRUNCATED FOR CONTEXT WINDOW]'
          };
        }
        // 🚫 REMOVED: Do NOT compress tool_calls arguments - it breaks JSON structure
        // and causes the AI to fail on follow-up calls
        return msg;
      });
    }
    // Apply sanitization, truncation, and compression (using imported utility)
    let conversationHistory = processConversationHistory(rawConversationHistory || [], 25);
    // 🔥 VALIDAÇÃO CRÍTICA COM LOG: accountId é obrigatório
    console.log("🔥 [LADS-BRAIN] Account ID recebido:", accountId);
    console.log("🔥 [LADS-BRAIN] Account ID tipo:", typeof accountId);
    console.log("🔥 [LADS-BRAIN] Account ID é válido?", !!accountId && accountId !== 'null' && accountId !== 'undefined');
    if (!accountId) {
      console.error("❌ [LADS-BRAIN] CRÍTICO: Account ID não chegou no Backend. Verifique o Frontend.");
      return new Response(JSON.stringify({
        error: 'CRÍTICO: Conta não selecionada. Por favor, selecione uma conta de anúncios na página de Campanhas antes de usar o chat.'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Store accountId globally for this request (sempre do req.json, nunca da IA)
    const globalAccountId = accountId;
    console.log("✅ [LADS-BRAIN] Account ID armazenado globalmente:", globalAccountId);
    // Get OpenAI API Key from environment variables
    // @ts-ignore: Deno global
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    // Get current date in Brazil (UTC-3)
    const now = new Date();
    const brazilOffset = -3 * 60; // minutes
    const brazilDate = new Date(now.getTime() + brazilOffset * 60 * 1000);
    const todayStr = brazilDate.toISOString().split('T')[0];
    // Initialize Supabase Client
    // @ts-ignore: Deno global
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore: Deno global
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'ads'
      }
    });
    // Fetch Account Governance Settings
    let governanceContext = "";
    let accountTimezone = "America/Sao_Paulo"; // Default to Brazil timezone
    if (globalAccountId) {
      try {
        // Fetch governance settings
        const { data: settings } = await supabase.from('account_settings').select('*').eq('ad_account_id', globalAccountId).maybeSingle();
        if (settings) {
          governanceContext = `
### 🛡️ REGRAS DE GOVERNANÇA DA CONTA (PRIORIDADE MÁXIMA)
O gestor definiu regras estritas para esta conta. Você DEVE respeitá-las acima de qualquer padrão genérico.

1. **KPI PRINCIPAL (FOCO):** ${settings.primary_kpi}
   - Todas as suas análises devem girar em torno deste KPI.
   - Se for 'CPL' ou 'CPA', ignore o ROAS como métrica primária e foque no Custo.

2. **META IDEAL:** ${settings.target_value}
   - Considere "Sucesso" apenas se o ${settings.primary_kpi} estiver ${settings.primary_kpi === 'ROAS' ? 'ACIMA' : 'ABAIXO'} de ${settings.target_value}.

3. **LIMITE DE RISCO (ALERTA VERMELHO):** ${settings.risk_threshold}
   - Se o ${settings.primary_kpi} estiver ${settings.primary_kpi === 'ROAS' ? 'ABAIXO' : 'ACIMA'} de ${settings.risk_threshold}, inicie sua resposta com "🚨 **ALERTA DE RISCO CRÍTICO**".

4. **FREQUÊNCIA MÁXIMA:** ${settings.max_frequency}
   - Se a frequência ultrapassar isso, sugira troca de criativos imediatamente.
`;
          console.log("✅ [LADS-BRAIN] Regras de Governança aplicadas:", JSON.stringify(settings));
        }
        // 🌍 Fetch account timezone from ad_accounts table
        const { data: adAccountData } = await supabase.from('ad_accounts').select('timezone').eq('id', globalAccountId).maybeSingle();
        if (adAccountData?.timezone) {
          accountTimezone = adAccountData.timezone;
          console.log("🌍 [LADS-BRAIN] Timezone da conta carregado:", accountTimezone);
        } else {
          console.log("⚠️ [LADS-BRAIN] Timezone não encontrado, usando padrão:", accountTimezone);
        }
      } catch (error) {
        console.error("❌ [LADS-BRAIN] Erro ao buscar configurações da conta:", error);
      }
    }
    // 🌍 Calculate current time in the account's timezone
    const accountNow = new Date().toLocaleString('pt-BR', {
      timeZone: accountTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    console.log("🌍 [LADS-BRAIN] Horário atual no timezone da conta:", accountNow);
    // Get AI Language from request
    const aiLanguage = body.aiLanguage || 'pt-BR';
    console.log("✅ [LADS-BRAIN] Idioma da IA selecionado:", aiLanguage);
    // Build Defaults Context
    let defaultsContext = "";
    const hasPageDefault = accountDefaults?.default_page_id || accountDefaults?.facebook_page_id;
    const hasPixelDefault = accountDefaults?.default_pixel_id || accountDefaults?.pixel_id;
    const hasUrlDefault = accountDefaults?.default_domain || accountDefaults?.default_url;
    const hasInstagramDefault = accountDefaults?.default_instagram_id;
    if (accountDefaults) {
      console.log("✅ [LADS-BRAIN] Injetando padrões da conta:", JSON.stringify(accountDefaults));
      defaultsContext = `
### 🔒 PADRÕES DA CONTA (OBRIGATÓRIO - NÃO PERGUNTE)

**DADOS JÁ CONFIGURADOS - USE-OS AUTOMATICAMENTE:**
- Page_ID: ${hasPageDefault || 'NÃO DEFINIDO'}
- Pixel_ID: ${hasPixelDefault || 'NÃO DEFINIDO'}  
- Instagram_ID: ${hasInstagramDefault || 'NÃO DEFINIDO'}
- URL: ${hasUrlDefault || 'NÃO DEFINIDO'}

**🚨 REGRAS ABSOLUTAS (VIOLAÇÃO = ERRO CRÍTICO):**

1. **SE Page_ID EXISTE:** 
   - ❌ PROIBIDO chamar \`getAdIdentities\`
   - ❌ PROIBIDO perguntar "Qual página usar?"
   - ✅ Use o Page_ID automaticamente no \`propose_campaign_structure\`

2. **SE Pixel_ID EXISTE:**
   - ❌ PROIBIDO chamar \`getAccountPixels\`
   - ❌ PROIBIDO perguntar "Qual pixel usar?"
   - ✅ Use o Pixel_ID automaticamente no \`propose_campaign_structure\`

3. **SE URL EXISTE:**
   - ❌ PROIBIDO perguntar "Qual a URL de destino?"
   - ✅ Use a URL automaticamente

4. **SE Instagram_ID EXISTE:**
   - ❌ PROIBIDO perguntar "Qual Instagram usar?"
   - ✅ Use o Instagram_ID automaticamente no \`propose_campaign_structure\`
   - ⚠️ Se não tiver, use null (não invente)

5. **ÚNICO CASO ONDE PODE BUSCAR/PERGUNTAR:**
   - APENAS se o usuário EXPLICITAMENTE disser:
     - "quero usar outra página"
     - "quero usar outro pixel"
     - "quero mudar para o pixel X"
     - "use a página Y"
   - Nesse caso, E SOMENTE NESSE, pode chamar as ferramentas

5. **PROIBIÇÕES DE MENSAGEM:**
   - ❌ NUNCA escrever "[Chama getAccountPixels]" ou similar
   - ❌ NUNCA escrever "Vou buscar os pixels disponíveis..."
   - ❌ NUNCA escrever "Um momento enquanto busco..."
   - ❌ NUNCA mostrar IDs técnicos na conversa
   - ❌ NUNCA dizer "Padrões encontrados" ou "Configurações carregadas"
   
**FLUXO CORRETO:**
Se todos os padrões existem → Pule direto para pegar os textos/criativos do usuário.
`;
    } else {
      // Se não há padrões configurados, a IA precisa buscar
      defaultsContext = `
### ⚠️ PADRÕES NÃO CONFIGURADOS
Esta conta NÃO tem padrões de Página/Pixel/URL salvos.
Será necessário solicitar ao usuário ou buscar os disponíveis.
Mas NUNCA mostre mensagens técnicas como "[Chama X]" - apenas faça as perguntas naturalmente.
`;
    }
    // Generate consolidated system prompt (English-first, all rules included)
    const systemPrompt = getSystemPrompt({
      governanceContext,
      defaultsContext,
      accountTimezone,
      accountNow,
      campaignData,
      aiLanguage
    });
    // Define tools (Function Calling)
    const tools = [
      {
        type: "function",
        function: {
          name: "propose_campaign_structure",
          description: "Propõe a estrutura de uma nova campanha. USAR SMART PARSING: Extraia TODOS os dados possíveis do texto (Data, Gênero, Local) antes de chamar. Se tiver Padrões (Pixel/Page), USE-OS SILENCIOSAMENTE. Não peça o que já tem. ATENÇÃO: Se o usuário quer INTERESSES, você DEVE ter chamado 'request_interest_selection' ANTES desta tool.",
          parameters: {
            type: "object",
            properties: {
              structure: {
                type: "string",
                description: "Estrutura da campanha no formato 'X-Y-Z' onde X=campanhas, Y=conjuntos, Z=anúncios POR CONJUNTO. Exemplos: '1-1-1' (1 ad total), '1-3-1' (3 ads total), '1-3-3' (9 ads total, 3 em cada conjunto)",
                enum: [
                  "1-1-1",
                  "1-3-1",
                  "1-5-3",
                  "1-3-3",
                  "1-5-1"
                ]
              },
              objective: {
                type: "string",
                description: "Objetivo da campanha. Use PRODUCT_CATALOG_SALES para campanhas de catálogo Advantage+.",
                enum: [
                  "SALES",
                  "LEADS",
                  "TRAFFIC",
                  "ENGAGEMENT",
                  "AWARENESS",
                  "PRODUCT_CATALOG_SALES"
                ]
              },
              advantageCatalog: {
                type: "boolean",
                description: "Ativar Catálogo Advantage+. Se true, define automaticamente o objetivo como PRODUCT_CATALOG_SALES."
              },
              productCatalogId: {
                type: "string",
                description: "ID do catálogo de produtos (obtido via list_product_catalogs)."
              },
              productCatalogName: {
                type: "string",
                description: "Nome do catálogo (para exibição)."
              },
              productSetId: {
                type: "string",
                description: "ID do conjunto de produtos (opcional). Se vazio, usa todos os produtos do catálogo."
              },
              productSetName: {
                type: "string",
                description: "Nome do conjunto de produtos (para exibição)."
              },
              catalogMediaType: {
                type: "string",
                enum: [
                  "catalog_media",
                  "manual_plugin"
                ],
                description: "Tipo de mídia para campanha de catálogo. 'catalog_media' = usa imagens dos produtos automaticamente (NÃO abre seletor de criativos). 'manual_plugin' = permite escolher imagem/vídeo próprio."
              },
              catalogVariables: {
                type: "object",
                description: "Variáveis dinâmicas do catálogo para usar nos textos. Ex: { headline: '{{product.name}}', description: '{{product.current_price}}' }",
                properties: {
                  headline: {
                    type: "string",
                    description: "Variável para o título. Ex: {{product.name}}"
                  },
                  description: {
                    type: "string",
                    description: "Variável para a descrição. Ex: {{product.price}}"
                  },
                  primary_text: {
                    type: "string",
                    description: "Variável para o texto principal (opcional)"
                  }
                }
              },
              budget: {
                type: "number",
                description: "Orçamento diário em REAIS (R$). Extraia valores monetários do texto. Ex: 'R$ 100', '100 reais', '100 contos' = 100"
              },
              campaignName: {
                type: "string",
                description: "Nome da campanha. Se não fornecido, será gerado automaticamente."
              },
              start_time: {
                type: "string",
                description: "Data de início no formato ISO 8601 (YYYY-MM-DDTHH:mm:ss). Se o usuário disser 'amanhã', calcule a data para amanhã às 05:00."
              },
              budget_strategy: {
                type: "string",
                enum: [
                  "CBO",
                  "ABO"
                ],
                description: "Estratégia de orçamento. CBO = Orçamento no nível de campanha (Advantage+ Campaign Budget), Meta distribui automaticamente. ABO = Orçamento fixo em cada conjunto."
              },
              // 🔧 CAMPAIGN-LEVEL DEFAULTS - Propagate to all ads if not overridden
              page_id: {
                type: "string",
                description: "ID da Página do Facebook. OBRIGATÓRIO. Use o valor de accountDefaults.default_page_id se disponível."
              },
              destination_url: {
                type: "string",
                description: "URL de destino padrão para todos os anúncios. OBRIGATÓRIO. Use o valor de accountDefaults.default_domain se disponível."
              },
              pixel_id: {
                type: "string",
                description: "ID do Pixel para rastreamento. OBRIGATÓRIO para conversões. Use o valor de accountDefaults.default_pixel_id se disponível."
              },
              copy: {
                type: "object",
                description: "Textos padrão para todos os anúncios da campanha. Serão usados em todos os ads a menos que sejam sobrescritos.",
                properties: {
                  primary_text: {
                    type: "string",
                    description: "Texto principal (acima da mídia). Ex: 'Compre agora e ganhe desconto!'"
                  },
                  headline: {
                    type: "string",
                    description: "Título do anúncio. Ex: 'Promoção Imperdível'"
                  },
                  description: {
                    type: "string",
                    description: "Descrição do anúncio (abaixo do título). Ex: 'Frete grátis para todo o Brasil'"
                  },
                  cta_type: {
                    type: "string",
                    enum: [
                      "SHOP_NOW",
                      "LEARN_MORE",
                      "SIGN_UP",
                      "SUBSCRIBE",
                      "GET_OFFER",
                      "ORDER_NOW"
                    ],
                    description: "Botão de CTA. Padrão: SHOP_NOW"
                  }
                }
              },
              targeting: {
                type: "object",
                description: "Objeto de segmentação DETALHADO. DEVE conter 'geo_locations' formatado corretamente (countries, cities ou regions). NÃO use apenas strings simples.",
                properties: {
                  age_min: {
                    type: "number"
                  },
                  age_max: {
                    type: "number"
                  },
                  genders: {
                    type: "array",
                    items: {
                      type: "number"
                    }
                  },
                  interests: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string"
                        },
                        name: {
                          type: "string"
                        }
                      }
                    }
                  },
                  custom_audiences: {
                    type: "array",
                    items: {
                      type: "object"
                    }
                  },
                  geo_locations: {
                    type: "object",
                    description: "Estrutura de localização. Pode combinar countries, cities e regions.",
                    properties: {
                      countries: {
                        type: "array",
                        items: {
                          type: "string"
                        },
                        description: "Lista de códigos ISO (ex: ['BR'])"
                      },
                      cities: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            key: {
                              type: "string",
                              description: "Key da cidade obtida via searchMetaGeo"
                            },
                            name: {
                              type: "string",
                              description: "Nome da cidade para exibição. OBRIGATÓRIO."
                            },
                            radius: {
                              type: "number",
                              description: "Raio em km/milhas"
                            },
                            distance_unit: {
                              type: "string",
                              enum: [
                                "kilometer",
                                "mile"
                              ]
                            }
                          }
                        }
                      },
                      regions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            key: {
                              type: "string"
                            },
                            name: {
                              type: "string",
                              description: "Nome do estado/região para exibição. OBRIGATÓRIO."
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              adsets: {
                type: "array",
                description: "Lista de configurações ESPECÍFICAS para cada conjunto de anúncios. Use para criar conjuntos diferentes na mesma campanha (ex: Teste A/B de públicos).",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Nome do conjunto. Ex: 'CJ1 - Aberto', 'CJ2 - Interests'"
                    },
                    budget: {
                      type: "number",
                      description: "Orçamento diário específico deste conjunto (se ABO)."
                    },
                    optimization_goal: {
                      type: "string",
                      description: "Meta de Otimização. Varia por objetivo: SALES=OFFSITE_CONVERSIONS, LEADS=LEAD_GENERATION, TRAFFIC=LANDING_PAGE_VIEWS.",
                      enum: [
                        "OFFSITE_CONVERSIONS",
                        "LEAD_GENERATION",
                        "QUALITY_LEAD",
                        "LANDING_PAGE_VIEWS",
                        "LINK_CLICKS",
                        "IMPRESSIONS",
                        "REACH",
                        "THRUPLAY",
                        "CONVERSATIONS",
                        "POST_ENGAGEMENT",
                        "VALUE"
                      ]
                    },
                    destination_type: {
                      type: "string",
                      description: "Tipo de destino. WEBSITE=site externo (padrão), ON_AD=formulário no Facebook (para leads), MESSENGER/WHATSAPP=mensagens.",
                      enum: [
                        "WEBSITE",
                        "ON_AD",
                        "MESSENGER",
                        "WHATSAPP",
                        "INSTAGRAM_DIRECT",
                        "APP"
                      ]
                    },
                    billing_event: {
                      type: "string",
                      description: "Evento de Cobrança. Padrão: IMPRESSIONS.",
                      enum: [
                        "IMPRESSIONS",
                        "LINK_CLICKS"
                      ]
                    },
                    attribution_spec: {
                      type: "array",
                      description: "Janela de Atribuição. Ex: 7 dias clique, 1 dia visualização.",
                      items: {
                        type: "object",
                        properties: {
                          event_type: {
                            type: "string",
                            enum: [
                              "CLICK_THROUGH",
                              "VIEW_THROUGH"
                            ]
                          },
                          window_days: {
                            type: "number"
                          }
                        }
                      }
                    },
                    targeting: {
                      type: "object",
                      description: "Segmentação específica deste conjunto. OBRIGATÓRIO quando cada conjunto tem público diferente. Deve conter todos os campos relevantes.",
                      properties: {
                        audience_mode: {
                          type: "string",
                          enum: [
                            "advantage",
                            "manual"
                          ],
                          description: "Modo de público: 'advantage' = Advantage+ (público amplo, algoritmo otimiza), 'manual' = Limitar alcance (você controla idade, gênero, interesses). Padrão: advantage"
                        },
                        age_min: {
                          type: "number",
                          description: "Idade mínima do público (18-65). Em Advantage+, é idade MÍNIMA sugerida. Em Manual, é limite rígido."
                        },
                        age_max: {
                          type: "number",
                          description: "Idade máxima do público (18-65). Só usado em modo Manual."
                        },
                        genders: {
                          type: "array",
                          items: {
                            type: "number"
                          },
                          description: "Gêneros: [1] = Homens, [2] = Mulheres, [1,2] = Todos"
                        },
                        countries: {
                          type: "array",
                          items: {
                            type: "string"
                          },
                          description: "Códigos ISO de países. Ex: ['BR']"
                        },
                        interests: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: {
                                type: "string"
                              },
                              name: {
                                type: "string"
                              }
                            }
                          },
                          description: "IDs e nomes de interesses do Meta. Em Advantage+, entram como SUGESTÕES. Em Manual, entram como segmentação rígida."
                        },
                        behaviors: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: {
                                type: "string"
                              },
                              name: {
                                type: "string"
                              }
                            }
                          },
                          description: "IDs e nomes de comportamentos do Meta. Ex: [{id: '456', name: 'Compradores online'}]"
                        },
                        geo_locations: {
                          type: "array",
                          items: {
                            type: "string"
                          },
                          description: "Keys de geo-targeting obtidos via searchMetaGeo. OBRIGATÓRIO em ambos os modos."
                        },
                        custom_audiences: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: {
                                type: "string"
                              },
                              name: {
                                type: "string"
                              }
                            }
                          },
                          description: "Públicos personalizados (Custom Audiences). Obtidos via list_custom_audiences. Ex: [{id: '123456', name: 'Compradores Nov 2024'}]. NÃO confundir com interesses - use interesses para demographics e este campo para remarketing/lookalike."
                        },
                        excluded_custom_audiences: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: {
                                type: "string"
                              },
                              name: {
                                type: "string"
                              }
                            }
                          },
                          description: "Públicos personalizados a EXCLUIR. Para excluir compradores, excluir remarketing, etc."
                        },
                        rationale: {
                          type: "string",
                          description: "Explicação curta de por que este público funciona para o produto (1 frase)"
                        }
                      }
                    },
                    promoted_object: {
                      type: "object",
                      description: "Objeto promovido. OBRIGATÓRIO para conversões (SALES/LEADS com pixel). Para TRAFFIC não é necessário. Para LEADS com formulário, use page_id.",
                      properties: {
                        pixel_id: {
                          type: "string",
                          description: "ID do Pixel. Obrigatório para SALES e LEADS (website)."
                        },
                        custom_event_type: {
                          type: "string",
                          description: "Evento de conversão. SALES=PURCHASE, LEADS=LEAD.",
                          enum: [
                            "PURCHASE",
                            "LEAD",
                            "ADD_TO_CART",
                            "INITIATE_CHECKOUT",
                            "COMPLETE_REGISTRATION",
                            "CONTACT",
                            "SUBSCRIBE",
                            "ADD_PAYMENT_INFO",
                            "SEARCH",
                            "VIEW_CONTENT"
                          ]
                        },
                        page_id: {
                          type: "string",
                          description: "ID da Página do Facebook. Obrigatório para LEADS com formulário (destination_type=ON_AD)."
                        },
                        product_catalog_id: {
                          type: "string",
                          description: "ID do catálogo de produtos (para campanhas Advantage+ Catalog)"
                        },
                        product_set_id: {
                          type: "string",
                          description: "ID do conjunto de produtos (subconjunto do catálogo). Se vazio, usa todos os produtos do catálogo."
                        }
                      }
                    },
                    ads: {
                      type: "array",
                      description: "Lista de anúncios específicos deste conjunto. Use para estruturas complexas (ex: 1-3-3 com ads distintos por conjunto).",
                      items: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            description: "Nome do anúncio. Ex: 'Ad 1 - Carrossel'"
                          },
                          creative_hash: {
                            type: "string",
                            description: "Hash da IMAGEM. Use apenas para criativos de imagem."
                          },
                          video_id: {
                            type: "string",
                            description: "ID do VÍDEO no Meta. Use apenas para criativos de vídeo. NUNCA use junto com creative_hash."
                          },
                          destination_url: {
                            type: "string",
                            description: "URL de destino específica deste anúncio"
                          },
                          page_id: {
                            type: "string",
                            description: "ID da Página do Facebook vinculada ao anúncio"
                          },
                          pixel_id: {
                            type: "string",
                            description: "ID do Pixel para rastreamento no nível do anúncio. Deve corresponder ao do conjunto."
                          },
                          instagram_actor_id: {
                            type: "string",
                            description: "ID da conta do Instagram (opcional)"
                          },
                          copy: {
                            type: "object",
                            description: "Textos do anúncio",
                            properties: {
                              primary_text: {
                                type: "string",
                                description: "Texto principal (acima da imagem)"
                              },
                              headline: {
                                type: "string",
                                description: "Título do anúncio"
                              },
                              description: {
                                type: "string",
                                description: "Descrição do anúncio"
                              },
                              cta_type: {
                                type: "string",
                                enum: [
                                  "SHOP_NOW",
                                  "LEARN_MORE",
                                  "SIGN_UP",
                                  "SUBSCRIBE",
                                  "GET_OFFER",
                                  "ORDER_NOW",
                                  "CONTACT_US",
                                  "BOOK_TRAVEL",
                                  "GET_QUOTE",
                                  "APPLY_NOW",
                                  "DOWNLOAD",
                                  "SEND_MESSAGE",
                                  "WHATSAPP_MESSAGE"
                                ],
                                description: "Botão de CTA. SALES=SHOP_NOW, LEADS=SIGN_UP/GET_QUOTE/CONTACT_US, TRAFFIC=LEARN_MORE"
                              }
                            },
                            required: [
                              "primary_text",
                              "headline"
                            ]
                          }
                        },
                        required: [
                          "name",
                          "copy"
                        ]
                      }
                    }
                  }
                }
              }
            },
            required: [
              "structure",
              "objective",
              "targeting",
              "adsets",
              "budget_strategy"
            ]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "createCampaignDraft",
          description: "Cria uma estrutura hierárquica de campanha no Meta Ads. Suporta CBO e ABO. IMPORTANTE: Para ABO, coloque daily_budget em CADA adset. Para CBO, coloque daily_budget apenas na campaign.",
          parameters: {
            type: "object",
            properties: {
              budget_strategy: {
                type: "string",
                enum: [
                  "CBO",
                  "ABO"
                ],
                description: "Estratégia de orçamento. CBO = Orçamento na Campanha (Meta distribui). ABO = Orçamento fixo em cada Conjunto. OBRIGATÓRIO especificar."
              },
              pixel_id: {
                type: "string",
                description: "ID do Pixel para rastreamento. Será aplicado a TODOS os AdSets automaticamente."
              },
              campaign: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Nome da campanha"
                  },
                  objective: {
                    type: "string",
                    enum: [
                      "OUTCOME_SALES",
                      "OUTCOME_LEADS",
                      "OUTCOME_TRAFFIC",
                      "OUTCOME_ENGAGEMENT",
                      "OUTCOME_AWARENESS",
                      "PRODUCT_CATALOG_SALES"
                    ]
                  },
                  daily_budget: {
                    type: "number",
                    description: "Orçamento diário (APENAS para CBO)"
                  },
                  bid_strategy: {
                    type: "string",
                    enum: [
                      "LOWEST_COST_WITHOUT_CAP",
                      "COST_CAP",
                      "BID_CAP"
                    ]
                  },
                  special_ad_categories: {
                    type: "array",
                    items: {
                      type: "string"
                    }
                  },
                  start_time: {
                    type: "string",
                    description: "Data de início (ISO 8601)"
                  }
                },
                required: [
                  "name",
                  "objective",
                  "start_time"
                ]
              },
              adsets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string"
                    },
                    daily_budget: {
                      type: "number",
                      description: "Orçamento ABO"
                    },
                    optimization_goal: {
                      type: "string",
                      enum: [
                        "OFFSITE_CONVERSIONS",
                        "LEAD_GENERATION",
                        "QUALITY_LEAD",
                        "LANDING_PAGE_VIEWS",
                        "LINK_CLICKS",
                        "IMPRESSIONS",
                        "REACH",
                        "THRUPLAY",
                        "CONVERSATIONS",
                        "POST_ENGAGEMENT",
                        "VALUE"
                      ],
                      description: "Meta de Otimização. SALES=OFFSITE_CONVERSIONS, LEADS=LEAD_GENERATION, TRAFFIC=LANDING_PAGE_VIEWS"
                    },
                    destination_type: {
                      type: "string",
                      enum: [
                        "WEBSITE",
                        "ON_AD",
                        "MESSENGER",
                        "WHATSAPP",
                        "INSTAGRAM_DIRECT",
                        "APP"
                      ],
                      description: "Tipo de destino. WEBSITE=padrão, ON_AD=formulário, MESSENGER/WHATSAPP=mensagens"
                    },
                    promoted_object: {
                      type: "object",
                      properties: {
                        pixel_id: {
                          type: "string"
                        },
                        custom_event_type: {
                          type: "string",
                          enum: [
                            "PURCHASE",
                            "LEAD",
                            "ADD_TO_CART",
                            "INITIATE_CHECKOUT",
                            "COMPLETE_REGISTRATION",
                            "CONTACT",
                            "SUBSCRIBE"
                          ]
                        },
                        page_id: {
                          type: "string",
                          description: "ID da Página (para LEADS com formulário)"
                        },
                        product_catalog_id: {
                          type: "string"
                        },
                        product_set_id: {
                          type: "string"
                        }
                      }
                    },
                    targeting: {
                      type: "object",
                      properties: {
                        geo_locations: {
                          type: "object"
                        },
                        age_min: {
                          type: "number"
                        },
                        age_max: {
                          type: "number"
                        },
                        genders: {
                          type: "array",
                          items: {
                            type: "number"
                          }
                        },
                        interests: {
                          type: "array",
                          items: {
                            type: "object"
                          }
                        },
                        custom_audiences: {
                          type: "array",
                          items: {
                            type: "object"
                          },
                          description: "Públicos personalizados (Custom Audiences)"
                        },
                        excluded_custom_audiences: {
                          type: "array",
                          items: {
                            type: "object"
                          },
                          description: "Públicos a excluir"
                        },
                        targeting_automation: {
                          type: "object",
                          properties: {
                            advantage_audience: {
                              type: "number"
                            }
                          }
                        }
                      }
                    },
                    ads: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string"
                          },
                          creative_hash: {
                            type: "string"
                          },
                          video_id: {
                            type: "string"
                          },
                          destination_url: {
                            type: "string"
                          },
                          page_id: {
                            type: "string"
                          },
                          copy: {
                            type: "object",
                            properties: {
                              primary_text: {
                                type: "string"
                              },
                              headline: {
                                type: "string"
                              },
                              description: {
                                type: "string"
                              },
                              cta_type: {
                                type: "string",
                                enum: [
                                  "SHOP_NOW",
                                  "LEARN_MORE",
                                  "SIGN_UP",
                                  "SUBSCRIBE",
                                  "GET_OFFER",
                                  "ORDER_NOW",
                                  "CONTACT_US",
                                  "GET_QUOTE",
                                  "APPLY_NOW",
                                  "SEND_MESSAGE",
                                  "WHATSAPP_MESSAGE"
                                ]
                              }
                            },
                            required: [
                              "primary_text",
                              "headline"
                            ]
                          }
                        }
                      }
                    }
                  },
                  required: [
                    "name",
                    "ads"
                  ]
                }
              },
              structure: {
                type: "string",
                description: "Legacy"
              },
              budget: {
                type: "number",
                description: "Legacy"
              },
              campaignName: {
                type: "string",
                description: "Legacy"
              }
            },
            required: [
              "campaign",
              "adsets"
            ]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "searchMetaInterests",
          description: "Busca interesses na API do Meta Ads. Use ANTES de criar campanhas quando o usuário mencionar interesses específicos (ex: 'Futebol', 'Pizza', 'Carros'). NUNCA invente IDs - sempre busque primeiro.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Termo de busca para interesses. Ex: 'Futebol', 'Pizza', 'Tecnologia'"
              },
              accountId: {
                type: "string",
                description: "ID da conta de anúncios (opcional, será obtido automaticamente se não fornecido)"
              }
            },
            required: [
              "query"
            ]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "request_interest_selection",
          description: "🎯 USE ESTA FERRAMENTA quando o usuário mencionar interesses para segmentação. Em vez de adivinhar IDs, esta ferramenta abre um seletor interativo onde o usuário pode buscar e escolher os interesses corretos. Use sempre que o usuário disser algo como 'quero segmentar para futebol', 'interesse em carros', etc.",
          parameters: {
            type: "object",
            properties: {
              suggested_query: {
                type: "string",
                description: "Termo sugerido para pré-preencher a busca (ex: 'futebol', 'carros', 'tecnologia')"
              },
              message: {
                type: "string",
                description: "Mensagem explicativa para mostrar ao usuário (opcional)"
              }
            },
            required: [
              "suggested_query"
            ]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "searchMetaGeo",
          description: "🌍 Busca localizações (países, estados, cidades) na API do Meta. OBRIGATÓRIO chamar quando o usuário mencionar qualquer localização específica. Retorna a KEY numérica oficial que DEVE ser usada no targeting. FLUXO GLOBAL: 1) Se ambíguo (ex: 'London', 'Paris'), pergunte o país ANTES de buscar, 2) Chame esta tool com o tipo correto, 3) Se houver múltiplos resultados de países diferentes, mostre as opções ao usuário, 4) Só use a KEY confirmada no targeting.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Termo de busca da localização. NÃO adicione país automaticamente - use o nome exato que o usuário especificou após esclarecer ambiguidades. Ex: 'London', 'São Paulo', 'California', 'Tokyo'"
              },
              locationType: {
                type: "string",
                enum: [
                  "city",
                  "region",
                  "country"
                ],
                description: "Tipo de localização: 'city' para cidade, 'region' para estado/região, 'country' para país"
              }
            },
            required: [
              "query"
            ]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getAccountPixels",
          description: "Busca os Pixels disponíveis. ⛔ PROIBIDO USAR SE JÁ EXISTIR UM PIXEL PADRÃO CONFIGURADO. Se 'hasDefaults=true' foi injetado no prompt, use o ID do padrão e NÃO chame esta função. Só chame se realmente não houver nenhum pixel ou o usuário pedir explicitamente para trocar.",
          parameters: {
            type: "object",
            properties: {
              accountId: {
                type: "string",
                description: "ID da conta de anúncios (opcional)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_leadgen_forms",
          description: "📋 Lista os formulários de lead disponíveis na Página do Facebook. Use quando o usuário criar uma campanha de LEADS com destination_type = ON_AD (formulário no Facebook). Retorna lista de formulários ativos com contagem de leads.",
          parameters: {
            type: "object",
            properties: {
              pageId: {
                type: "string",
                description: "ID da Página do Facebook. Se não fornecido, usa a página padrão da conta."
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_product_catalogs",
          description: "📦 REQUIRED when user mentions: 'catalog campaign', 'catálogo', 'dynamic ads', 'DPA', 'Advantage+ catalog', 'shopping campaign', or 'product catalog sales'. Fetches available Product Catalogs with their Product Sets (subcatalogs). WORKFLOW: 1) Call this FIRST when catalog campaign is detected, 2) Show catalogs to user, 3) Ask which catalog to use, 4) Ask about product set selection, 5) Use PRODUCT_CATALOG_SALES objective with product_catalog_id.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getAdIdentities",
          description: "Busca Páginas e Instagrams. ⚠️ ATENÇÃO: NÃO USE ESTA FUNÇÃO ANTES DE CHAMAR 'getAccountDefaults'. Só use se getAccountDefaults retornar hasDefaults=false ou se o usuário rejeitar os padrões.",
          parameters: {
            type: "object",
            properties: {
              accountId: {
                type: "string",
                description: "ID da conta de anúncios (opcional)"
              },
              type_filter: {
                type: "string",
                description: "Filtrar resultados. 'page' = Só Páginas, 'instagram' = Só Instagram, 'all' = Ambos.",
                enum: [
                  "page",
                  "instagram",
                  "all"
                ]
              },
              page_id: {
                type: "string",
                description: "Filtrar Instagrams vinculados a esta página específica. Use junto com type_filter: 'instagram'."
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getAccountCreatives",
          description: "Busca imagens/vídeos na biblioteca. Use quando o usuário precisar selecionar criativos. Retorna lista. NUNCA narre 'Vou chamar getAccountCreatives', diga apenas 'Vou abrir o seletor de criativos'.",
          parameters: {
            type: "object",
            properties: {
              accountId: {
                type: "string",
                description: "ID da conta de anúncios (opcional, será obtido automaticamente se não fornecido)"
              },
              requiredCount: {
                type: "number",
                description: "Número de criativos necessários. Ex: '1-3-3' = 9. '1-1-1' = 1."
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "getAccountDefaults",
          description: "🚨 DEVE SER A PRIMEIRA FUNÇÃO A SER CHAMADA NA CRIAÇÃO DE CAMPANHA. Busca padrões (Página/Pixel) da conta. Retorna { hasDefaults: boolean, ... }. Se true, use os dados silenciosamente.",
          parameters: {
            type: "object",
            properties: {
              accountId: {
                type: "string",
                description: "ID da conta de anúncios (obrigatório)"
              }
            },
            required: [
              "accountId"
            ]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_historical_performance",
          description: "Busca dados históricos de performance de campanhas (ROAS, CPA, Spend) agregados por dia. Use quando o usuário pedir para analisar tendências, histórico ou comparar períodos. Retorna dados agregados por dia para análise de tendências.",
          parameters: {
            type: "object",
            properties: {
              accountId: {
                type: "string",
                description: "ID da conta de anúncios (obrigatório)"
              },
              campaignId: {
                type: "string",
                description: "ID da campanha específica (opcional). Se não fornecido, retorna dados de todas as campanhas da conta."
              },
              days: {
                type: "number",
                description: "Número de dias para buscar histórico. Ex: 7 (última semana), 30 (último mês). Padrão: 30"
              },
              entityType: {
                type: "string",
                description: "Tipo de entidade: 'CAMPAIGN', 'ADSET', ou 'AD'. Padrão: 'CAMPAIGN'",
                enum: [
                  "CAMPAIGN",
                  "ADSET",
                  "AD"
                ]
              },
              startDate: {
                type: "string",
                description: "Data inicial para busca (formato YYYY-MM-DD). Use para buscar períodos específicos (ex: 'ontem'). Se fornecido, 'days' é ignorado."
              },
              endDate: {
                type: "string",
                description: "Data final para busca (formato YYYY-MM-DD). Use para buscar períodos específicos. Se fornecido, 'days' é ignorado."
              }
            },
            required: [
              "accountId"
            ]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "scan_for_anomalies",
          description: "Escaneia automaticamente todas as campanhas da conta para detectar riscos e oportunidades comparando a performance de hoje com a média dos últimos 3 dias. Use PROATIVAMENTE no início de conversas ou quando o usuário pedir uma análise geral. Detecta: CPA alto, ROAS baixo, quedas de conversão (RISK) e melhorias de performance (OPPORTUNITY).",
          parameters: {
            type: "object",
            properties: {
              accountId: {
                type: "string",
                description: "ID da conta de anúncios (obrigatório)"
              }
            },
            required: [
              "accountId"
            ]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_meta_asset",
          description: "Atualiza um campo específico de uma Campanha, AdSet ou Ad no Meta Ads API. Use quando o usuário solicitar explicitamente ações de gerenciamento: pausar, ativar, alterar orçamento (daily_budget ou budget_remaining). Execute a ação DIRETAMENTE sem sugerir duplicação como fallback.",
          parameters: {
            type: "object",
            properties: {
              asset_id: {
                type: "string",
                description: "ID da entidade a ser atualizada (Campanha, AdSet ou Ad). Ex: '123456789'"
              },
              field_to_update: {
                type: "string",
                description: "Campo a ser atualizado. Valores permitidos: 'status' (ACTIVE/PAUSED), 'daily_budget' (valor em centavos), 'budget_remaining' (valor em centavos), 'name' (nome da entidade)",
                enum: [
                  "status",
                  "daily_budget",
                  "budget_remaining",
                  "name"
                ]
              },
              new_value: {
                type: "string",
                description: "Novo valor para o campo. Para status: 'ACTIVE' ou 'PAUSED'. Para budget: valor numérico como string em centavos (ex: '5000' para R$ 50). Para name: string com o novo nome."
              },
              accountId: {
                type: "string",
                description: "ID da conta de anúncios (obrigatório para buscar token se não fornecido accessToken)"
              }
            },
            required: [
              "asset_id",
              "field_to_update",
              "new_value",
              "accountId"
            ]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "updateDraftCard",
          description: "Modifica campos no Draft Card (rascunho de campanha) existente. Use quando o usuário pedir para alterar URLs, CTAs, textos, SEGMENTAÇÃO, PÁGINA DO FACEBOOK ou qualquer campo do rascunho. Também pode ADICIONAR novos conjuntos, anúncios ou textos.",
          parameters: {
            type: "object",
            properties: {
              operation: {
                type: "string",
                enum: [
                  "update_all_ads",
                  "update_specific_ad",
                  "update_all_adsets",
                  "update_specific_adset",
                  "update_campaign",
                  "copy_ad_to_all",
                  "add_adsets",
                  "add_ads",
                  "add_primary_texts"
                ],
                description: "Tipo de operação: update_all_ads (atualiza todos os anúncios), update_specific_ad (atualiza 1 anúncio), update_all_adsets (atualiza todos os conjuntos), update_specific_adset (atualiza 1 conjunto), update_campaign (atualiza a campanha), copy_ad_to_all (copia um anúncio para todos os conjuntos), add_adsets (ADICIONA N novos conjuntos), add_ads (ADICIONA N anúncios a um conjunto), add_primary_texts (ADICIONA múltiplos textos aos anúncios)"
              },
              adSetIndex: {
                type: "integer",
                description: "Índice do Conjunto de Anúncios (0-based). Ex: 'conjunto 1' = 0, 'conjunto 2' = 1"
              },
              adIndex: {
                type: "integer",
                description: "Índice do Anúncio dentro do conjunto (0-based). Ex: 'anúncio 1' = 0, 'anúncio 2' = 1"
              },
              count: {
                type: "integer",
                description: "Quantidade a adicionar (para add_adsets, add_ads, add_primary_texts). Ex: 3 para adicionar 3 conjuntos"
              },
              textsList: {
                type: "array",
                items: {
                  type: "string"
                },
                description: "Lista de textos principais (para add_primary_texts). Ex: ['Texto 1', 'Texto 2', 'Texto 3']"
              },
              fields: {
                type: "object",
                description: "Campos a serem atualizados",
                properties: {
                  destination_url: {
                    type: "string",
                    description: "URL de destino do anúncio"
                  },
                  cta_type: {
                    type: "string",
                    enum: [
                      "SHOP_NOW",
                      "LEARN_MORE",
                      "SIGN_UP",
                      "SUBSCRIBE",
                      "GET_OFFER",
                      "ORDER_NOW"
                    ],
                    description: "Botão CTA: SHOP_NOW (Comprar), LEARN_MORE (Saiba mais), SIGN_UP (Cadastre-se), etc."
                  },
                  primary_text: {
                    type: "string",
                    description: "Texto principal do anúncio (acima da imagem)"
                  },
                  headline: {
                    type: "string",
                    description: "Título do anúncio"
                  },
                  description: {
                    type: "string",
                    description: "Descrição do anúncio"
                  },
                  pixel_id: {
                    type: "string",
                    description: "ID do Pixel do Facebook"
                  },
                  url_parameters: {
                    type: "string",
                    description: "Parâmetros UTM"
                  },
                  name: {
                    type: "string",
                    description: "Nome (do anúncio, conjunto ou campanha)"
                  },
                  budget: {
                    type: "number",
                    description: "Orçamento diário em Reais (para AdSet)"
                  },
                  conversion_event: {
                    type: "string",
                    enum: [
                      "PURCHASE",
                      "ADD_TO_CART",
                      "INITIATE_CHECKOUT",
                      "LEAD",
                      "VIEW_CONTENT"
                    ],
                    description: "Evento de conversão do conjunto"
                  },
                  age_min: {
                    type: "integer",
                    description: "Idade mínima (para segmentação)"
                  },
                  age_max: {
                    type: "integer",
                    description: "Idade máxima (para segmentação)"
                  },
                  objective: {
                    type: "string",
                    description: "Objetivo da campanha"
                  },
                  page_name: {
                    type: "string",
                    description: "Nome da Página do Facebook/Instagram a ser selecionada. Ex: 'Julico Sports'"
                  }
                }
              }
            },
            required: [
              "operation",
              "fields"
            ]
          }
        }
      },
      // TOOL REMOVIDA: manage_client_goal (Causava erro de runtime)
      // ========== AUDIENCE CREATION TOOLS ==========
      {
        type: "function",
        function: {
          name: "create_website_audience",
          description: "Cria um público personalizado de SITE (Website Custom Audience) baseado em visitantes do Pixel. Use quando o usuário pedir para criar um público de remarketing, visitantes do site, ou pessoas que viram produtos. Exemplo: 'criar público de quem visitou o site nos últimos 30 dias'.",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Nome do público. Ex: 'Visitantes do site - 30 dias'"
              },
              pixelId: {
                type: "string",
                description: "ID do Pixel do Meta. Se não fornecido, usar o Pixel padrão da conta."
              },
              eventType: {
                type: "string",
                description: "Tipo de evento do Pixel. Padrão: PageView",
                enum: [
                  "PageView",
                  "Purchase",
                  "AddToCart",
                  "InitiateCheckout",
                  "Lead",
                  "CompleteRegistration",
                  "ViewContent",
                  "Search",
                  "AddPaymentInfo"
                ]
              },
              retentionDays: {
                type: "number",
                description: "Dias de retenção (1-180). Ex: 30 para visitantes dos últimos 30 dias. Padrão: 30"
              },
              urlContains: {
                type: "string",
                description: "Filtro opcional de URL. Ex: '/produto' para visitantes de páginas de produto."
              }
            },
            required: [
              "name"
            ]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_lookalike_audience",
          description: "Cria um público SEMELHANTE (Lookalike) baseado em um público existente. Use quando o usuário quiser expandir um público ou alcançar pessoas parecidas com seus clientes. ANTES de usar, chame list_custom_audiences para listar os públicos disponíveis. Exemplo: 'criar um lookalike de 1% dos compradores'.",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Nome do público. Se não fornecido, será gerado automaticamente. Ex: 'Semelhante (BR, 1%) - Compradores'"
              },
              originAudienceId: {
                type: "string",
                description: "ID do público de origem (semente). OBRIGATÓRIO. Obtenha via list_custom_audiences."
              },
              originAudienceName: {
                type: "string",
                description: "Nome do público de origem para referência e geração de nome automático."
              },
              country: {
                type: "string",
                description: "Código do país para o lookalike. Padrão: BR (Brasil)",
                enum: [
                  "BR",
                  "US",
                  "PT",
                  "MX",
                  "AR",
                  "CO",
                  "CL"
                ]
              },
              ratio: {
                type: "number",
                description: "Porcentagem de semelhança (1-10). 1% = mais similar, 10% = maior alcance. Padrão: 1"
              }
            },
            required: [
              "originAudienceId"
            ]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_custom_audiences",
          description: "Lista todos os públicos personalizados da conta. Use quando: 1) O usuário perguntar quais públicos tem disponíveis, 2) Antes de criar um lookalike para mostrar as opções de público de origem, 3) Quando precisar verificar se um público existe.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      // ========== AUTOMATION RULE TOOLS ==========
      {
        type: "function",
        function: {
          name: "create_automation_rule",
          description: "Cria uma regra de automação para campanhas, conjuntos ou anúncios. Use quando o usuário pedir para criar uma regra automática, como 'pausar se CPA passar de X', 'aumentar orçamento se ROAS > Y', etc. IMPORTANTE: ROAS só funciona com gatilho SCHEDULE (agendado), não funciona com TRIGGER (tempo real).",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Nome da regra. Ex: 'Pausar se CPA > 50'"
              },
              description: {
                type: "string",
                description: "Descrição opcional da regra."
              },
              entity_type: {
                type: "string",
                enum: [
                  "CAMPAIGN",
                  "ADSET",
                  "AD"
                ],
                description: "Tipo de entidade que a regra afeta. Padrão: ADSET"
              },
              trigger_type: {
                type: "string",
                enum: [
                  "SCHEDULE",
                  "TRIGGER"
                ],
                description: "Tipo de gatilho. SCHEDULE = verificação diária. TRIGGER = tempo real. ATENÇÃO: ROAS só funciona com SCHEDULE!"
              },
              condition_field: {
                type: "string",
                enum: [
                  "spent",
                  "cpa",
                  "cpc",
                  "ctr",
                  "website_purchase_roas",
                  "results",
                  "impressions"
                ],
                description: "Campo da condição. Ex: 'cpa' para Custo por Ação, 'spent' para Gasto, 'ctr' para Taxa de Cliques."
              },
              condition_operator: {
                type: "string",
                enum: [
                  "GREATER_THAN",
                  "LESS_THAN",
                  "EQUAL",
                  "IN_RANGE"
                ],
                description: "Operador de comparação. Ex: GREATER_THAN para 'maior que'."
              },
              condition_value: {
                type: "string",
                description: "Valor da condição. Para valores monetários (CPA, CPC, Gasto), usar valor em REAIS (ex: '50' para R$50). O sistema converte para centavos automaticamente."
              },
              action_type: {
                type: "string",
                enum: [
                  "PAUSE",
                  "UNPAUSE",
                  "NOTIFICATION",
                  "INCREASE_DAILY_BUDGET_BY",
                  "DECREASE_DAILY_BUDGET_BY",
                  "INCREASE_LIFETIME_BUDGET_BY",
                  "DECREASE_LIFETIME_BUDGET_BY",
                  "INCREASE_BID_BY",
                  "DECREASE_BID_BY"
                ],
                description: "Ação a executar. Para ANÚNCIOS: PAUSE, UNPAUSE, NOTIFICATION. Para CAMPANHAS: + orçamento (INCREASE/DECREASE_DAILY/LIFETIME_BUDGET_BY). Para CONJUNTOS: + orçamento e lance (INCREASE/DECREASE_BID_BY)."
              },
              action_value: {
                type: "string",
                description: "Valor da ação em porcentagem. Para ações de orçamento/lance: ex: '20' para +20%."
              }
            },
            required: [
              "name",
              "condition_field",
              "condition_operator",
              "condition_value",
              "action_type"
            ]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "toggle_automation_rule",
          description: "Ativa ou pausa uma regra de automação existente. Use quando o usuário pedir para pausar/ativar uma regra específica.",
          parameters: {
            type: "object",
            properties: {
              ruleId: {
                type: "string",
                description: "ID da regra a ser ativada/pausada. Obrigatório."
              },
              ruleName: {
                type: "string",
                description: "Nome da regra (para confirmação na resposta)."
              }
            },
            required: [
              "ruleId"
            ]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "delete_automation_rule",
          description: "Exclui uma regra de automação. Use quando o usuário pedir para deletar/remover uma regra. CUIDADO: ação irreversível.",
          parameters: {
            type: "object",
            properties: {
              ruleId: {
                type: "string",
                description: "ID da regra a ser excluída. Obrigatório."
              },
              ruleName: {
                type: "string",
                description: "Nome da regra (para confirmação na resposta)."
              }
            },
            required: [
              "ruleId"
            ]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_automation_rules",
          description: "Lista todas as regras de automação da conta. Use quando o usuário perguntar quais regras existem, ou antes de pausar/excluir para mostrar as opções disponíveis.",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      }
    ];
    // Build messages array for the API
    // A sanitização já foi feita no início, histórico está limpo e pronto para uso
    console.log(`📋 [LADS-BRAIN] Mensagens limpas prontas para envio: ${conversationHistory.length}`);
    // Context injection is now handled in getSystemPrompt() via defaultsContext parameter
    // 🔥 DYNAMIC TOOL STRIPPING (NOVO):
    // Se defaults existirem, remover as tools correspondentes para impedir que a IA as chame.
    let finalTools = [
      ...tools
    ];
    if (accountDefaults?.default_pixel_id) {
      console.log('🛡️ [LADS-BRAIN] Removendo tool getAccountPixels pois Pixel padrão existe.');
      finalTools = finalTools.filter((t)=>t.function.name !== 'getAccountPixels');
    }
    if (accountDefaults?.default_page_id) {
      console.log('🛡️ [LADS-BRAIN] Removendo tool getAdIdentities pois Página padrão existe.');
      finalTools = finalTools.filter((t)=>t.function.name !== 'getAdIdentities');
    }
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...conversationHistory,
      {
        role: 'user',
        content: message
      }
    ];
    // Call OpenAI API with Function Calling
    console.log('🚀 [LADS-BRAIN] Calling OpenAI API...');
    console.log('📊 [LADS-BRAIN] Messages count:', messages.length, 'Tools count:', tools.length);
    let response;
    let data;
    try {
      response = await callOpenAIWithRetry(OPENAI_API_KEY, {
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 4000,
        tools: finalTools,
        tool_choice: "auto",
        parallel_tool_calls: false
      });
      console.log('📡 [LADS-BRAIN] OpenAI response status:', response.status);
    } catch (fetchError) {
      console.error('❌ [LADS-BRAIN] Network error calling OpenAI:', fetchError.message);
      return new Response(JSON.stringify({
        type: 'text',
        response: '❌ Erro de conexão com o serviço de IA. Verifique sua conexão e tente novamente.',
        error: fetchError.message
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!response.ok) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch (e) {
        console.error('❌ [LADS-BRAIN] Could not parse OpenAI error response');
      }
      console.error('❌ [LADS-BRAIN] OpenAI API error:', response.status, JSON.stringify(errorData));
      if (response.status === 429) {
        return new Response(JSON.stringify({
          type: 'text',
          response: '⏳ Limite de requisições excedido. Aguarde alguns segundos e tente novamente.',
          error: 'rate_limit'
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({
          type: 'text',
          response: '❌ Erro de autenticação do serviço de IA. Por favor, contate o suporte.',
          error: 'auth_error'
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (response.status >= 500) {
        return new Response(JSON.stringify({
          type: 'text',
          response: '❌ O serviço de IA está temporariamente indisponível. Tente novamente em alguns instantes.',
          error: 'openai_server_error'
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      return new Response(JSON.stringify({
        type: 'text',
        response: `❌ Erro ao processar: ${errorData?.error?.message || 'Erro desconhecido'}. Tente novamente.`,
        error: errorData?.error?.message || 'unknown_error'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    try {
      data = await response.json();
      console.log('✅ [LADS-BRAIN] OpenAI response parsed successfully');
    } catch (parseError) {
      console.error('❌ [LADS-BRAIN] Error parsing OpenAI response:', parseError.message);
      return new Response(JSON.stringify({
        type: 'text',
        response: '❌ Erro ao processar resposta da IA. Tente novamente.',
        error: 'parse_error'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // GUARD CLAUSE: Usar helper function para validar resposta
    const openAIResult = getOpenAIMessage(data);
    if (!openAIResult) {
      console.error('❌ [LADS-BRAIN] getOpenAIMessage returned null - returning error to frontend');
      return new Response(JSON.stringify({
        type: 'text',
        response: '❌ Erro temporário ao processar sua mensagem. Por favor, tente novamente em alguns segundos.',
        error: 'OpenAI response validation failed'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Check if OpenAI returned an error
    if (openAIResult.error) {
      console.error('❌ [LADS-BRAIN] OpenAI returned error:', openAIResult.error);
      return new Response(JSON.stringify({
        type: 'text',
        response: `❌ Erro do serviço de IA: ${openAIResult.error}. Tente novamente.`,
        error: openAIResult.error
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const aiMessage = openAIResult.message;
    // Check if AI wants to call a function
    const toolCallResult = getFirstToolCall(aiMessage);
    if (toolCallResult) {
      const functionName = toolCallResult.name;
      const functionArgs = toolCallResult.arguments;
      // Manter referência ao toolCall original para acessar toolCall.id
      const toolCall = aiMessage.tool_calls?.[0];
      console.log("🔧 [LADS-BRAIN] ========== TOOL CALL DETECTADA ==========");
      console.log("🔧 [LADS-BRAIN] Tool chamada pela IA:", functionName);
      console.log("🔧 [LADS-BRAIN] Argumentos da tool (RAW):", JSON.stringify(functionArgs).substring(0, 500) + "..."); // Truncate logging
      // console.log("🔧 [LADS-BRAIN] Argumentos da tool (Parsed):", JSON.stringify(functionArgs, null, 2)); // Save memory
      console.log("🔧 [LADS-BRAIN] AccountId nos args da IA?", !!functionArgs.accountId);
      if (functionArgs.accountId) {
        console.log("⚠️ [LADS-BRAIN] AccountId encontrado nos args da IA (será ignorado):", functionArgs.accountId);
      }
      console.log("🔧 [LADS-BRAIN] AccountId global disponível?", !!globalAccountId);
      console.log("🔧 [LADS-BRAIN] AccountId global valor:", globalAccountId);
      console.log("🔧 [LADS-BRAIN] Verificando se functionName === 'getAccountPixels':", functionName === 'getAccountPixels');
      // Handle getAccountPixels FIRST - Fetch pixels from Meta API (PRIORITY)
      console.log(`🔍 [LADS-BRAIN] Verificando functionName: "${functionName}" === "getAccountPixels"? ${functionName === 'getAccountPixels'}`);
      if (functionName === 'getAccountPixels') {
        console.log('🎯 [LADS-BRAIN] ========== EXECUTANDO getAccountPixels ==========');
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          const finalAccountId = globalAccountId;
          if (!finalAccountId) {
            throw new Error('accountId não disponível');
          }
          console.log(`🔍 [LADS-BRAIN] Buscando pixels para conta: ${finalAccountId}`);
          // Create Supabase client to get access token
          // @ts-ignore
          const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.7.1");
          const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            db: {
              schema: 'ads'
            }
          });
          // Get auth token from request
          const authHeader = req.headers.get('Authorization');
          // Use getAccessToken helper with fallback strategy
          const accessToken = await getAccessToken(supabase, finalAccountId, authHeader);
          if (!accessToken) {
            console.error(`❌ [LADS-BRAIN] Token não encontrado para conta: ${finalAccountId}`);
            throw new Error('Token de acesso não encontrado. Verifique se a conta está conectada corretamente.');
          }
          console.log(`✅ [LADS-BRAIN] Token obtido com sucesso`);
          // Format account ID for Meta API (remove act_ prefix if present, then add it)
          const cleanAccountId = finalAccountId.replace(/^act_/i, '');
          const apiAccountId = `act_${cleanAccountId}`;
          console.log(`📡 [LADS-BRAIN] Chamando Meta API: ${apiAccountId}/adspixels`);
          // Fetch pixels from Meta API
          const pixelsResponse = await fetch(`https://graph.facebook.com/v24.0/${apiAccountId}/adspixels?fields=id,name&access_token=${accessToken}`);
          if (!pixelsResponse.ok) {
            const errorText = await pixelsResponse.text();
            console.error(`❌ [LADS-BRAIN] Erro na resposta da Meta API:`, errorText);
            throw new Error(`Erro ao buscar pixels: ${pixelsResponse.status} ${pixelsResponse.statusText}`);
          }
          const pixelsData = await pixelsResponse.json();
          if (pixelsData.error) {
            console.error(`❌ [LADS-BRAIN] Erro retornado pela Meta API:`, pixelsData.error);
            throw new Error(pixelsData.error.message || `Erro ao buscar pixels: ${pixelsData.error.type || 'Unknown error'}`);
          }
          const pixels = pixelsData.data || [];
          console.log(`✅ [LADS-BRAIN] Encontrados ${pixels.length} pixels`);
          // Format response for AI with structured data for dropdowns
          const pixelsStructured = pixels.map((p)=>({
              id: p.id,
              name: p.name || 'Pixel sem nome'
            }));
          // Return structured data for frontend to create dropdowns
          const structuredResponse = {
            type: "structured_data",
            dataType: "pixels",
            data: pixelsStructured,
            message: pixels.length > 0 ? `Encontrei ${pixels.length} ${pixels.length === 1 ? 'pixel disponível' : 'pixels disponíveis'} na sua conta. Qual você deseja usar?` : "Nenhum pixel encontrado. Você precisa criar um pixel no Gerenciador de Eventos do Facebook.",
            usage: data.usage
          };
          console.log('📦 [LADS-BRAIN] Retornando structured_data para pixels:', {
            type: structuredResponse.type,
            dataType: structuredResponse.dataType,
            dataLength: structuredResponse.data.length,
            message: structuredResponse.message
          });
          return new Response(JSON.stringify(structuredResponse), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`❌ [LADS-BRAIN] Erro ao buscar pixels:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: "Não foi possível buscar os pixels da conta. Por favor, informe o ID do pixel manualmente ou verifique suas permissões.",
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle list_leadgen_forms - Fetch lead forms from Facebook Page
      if (functionName === 'list_leadgen_forms') {
        console.log('📋 [LADS-BRAIN] ========== EXECUTANDO list_leadgen_forms ==========');
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          // Get page_id from args or use default
          const pageId = functionArgs.pageId || accountDefaults?.default_page_id || accountDefaults?.facebook_page_id;
          if (!pageId) {
            throw new Error('pageId não disponível. Confirme a página do Facebook.');
          }
          console.log(`📋 [LADS-BRAIN] Buscando formulários de lead para página: ${pageId}`);
          // Get auth header for edge function call
          const authHeader = req.headers.get('Authorization');
          // Call the list-leadgen-forms edge function
          const formsResponse = await fetch(`${supabaseUrl}/functions/v1/list-leadgen-forms`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader || `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({
              pageId,
              accountId: globalAccountId
            })
          });
          const formsData = await formsResponse.json();
          if (!formsData.success) {
            throw new Error(formsData.error || 'Erro ao buscar formulários');
          }
          const forms = formsData.forms || [];
          console.log(`✅ [LADS-BRAIN] Encontrados ${forms.length} formulários de lead`);
          // Format response for AI with structured data for dropdowns
          const formsStructured = forms.map((f)=>({
              id: f.id,
              name: f.name || 'Formulário sem nome',
              status: f.status,
              leads_count: f.leads_count || 0,
              is_active: f.is_active,
              created_time: f.created_time
            }));
          // Return structured data for frontend to create dropdowns
          const structuredResponse = {
            type: "structured_data",
            dataType: "leadgen_forms",
            data: formsStructured,
            message: forms.length > 0 ? `Encontrei ${forms.length} ${forms.length === 1 ? 'formulário de lead' : 'formulários de lead'}. Qual você deseja usar?` : "Nenhum formulário de lead encontrado. Você pode criar um no Gerenciador de Anúncios ou via API.",
            usage: data.usage
          };
          console.log('📦 [LADS-BRAIN] Retornando structured_data para formulários:', {
            type: structuredResponse.type,
            dataType: structuredResponse.dataType,
            dataLength: structuredResponse.data.length
          });
          return new Response(JSON.stringify(structuredResponse), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`❌ [LADS-BRAIN] Erro ao buscar formulários:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: "Não foi possível buscar os formulários de lead. Verifique se a página tem formulários configurados.",
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle list_product_catalogs - Fetch catalogs for Advantage+ campaigns
      if (functionName === 'list_product_catalogs') {
        console.log('🎯 [LADS-BRAIN] ========== EXECUTANDO list_product_catalogs ==========');
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          const finalAccountId = globalAccountId;
          if (!finalAccountId) {
            throw new Error('accountId não disponível');
          }
          console.log(`🔍 [LADS-BRAIN] Buscando catálogos para conta: ${finalAccountId}`);
          // Get auth header for edge function call
          const authHeader = req.headers.get('Authorization');
          // Call the get-product-catalogs edge function
          const catalogsResponse = await fetch(`${supabaseUrl}/functions/v1/get-product-catalogs`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader || `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({
              accountId: finalAccountId
            })
          });
          const catalogsData = await catalogsResponse.json();
          if (catalogsData.error) {
            throw new Error(catalogsData.error);
          }
          const catalogs = catalogsData.catalogs || [];
          console.log(`✅ [LADS-BRAIN] Encontrados ${catalogs.length} catálogos`);
          // Format response for AI with structured data for dropdowns
          const catalogsStructured = catalogs.map((c)=>({
              id: c.id,
              name: c.name || 'Catálogo sem nome',
              product_count: c.product_count || 0,
              product_sets: (c.product_sets || []).map((ps)=>({
                  id: ps.id,
                  name: ps.name || 'Conjunto sem nome',
                  product_count: ps.product_count || 0
                }))
            }));
          // Return structured data for frontend to create dropdowns
          const structuredResponse = {
            type: "structured_data",
            dataType: "product_catalogs",
            data: catalogsStructured,
            message: catalogs.length > 0 ? `Encontrei ${catalogs.length} ${catalogs.length === 1 ? 'catálogo disponível' : 'catálogos disponíveis'}. Qual você deseja usar?` : "Nenhum catálogo encontrado. Você precisa criar um catálogo no Gerenciador de Comércio do Meta.",
            usage: data.usage
          };
          console.log('📦 [LADS-BRAIN] Retornando structured_data para catálogos:', {
            type: structuredResponse.type,
            dataType: structuredResponse.dataType,
            dataLength: structuredResponse.data.length
          });
          return new Response(JSON.stringify(structuredResponse), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`❌ [LADS-BRAIN] Erro ao buscar catálogos:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: "Não foi possível buscar os catálogos da conta. Verifique se você tem catálogos configurados no Gerenciador de Comércio.",
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle search functions internally (call Edge Functions and return results to AI)
      if (functionName === 'searchMetaInterests' || functionName === 'searchMetaGeo') {
        console.log(`🔍🔍🔍 [LADS-BRAIN] ========== ENTERING searchMeta${functionName === 'searchMetaGeo' ? 'Geo' : 'Interests'} HANDLER ==========`);
        console.log(`🔍🔍🔍 [LADS-BRAIN] Query: "${functionArgs.query}", globalAccountId: "${globalAccountId}"`);
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          // Get auth token from request
          const authHeader = req.headers.get('Authorization');
          const userToken = authHeader ? authHeader.replace('Bearer ', '') : '';
          // Call the corresponding Edge Function
          const functionPath = functionName === 'searchMetaInterests' ? 'search-meta-interests' : 'search-meta-geo';
          // 🔥 INJEÇÃO DE DEPENDÊNCIA: Sempre usar accountId do req.json(), ignorar argumentos da IA
          // Não confiar que a IA vai passar accountId nos argumentos
          const finalAccountId = globalAccountId; // SEMPRE do req.json(), nunca dos argumentos da IA
          // 🆕 EXTRAIR USER_ID do token para passar no body
          let extractedUserId = null;
          if (userToken) {
            try {
              // @ts-ignore: Deno global
              const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.7.1");
              const tempSupabase = createClient(supabaseUrl, supabaseServiceKey, {
                db: {
                  schema: 'ads'
                }
              });
              const { data: { user } } = await tempSupabase.auth.getUser(userToken);
              if (user) {
                extractedUserId = user.id;
                console.log(`👤 [LADS-BRAIN] User ID extraído do token: ${extractedUserId}`);
              }
            } catch (e) {
              console.warn(`⚠️ [LADS-BRAIN] Não foi possível extrair user_id do token:`, e);
            }
          }
          console.log(`🔍 [LADS-BRAIN] Chamando ${functionPath} com query: "${functionArgs.query}"`);
          console.log(`🔍 [LADS-BRAIN] AccountId para ${functionPath}: globalAccountId="${globalAccountId}", finalAccountId="${finalAccountId}"`);
          console.log(`🔍 [LADS-BRAIN] UserId para ${functionPath}: "${extractedUserId}"`);
          // 🔥 VALIDAÇÃO CRÍTICA: Se não temos accountId, não podemos fazer a busca
          if (!finalAccountId) {
            console.error(`❌ [LADS-BRAIN] AccountId VAZIO para ${functionPath}! Não é possível buscar.`);
            return new Response(JSON.stringify({
              type: "text",
              response: "⚠️ Para buscar interesses e localizações, você precisa ter uma conta de anúncios selecionada. Por favor, vá para a página de Campanhas e selecione uma conta primeiro.",
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          let searchResponse;
          let searchData;
          try {
            searchResponse = await fetch(`${supabaseUrl}/functions/v1/${functionPath}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                ...userToken ? {
                  'x-client-info': userToken
                } : {}
              },
              body: JSON.stringify({
                query: functionArgs.query,
                accountId: finalAccountId,
                userId: extractedUserId // 🆕 Passar userId para fallback de busca de token
              })
            });
            searchData = await searchResponse.json();
            console.log(`📥 [LADS-BRAIN] Resposta de ${functionPath}:`, JSON.stringify(searchData).substring(0, 200));
          } catch (fetchError) {
            // 🔥 PROTEÇÃO: Se a busca falhar, não parar o fluxo
            console.error(`❌ [LADS-BRAIN] Erro ao chamar ${functionPath}:`, fetchError);
            console.error(`❌ [LADS-BRAIN] Stack:`, fetchError.stack);
            // Se não tivermos ID da tool call, não podemos fazer follow-up
            if (!toolCall?.id) {
              console.error("❌ [LADS-BRAIN] toolCall.id indefinido! Retornando erro simples.");
              return new Response(JSON.stringify({
                type: "text",
                response: `⚠️ Falha interna ao buscar localização/interesse. Por favor, especifique o ID ou tente novamente. (Erro: ${fetchError.message})`,
                usage: data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            // Fallback: Continuar o fluxo informando a IA sobre o erro
            const fallbackMessage = functionName === 'searchMetaGeo' ? `A busca por localização "${functionArgs.query}" falhou. Pergunte ao usuário o ID da localização.` : `A busca por interesses "${functionArgs.query}" falhou. Pergunte ao usuário IDs específicos.`;
            const followUpMessages = [
              ...messages,
              aiMessage,
              {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: fallbackMessage
              }
            ];
            const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: followUpMessages,
                temperature: 0.7,
                max_tokens: 2000,
                tools: finalTools,
                tool_choice: "auto",
                parallel_tool_calls: false
              })
            });
            const followUpData = await followUpResponse.json();
            const followUpResult = getOpenAIMessage(followUpData);
            if (!followUpResult) {
              return new Response(JSON.stringify({
                type: "text",
                response: fallbackMessage,
                usage: data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            const followUpMessage = followUpResult.message;
            const nextToolCallResult = getFirstToolCall(followUpMessage);
            if (nextToolCallResult) {
              // 🛡️ SECURITY: Never return search tools as function_call to frontend (prevents freeze)
              if (nextToolCallResult.name === 'searchMetaGeo' || nextToolCallResult.name === 'searchMetaInterests') {
                return new Response(JSON.stringify({
                  type: "text",
                  response: followUpMessage.content || `Não encontrei resultados para "${functionArgs.query}". Por favor, informe os detalhes manualmente.`,
                  usage: followUpResult.usage || data.usage
                }), {
                  status: 200,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                });
              }
              return new Response(JSON.stringify({
                type: "function_call",
                function: nextToolCallResult.name,
                arguments: nextToolCallResult.arguments,
                usage: followUpResult.usage || data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            return new Response(JSON.stringify({
              type: "text",
              response: followUpMessage.content || fallbackMessage,
              usage: followUpResult.usage || data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          if (searchData.error) {
            console.error(`❌ [LADS-BRAIN] Erro retornado por ${functionPath}:`, searchData.error);
            // Se o erro for "Access token not found", retornar mensagem mais amigável
            if (searchData.error.includes('Access token not found') || searchData.error.includes('accountId')) {
              return new Response(JSON.stringify({
                type: "text",
                response: "⚠️ Para buscar interesses e localizações, você precisa ter uma conta de anúncios selecionada. Por favor, vá para a página de Campanhas e selecione uma conta primeiro.",
                usage: data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            // 🔥 FALLBACK: Se der erro, continuar o fluxo informando a IA
            const fallbackMessage = functionName === 'searchMetaGeo' ? `A busca por localização "${functionArgs.query}" falhou: ${searchData.error}. Pergunte ao usuário o ID da localização ou tente criar a campanha sem geo específica.` : `A busca por interesses "${functionArgs.query}" falhou: ${searchData.error}. Pergunte ao usuário IDs específicos ou tente criar a campanha sem interesses específicos.`;
            const followUpMessages = [
              ...messages,
              aiMessage,
              {
                role: 'tool',
                tool_call_id: toolCall?.id || 'unknown',
                content: fallbackMessage
              }
            ];
            const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: followUpMessages,
                temperature: 0.7,
                max_tokens: 2000,
                tools: finalTools,
                tool_choice: "auto",
                parallel_tool_calls: false
              })
            });
            const followUpData = await followUpResponse.json();
            const followUpResult = getOpenAIMessage(followUpData);
            if (!followUpResult) {
              return new Response(JSON.stringify({
                type: "text",
                response: fallbackMessage,
                usage: data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            const followUpMessage = followUpResult.message;
            const nextToolCallResult = getFirstToolCall(followUpMessage);
            if (nextToolCallResult) {
              // 🛡️ SECURITY: Never return search tools as function_call to frontend (prevents freeze)
              if (nextToolCallResult.name === 'searchMetaGeo' || nextToolCallResult.name === 'searchMetaInterests') {
                return new Response(JSON.stringify({
                  type: "text",
                  response: followUpMessage.content || `Ocorreu um erro na busca por "${functionArgs.query}". Por favor, tente novamente ou informe os detalhes manualmente.`,
                  usage: followUpResult.usage || data.usage
                }), {
                  status: 200,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                });
              }
              return new Response(JSON.stringify({
                type: "function_call",
                function: nextToolCallResult.name,
                arguments: nextToolCallResult.arguments,
                usage: followUpResult.usage || data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            return new Response(JSON.stringify({
              type: "text",
              response: followUpMessage.content || fallbackMessage,
              usage: followUpResult.usage || data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Build response message with search results for AI to process (amigável)
          let searchResults;
          if (functionName === 'searchMetaInterests') {
            // 🚀 OPTIMIZATION: Return interests as structured_data for dropdown (FAST PATH)
            // This skips the second OpenAI call and shows dropdown immediately
            const interests = searchData.interests || [];
            if (interests.length > 0) {
              console.log(`✅ [LADS-BRAIN] Retornando ${interests.length} interesses como structured_data (FAST PATH)`);
              return new Response(JSON.stringify({
                type: "structured_data",
                dataType: "interests",
                data: interests.map((item)=>({
                    id: item.id,
                    name: item.name || 'Interesse'
                  })),
                message: `Encontrei ${interests.length} interesse${interests.length > 1 ? 's' : ''} para "${functionArgs.query}". Qual você deseja usar?`,
                usage: data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            } else {
              // No interests found - return text message
              return new Response(JSON.stringify({
                type: "text",
                response: `Não encontrei interesses para "${functionArgs.query}". Tente outro termo ou continue sem segmentação por interesses.`,
                usage: data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
          } else {
            // 🚀 LOCATION FOUND: Pass result to AI to continue conversation naturally
            const locations = searchData.locations || [];
            if (locations.length > 0) {
              // Auto-select the first/best result
              const selectedLocation = locations[0];
              console.log(`✅ [LADS-BRAIN] AUTO-SELECTING first location: key="${selectedLocation.key}", name="${selectedLocation.name}", type="${selectedLocation.type}"`);
              const locationType = selectedLocation.type === 'city' ? 'city' : selectedLocation.type === 'region' ? 'region' : selectedLocation.type === 'country' ? 'country' : 'location';
              // 🔧 FIX: Instead of returning technical message, pass to AI for natural continuation
              const locationInfo = `Location found: "${selectedLocation.name}" (${locationType}, key: ${selectedLocation.key}). Use this key in geo_locations when creating the campaign.`;
              // Build follow-up messages for AI to respond naturally
              const followUpMessages = [
                ...messages,
                aiMessage,
                {
                  role: 'tool',
                  tool_call_id: toolCall?.id || 'unknown',
                  name: functionName,
                  content: locationInfo
                }
              ];
              const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${OPENAI_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  model: 'gpt-4o-mini',
                  messages: followUpMessages,
                  temperature: 0.7,
                  max_tokens: 2000,
                  tools: finalTools,
                  tool_choice: "auto",
                  parallel_tool_calls: false
                })
              });
              const followUpData = await followUpResponse.json();
              const followUpResult = getOpenAIMessage(followUpData);
              if (!followUpResult) {
                // Fallback if AI doesn't respond
                return new Response(JSON.stringify({
                  type: "text",
                  response: `Perfeito! Vou usar **${selectedLocation.name}** como localização da sua campanha. Algo mais que você precisa ajustar?`,
                  _autoSelectedLocation: {
                    key: selectedLocation.key,
                    name: selectedLocation.name,
                    type: selectedLocation.type,
                    country: selectedLocation.country_name || selectedLocation.country_code || ''
                  },
                  usage: data.usage
                }), {
                  status: 200,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                });
              }
              const followUpMessage = followUpResult.message;
              // Check if AI wants to call another function (likely createCampaignDraft now)
              const nextToolCallResult = getFirstToolCall(followUpMessage);
              if (nextToolCallResult) {
                // 🛡️ SECURITY: Never return search tools as function_call to frontend
                if (nextToolCallResult.name === 'searchMetaGeo' || nextToolCallResult.name === 'searchMetaInterests') {
                  return new Response(JSON.stringify({
                    type: "text",
                    response: followUpMessage.content || `Perfeito! Vou usar **${selectedLocation.name}** como localização. Vamos continuar?`,
                    _autoSelectedLocation: {
                      key: selectedLocation.key,
                      name: selectedLocation.name,
                      type: selectedLocation.type,
                      country: selectedLocation.country_name || selectedLocation.country_code || ''
                    },
                    usage: followUpResult.usage || data.usage
                  }), {
                    status: 200,
                    headers: {
                      ...corsHeaders,
                      'Content-Type': 'application/json'
                    }
                  });
                }
                return new Response(JSON.stringify({
                  type: "function_call",
                  function: nextToolCallResult.name,
                  arguments: nextToolCallResult.arguments,
                  _autoSelectedLocation: {
                    key: selectedLocation.key,
                    name: selectedLocation.name,
                    type: selectedLocation.type,
                    country: selectedLocation.country_name || selectedLocation.country_code || ''
                  },
                  usage: followUpResult.usage || data.usage
                }), {
                  status: 200,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                });
              }
              // Return AI's natural response (no technical message)
              return new Response(JSON.stringify({
                type: "text",
                response: followUpMessage.content || `Perfeito! Vou usar **${selectedLocation.name}** como localização da sua campanha.`,
                _autoSelectedLocation: {
                  key: selectedLocation.key,
                  name: selectedLocation.name,
                  type: selectedLocation.type,
                  country: selectedLocation.country_name || selectedLocation.country_code || ''
                },
                usage: followUpResult.usage || data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            } else {
              // No locations found - return text message
              return new Response(JSON.stringify({
                type: "text",
                response: `Não encontrei localizações para "${functionArgs.query}". Tente um nome de cidade, estado ou país diferente.`,
                usage: data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
          }
          // Se não tivermos ID da tool call, não podemos fazer follow-up (only for geo now)
          if (!toolCall?.id) {
            console.error("❌ [LADS-BRAIN] toolCall.id indefinido no fluxo de sucesso! Retornando resultados como texto.");
            return new Response(JSON.stringify({
              type: "text",
              response: searchResults,
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Make a second API call to OpenAI with the search results
          const followUpMessages = [
            ...messages,
            aiMessage,
            {
              role: 'tool',
              tool_call_id: toolCall.id,
              name: functionName,
              content: searchResults
            }
          ];
          const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: followUpMessages,
              temperature: 0.7,
              max_tokens: 2000,
              tools: finalTools,
              tool_choice: "auto",
              parallel_tool_calls: false
            })
          });
          const followUpData = await followUpResponse.json();
          // GUARD CLAUSE: Usar helper function
          const followUpResult = getOpenAIMessage(followUpData);
          if (!followUpResult) {
            return new Response(JSON.stringify({
              type: "text",
              response: "Erro ao processar a resposta da IA. Por favor, tente novamente.",
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          const followUpMessage = followUpResult.message;
          // Check if AI wants to call another function (likely createCampaignDraft now)
          const nextToolCallResult = getFirstToolCall(followUpMessage);
          if (nextToolCallResult) {
            const nextFunctionName = nextToolCallResult.name;
            let nextFunctionArgs = nextToolCallResult.arguments;
            // Para outras funções, retornar normalmente
            return new Response(JSON.stringify({
              type: "function_call",
              function: nextFunctionName,
              arguments: nextFunctionArgs,
              usage: followUpData.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Return text response if AI doesn't call another function
          return new Response(JSON.stringify({
            type: "text",
            response: followUpMessage.content || "Busca realizada. Use os IDs encontrados para criar a campanha.",
            usage: followUpData.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`Error calling ${functionName}:`, error);
          // Return function call to frontend to handle error
          return new Response(JSON.stringify({
            type: "function_call",
            function: functionName,
            arguments: functionArgs,
            error: error instanceof Error ? error.message : 'Unknown error',
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle getAdIdentities - Fetch Facebook Pages and Instagram accounts
      if (functionName === 'getAdIdentities') {
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          const finalAccountId = globalAccountId;
          if (!finalAccountId) {
            throw new Error('accountId não disponível');
          }
          // 🆕 EXTRAIR USER_ID do token para passar no body
          const authHeader = req.headers.get('Authorization');
          const userToken = authHeader ? authHeader.replace('Bearer ', '') : '';
          let extractedUserId = null;
          if (userToken) {
            try {
              // @ts-ignore: Deno global
              const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.7.1");
              const tempSupabase = createClient(supabaseUrl, supabaseServiceKey, {
                db: {
                  schema: 'ads'
                }
              });
              const { data: { user } } = await tempSupabase.auth.getUser(userToken);
              if (user) {
                extractedUserId = user.id;
                console.log(`👤 [LADS-BRAIN] User ID extraído para get-ad-identities: ${extractedUserId}`);
              }
            } catch (e) {
              console.warn(`⚠️ [LADS-BRAIN] Não foi possível extrair user_id do token:`, e);
            }
          }
          console.log(`🔍 [LADS-BRAIN] Buscando identidades para conta: ${finalAccountId}`);
          // Create Supabase client
          // @ts-ignore
          const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.7.1");
          const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            db: {
              schema: 'ads'
            }
          });
          // Call get-ad-identities Edge Function with userId
          const { data: identitiesData, error: identitiesError } = await supabase.functions.invoke('get-ad-identities', {
            body: {
              accountId: finalAccountId,
              userId: extractedUserId // 🆕 Passar userId para fallback de busca de token
            }
          });
          if (identitiesError || !identitiesData?.success) {
            throw new Error(identitiesData?.error || 'Erro ao buscar identidades');
          }
          const filter = functionArgs.type_filter || 'all';
          const pageIdFilter = functionArgs.page_id; // 🔧 Filter Instagram by linked page
          const rawPages = identitiesData.pages || [];
          const rawInsta = identitiesData.instagramAccounts || [];
          const pages = filter === 'all' || filter === 'page' ? rawPages : [];
          // 🔧 FIX: Filter Instagram accounts by page_id if provided
          let instagramAccounts = filter === 'all' || filter === 'instagram' ? rawInsta : [];
          if (pageIdFilter && instagramAccounts.length > 0) {
            instagramAccounts = instagramAccounts.filter((ig)=>ig.page_id_vinculada === pageIdFilter);
            console.log(`🔍 [LADS-BRAIN] Filtrado Instagram por page_id ${pageIdFilter}: ${instagramAccounts.length} encontrados`);
          }
          console.log(`✅ [LADS-BRAIN] Filtrado: ${pages.length} páginas e ${instagramAccounts.length} contas Instagram (Filtro: ${filter})`);
          // Combine pages and Instagram accounts for structured data with PREFIXES
          const allIdentities = [
            ...pages.map((p)=>({
                id: p.id,
                name: `[Página] ${p.name || 'Sem nome'}`,
                type: 'page'
              })),
            ...instagramAccounts.map((ig)=>({
                id: ig.id,
                name: `[Instagram] ${ig.name || ig.username || 'Sem nome'}`,
                type: 'instagram'
              }))
          ];
          const message = pages.length === 0 && instagramAccounts.length === 0 ? 'Nenhuma página do Facebook ou conta do Instagram encontrada. Você precisa vincular uma página ou conta Instagram no Gerenciador de Anúncios do Facebook.' : `Encontrei ${allIdentities.length} ${allIdentities.length === 1 ? 'opção disponível' : 'opções disponíveis'}. Qual você deseja usar?`;
          // Return structured data for frontend to create dropdowns
          return new Response(JSON.stringify({
            type: "structured_data",
            dataType: "identities",
            data: allIdentities,
            message: message,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`❌ [LADS-BRAIN] Erro ao buscar identidades:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: "Não foi possível buscar as páginas e contas Instagram da conta. Por favor, informe o ID da página manualmente ou verifique suas permissões.",
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle getAccountCreatives - Fetch creatives from media library
      if (functionName === 'getAccountCreatives') {
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          const finalAccountId = globalAccountId;
          if (!finalAccountId) {
            throw new Error('accountId não disponível');
          }
          console.log(`🔍 [LADS-BRAIN] Buscando criativos para conta: ${finalAccountId}`);
          // Create Supabase client
          // @ts-ignore
          const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.7.1");
          const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            db: {
              schema: 'ads'
            }
          });
          // Get auth token from request
          const authHeader = req.headers.get('Authorization');
          // Use getAccessToken helper with fallback strategy
          const accessToken = await getAccessToken(supabase, finalAccountId, authHeader);
          if (!accessToken) {
            console.error(`❌ [LADS-BRAIN] Token não encontrado para conta: ${finalAccountId}`);
            throw new Error('Token de acesso não encontrado. Verifique se a conta está conectada corretamente.');
          }
          // Format account ID for Meta API (remove act_ prefix if present, then add it)
          const cleanAccountId = finalAccountId.replace(/^act_/i, '');
          const apiAccountId = `act_${cleanAccountId}`;
          console.log(`📡 [LADS-BRAIN] Chamando Meta API para criativos: ${apiAccountId}`);
          // Fetch ad images from Meta API
          const imagesResponse = await fetch(`https://graph.facebook.com/v24.0/${apiAccountId}/adimages?fields=id,name,hash,url,width,height&access_token=${accessToken}&limit=50`);
          const imagesData = await imagesResponse.json();
          // Fetch ad videos from Meta API
          const videosResponse = await fetch(`https://graph.facebook.com/v24.0/${apiAccountId}/advideos?fields=id,name,hash,thumbnail_url,length&access_token=${accessToken}&limit=50`);
          const videosData = await videosResponse.json();
          const images = imagesData.data || [];
          const videos = videosData.data || [];
          console.log(`✅ [LADS-BRAIN] Encontrados ${images.length} imagens e ${videos.length} vídeos`);
          // Combine images and videos for structured data
          const allCreatives = [
            ...images.slice(0, 50).map((img)=>({
                id: img.hash,
                name: `${img.name || 'Imagem sem nome'} (${img.width}x${img.height})`,
                type: 'image',
                url: img.url
              })),
            ...videos.slice(0, 50).map((vid)=>({
                id: vid.hash,
                name: `${vid.name || 'Vídeo sem nome'} (${Math.round(vid.length || 0)}s)`,
                type: 'video'
              }))
          ];
          const message = images.length === 0 && videos.length === 0 ? 'Nenhum criativo encontrado na biblioteca. Você precisa fazer upload de criativos no Gerenciador de Anúncios do Facebook.' : `Encontrei ${allCreatives.length} ${allCreatives.length === 1 ? 'criativo disponível' : 'criativos disponíveis'}. ${functionArgs.requiredCount ? `Você precisa selecionar ${functionArgs.requiredCount} ${functionArgs.requiredCount === 1 ? 'criativo' : 'criativos'} para esta campanha.` : 'Qual você deseja usar?'}`;
          // Return structured data for frontend to create wizard/dropdowns
          return new Response(JSON.stringify({
            type: "structured_data",
            dataType: "creatives",
            data: allCreatives,
            message: message,
            requiredCount: functionArgs.requiredCount || 1,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`❌ [LADS-BRAIN] Erro ao buscar criativos:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: "Não foi possível buscar os criativos da biblioteca. Por favor, informe o hash do criativo manualmente ou faça upload de um novo criativo.",
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle getAccountDefaults - Fetch default Page, Pixel, Domain for this account
      if (functionName === 'getAccountDefaults') {
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          const finalAccountId = globalAccountId || functionArgs.accountId;
          if (!finalAccountId) {
            throw new Error('accountId não disponível');
          }
          console.log(`🔍 [LADS-BRAIN] Buscando padrões da conta: ${finalAccountId}`);
          // Create Supabase client
          // @ts-ignore
          const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.7.1");
          const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            db: {
              schema: 'ads'
            }
          });
          // Fetch account settings from DB
          const { data: settings, error } = await supabase.from('account_settings').select('default_page_id, default_page_name, default_pixel_id, default_pixel_name, default_domain').eq('ad_account_id', finalAccountId).maybeSingle();
          if (error) {
            console.error(`❌ [LADS-BRAIN] Erro ao buscar padrões:`, error);
            throw error;
          }
          const hasDefaults = settings && (settings.default_page_id || settings.default_pixel_id || settings.default_domain);
          // 🔧 FIX: Always provide feedback - no silent execution
          console.log(`✅ [LADS-BRAIN] Padrões: ${JSON.stringify(settings)}`);
          // Build confirmation message based on what defaults exist
          let confirmationMessage = '';
          if (hasDefaults) {
            const defaultsList = [];
            if (settings?.default_page_id) defaultsList.push(`Página: ${settings.default_page_name || settings.default_page_id}`);
            if (settings?.default_pixel_id) defaultsList.push(`Pixel: ${settings.default_pixel_name || settings.default_pixel_id}`);
            if (settings?.default_domain) defaultsList.push(`Domínio: ${settings.default_domain}`);
            confirmationMessage = `✓ Configurações padrão da conta carregadas:\n${defaultsList.join('\n')}\n\nVou usá-las automaticamente.`;
          } else {
            confirmationMessage = 'Não há configurações padrão definidas para esta conta. Vou pedir as informações necessárias durante a criação da campanha.';
          }
          return new Response(JSON.stringify({
            type: "structured_data",
            dataType: "account_defaults",
            data: {
              page_id: settings?.default_page_id || null,
              page_name: settings?.default_page_name || null,
              pixel_id: settings?.default_pixel_id || null,
              pixel_name: settings?.default_pixel_name || null,
              domain: settings?.default_domain || null,
              hasDefaults: hasDefaults
            },
            message: confirmationMessage,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`❌ [LADS-BRAIN] Erro ao buscar padrões:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: "Não foi possível buscar os padrões da conta. Vou prosseguir perguntando os dados necessários.",
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle historical performance and anomaly detection tools
      if (functionName === 'get_historical_performance' || functionName === 'scan_for_anomalies') {
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          // Get auth token from request
          const authHeader = req.headers.get('Authorization');
          const userToken = authHeader ? authHeader.replace('Bearer ', '') : '';
          // Determine function path
          const functionPath = functionName === 'get_historical_performance' ? 'get-campaign-history' : 'scan-for-anomalies';
          // Inject accountId from global context (always from req.json(), never from AI args)
          const finalAccountId = globalAccountId || functionArgs.accountId;
          if (!finalAccountId) {
            return new Response(JSON.stringify({
              type: "text",
              response: "⚠️ Para buscar histórico ou escanear anomalias, você precisa ter uma conta de anúncios selecionada. Por favor, vá para a página de Campanhas e selecione uma conta primeiro.",
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Prepare payload
          const payload = {
            accountId: finalAccountId
          };
          if (functionName === 'get_historical_performance') {
            payload.campaignId = functionArgs.campaignId || null;
            payload.days = functionArgs.days || 7;
            payload.entityType = functionArgs.entityType || 'CAMPAIGN';
          }
          console.log(`🔍 [LADS-BRAIN] Chamando ${functionPath} com payload:`, JSON.stringify(payload));
          const analysisResponse = await fetch(`${supabaseUrl}/functions/v1/${functionPath}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userToken || supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify(payload)
          });
          const analysisData = await analysisResponse.json();
          if (analysisData.error) {
            return new Response(JSON.stringify({
              type: "text",
              response: `❌ Erro ao buscar ${functionName === 'get_historical_performance' ? 'histórico' : 'anomalias'}: ${analysisData.error}`,
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Format response for AI to process
          let toolResponseContent = '';
          if (functionName === 'get_historical_performance') {
            if (analysisData.data && analysisData.data.length > 0) {
              toolResponseContent = `Histórico de performance encontrado:\n`;
              toolResponseContent += `Período: ${analysisData.summary.days} dias\n`;
              toolResponseContent += `Total Gasto: R$ ${analysisData.summary.total_spend.toFixed(2)}\n`;
              toolResponseContent += `Total Conversões: ${analysisData.summary.total_conversions}\n`;
              toolResponseContent += `ROAS Médio: ${analysisData.summary.average_roas ? analysisData.summary.average_roas.toFixed(2) + 'x' : 'N/A'}\n`;
              toolResponseContent += `CPA Médio: R$ ${analysisData.summary.average_cpa ? analysisData.summary.average_cpa.toFixed(2) : 'N/A'}\n\n`;
              toolResponseContent += `Dados diários (últimos ${Math.min(7, analysisData.data.length)} dias):\n`;
              analysisData.data.slice(-7).forEach((day)=>{
                toolResponseContent += `${day.date}: Gasto R$ ${day.spend.toFixed(2)}, ${day.conversions} conversões, ROAS ${day.roas ? day.roas.toFixed(2) + 'x' : 'N/A'}, CPA ${day.cpa ? 'R$ ' + day.cpa.toFixed(2) : 'N/A'}\n`;
              });
            } else {
              toolResponseContent = `Nenhum dado histórico encontrado para o período solicitado.`;
            }
          } else if (functionName === 'scan_for_anomalies') {
            if (analysisData.anomalies && analysisData.anomalies.length > 0) {
              toolResponseContent = `Análise de anomalias concluída:\n`;
              toolResponseContent += `Total: ${analysisData.summary.total} anomalia(s)\n`;
              toolResponseContent += `Riscos: ${analysisData.summary.risks}\n`;
              toolResponseContent += `Oportunidades: ${analysisData.summary.opportunities}\n`;
              toolResponseContent += `Críticas: ${analysisData.summary.critical}\n\n`;
              toolResponseContent += `Detalhes:\n`;
              analysisData.anomalies.forEach((anomaly, index)=>{
                toolResponseContent += `${index + 1}. [${anomaly.type}] [${anomaly.severity}] ${anomaly.message}\n`;
              });
            } else {
              toolResponseContent = `Nenhuma anomalia detectada. Todas as campanhas estão performando dentro da normalidade.`;
            }
          }
          // Make a follow-up API call to OpenAI with the tool results
          const followUpMessages = [
            ...messages,
            aiMessage,
            {
              role: 'tool',
              tool_call_id: toolCall?.id || 'unknown',
              name: functionName,
              content: toolResponseContent || JSON.stringify(analysisData)
            },
            // 🔄 CONTINUATION INSTRUCTION: Force AI to suggest next steps
            {
              role: 'system',
              content: 'A ferramenta foi executada com sucesso. Ao responder ao usuário: 1) Confirme o resultado de forma clara e amigável, 2) OBRIGATORIAMENTE sugira 2-3 próximos passos ou pergunte como pode ajudar em seguida. NUNCA termine sem uma pergunta ou sugestão.'
            }
          ];
          const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: followUpMessages,
              temperature: 0.7,
              max_tokens: 2000,
              tools: finalTools,
              tool_choice: "auto",
              parallel_tool_calls: false
            })
          });
          const followUpData = await followUpResponse.json();
          // 🔒 GUARD: Validate follow-up response
          const followUpResult = getOpenAIMessage(followUpData);
          if (!followUpResult || !followUpResult.message) {
            console.error('❌ [LADS-BRAIN] Follow-up response invalid (searchMeta):', JSON.stringify(followUpData).substring(0, 300));
            return new Response(JSON.stringify({
              type: "text",
              response: toolResponseContent || "Busca realizada, mas não consegui gerar uma resposta. Tente novamente.",
              usage: followUpData?.usage || data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          const followUpMessage = followUpResult.message;
          // Check if AI wants to call another function (chain of tools)
          if (followUpMessage?.tool_calls && followUpMessage.tool_calls.length > 0) {
            // Return function call to frontend to handle
            const nextToolCall = followUpMessage.tool_calls[0];
            const nextFunctionName = nextToolCall.function.name;
            const nextFunctionArgs = JSON.parse(nextToolCall.function.arguments);
            return new Response(JSON.stringify({
              type: "function_call",
              function: nextFunctionName,
              arguments: nextFunctionArgs,
              usage: followUpData.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Return text response if AI doesn't call another function
          return new Response(JSON.stringify({
            type: "text",
            response: followUpMessage.content || toolResponseContent,
            usage: followUpData.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`Error calling ${functionName}:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: `❌ Erro ao processar: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Tente novamente.`,
            error: error instanceof Error ? error.message : 'Unknown error',
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle update_meta_asset tool (direct action execution)
      if (functionName === 'update_meta_asset') {
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          // Get auth token from request
          const authHeader = req.headers.get('Authorization');
          const userToken = authHeader ? authHeader.replace('Bearer ', '') : '';
          // Inject accountId from global context (always from req.json(), never from AI args)
          const finalAccountId = globalAccountId || functionArgs.accountId;
          if (!finalAccountId) {
            return new Response(JSON.stringify({
              type: "text",
              response: "⚠️ Para atualizar ativos, você precisa ter uma conta de anúncios selecionada. Por favor, vá para a página de Campanhas e selecione uma conta primeiro.",
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Prepare payload for update-meta-asset
          const payload = {
            asset_id: functionArgs.asset_id,
            field_to_update: functionArgs.field_to_update,
            new_value: functionArgs.new_value,
            accountId: finalAccountId
          };
          console.log(`🔧 [LADS-BRAIN] Chamando update-meta-asset com payload:`, JSON.stringify(payload));
          const updateResponse = await fetch(`${supabaseUrl}/functions/v1/update-meta-asset`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userToken || supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify(payload)
          });
          const updateData = await updateResponse.json();
          if (!updateData.success || updateData.error) {
            return new Response(JSON.stringify({
              type: "text",
              response: `❌ Erro ao atualizar ${functionArgs.field_to_update}: ${updateData.error || 'Erro desconhecido'}`,
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Format success response for AI to process and confirm to user
          let toolResponseContent = '';
          if (functionArgs.field_to_update === 'status') {
            toolResponseContent = `✅ Status atualizado com sucesso: ${functionArgs.asset_id} agora está ${functionArgs.new_value}.`;
          } else if (functionArgs.field_to_update === 'daily_budget' || functionArgs.field_to_update === 'budget_remaining') {
            const budgetValue = typeof functionArgs.new_value === 'number' ? (functionArgs.new_value / 100).toFixed(2) : (parseInt(functionArgs.new_value) / 100).toFixed(2);
            toolResponseContent = `✅ Orçamento atualizado com sucesso: ${functionArgs.asset_id} agora tem orçamento de R$ ${budgetValue}.`;
          } else {
            toolResponseContent = `✅ Campo ${functionArgs.field_to_update} atualizado com sucesso para ${functionArgs.asset_id}.`;
          }
          // Send tool response back to AI for follow-up conversation
          const followUpMessages = [
            ...messages,
            aiMessage,
            {
              role: 'tool',
              tool_call_id: toolCall?.id || 'unknown',
              content: toolResponseContent
            }
          ];
          const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: followUpMessages,
              temperature: 0.7,
              max_tokens: 2000,
              tools: finalTools,
              tool_choice: "auto",
              parallel_tool_calls: false
            })
          });
          const followUpData = await followUpResponse.json();
          // GUARD CLAUSE: Usar helper function
          const followUpResult = getOpenAIMessage(followUpData);
          if (!followUpResult) {
            return new Response(JSON.stringify({
              type: "text",
              response: toolResponseContent || "Erro ao processar a resposta da IA. Por favor, tente novamente.",
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          const followUpMessage = followUpResult.message;
          // Return text response with AI's confirmation
          return new Response(JSON.stringify({
            type: "text",
            response: followUpMessage.content || toolResponseContent,
            usage: followUpResult.usage || followUpData.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`Error calling ${functionName}:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: `❌ Erro ao atualizar ativo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // ========== AUDIENCE CREATION TOOL HANDLERS ==========
      // Handle create_website_audience tool
      if (functionName === 'create_website_audience') {
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          const authHeader = req.headers.get('Authorization');
          const userToken = authHeader ? authHeader.replace('Bearer ', '') : '';
          const finalAccountId = globalAccountId || functionArgs.accountId;
          if (!finalAccountId) {
            return new Response(JSON.stringify({
              type: "text",
              response: "⚠️ Para criar públicos, você precisa ter uma conta de anúncios selecionada.",
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Get access token
          const token = await getAccessToken(supabase, finalAccountId, authHeader);
          if (!token) {
            return new Response(JSON.stringify({
              type: "text",
              response: "⚠️ Não foi possível obter o token de acesso da conta.",
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Use default pixel if not provided
          const pixelId = functionArgs.pixelId || accountDefaults?.default_pixel_id;
          if (!pixelId) {
            return new Response(JSON.stringify({
              type: "text",
              response: "⚠️ Nenhum Pixel foi especificado e não há Pixel padrão configurado. Por favor, informe o ID do Pixel.",
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          const payload = {
            action: 'CREATE_WEBSITE',
            accountId: finalAccountId,
            accessToken: token,
            name: functionArgs.name,
            pixelId: pixelId,
            retentionDays: functionArgs.retentionDays || 30,
            eventType: functionArgs.eventType || 'PageView',
            urlContains: functionArgs.urlContains
          };
          console.log(`📊 [LADS-BRAIN] Criando público de site:`, JSON.stringify(payload));
          const audienceResponse = await fetch(`${supabaseUrl}/functions/v1/manage-custom-audiences`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userToken || supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify(payload)
          });
          const audienceData = await audienceResponse.json();
          let toolResponseContent = '';
          if (audienceData.error) {
            toolResponseContent = `❌ Erro ao criar público: ${audienceData.error}`;
          } else {
            toolResponseContent = `✅ **Público de site criado com sucesso!**\n\n📊 **${audienceData.audience.name}** (ID: ${audienceData.audience.id})\n\n⏳ O público levará de 1 a 6 horas para ser preenchido com os visitantes do seu site.`;
          }
          // Send tool response back to AI
          const followUpMessages = [
            ...messages,
            aiMessage,
            {
              role: 'tool',
              tool_call_id: toolCall?.id || 'unknown',
              content: toolResponseContent
            }
          ];
          const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: followUpMessages,
              temperature: 0.7,
              max_tokens: 2000,
              tools: finalTools,
              tool_choice: "auto",
              parallel_tool_calls: false
            })
          });
          const followUpData = await followUpResponse.json();
          const followUpResult = getOpenAIMessage(followUpData);
          return new Response(JSON.stringify({
            type: "text",
            response: followUpResult?.message?.content || toolResponseContent,
            usage: followUpResult?.usage || followUpData.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`Error in create_website_audience:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: `❌ Erro ao criar público de site: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle create_lookalike_audience tool
      if (functionName === 'create_lookalike_audience') {
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          const authHeader = req.headers.get('Authorization');
          const userToken = authHeader ? authHeader.replace('Bearer ', '') : '';
          const finalAccountId = globalAccountId || functionArgs.accountId;
          if (!finalAccountId) {
            return new Response(JSON.stringify({
              type: "text",
              response: "⚠️ Para criar públicos, você precisa ter uma conta de anúncios selecionada.",
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Get access token
          const token = await getAccessToken(supabase, finalAccountId, authHeader);
          if (!token) {
            return new Response(JSON.stringify({
              type: "text",
              response: "⚠️ Não foi possível obter o token de acesso da conta.",
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Generate name if not provided
          const ratio = functionArgs.ratio || 1;
          const country = functionArgs.country || 'BR';
          const audienceName = functionArgs.name || `Semelhante (${country}, ${ratio}%) - ${functionArgs.originAudienceName || 'Origem'}`;
          const payload = {
            action: 'CREATE_LOOKALIKE',
            accountId: finalAccountId,
            accessToken: token,
            name: audienceName,
            originAudienceId: functionArgs.originAudienceId,
            ratio: ratio / 100,
            country: country
          };
          console.log(`📊 [LADS-BRAIN] Criando público semelhante:`, JSON.stringify(payload));
          const audienceResponse = await fetch(`${supabaseUrl}/functions/v1/manage-custom-audiences`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userToken || supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify(payload)
          });
          const audienceData = await audienceResponse.json();
          let toolResponseContent = '';
          if (audienceData.error) {
            toolResponseContent = `❌ Erro ao criar público semelhante: ${audienceData.error}`;
          } else {
            toolResponseContent = `✅ **Público semelhante criado com sucesso!**\n\n📊 **${audienceData.audience.name}** (ID: ${audienceData.audience.id})\n\n🎯 Tamanho: ${ratio}% da população do ${country === 'BR' ? 'Brasil' : country}\n\n⏳ O público levará de 1 a 24 horas para ser preenchido.`;
          }
          // Send tool response back to AI
          const followUpMessages = [
            ...messages,
            aiMessage,
            {
              role: 'tool',
              tool_call_id: toolCall?.id || 'unknown',
              content: toolResponseContent
            }
          ];
          const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: followUpMessages,
              temperature: 0.7,
              max_tokens: 2000,
              tools: finalTools,
              tool_choice: "auto",
              parallel_tool_calls: false
            })
          });
          const followUpData = await followUpResponse.json();
          const followUpResult = getOpenAIMessage(followUpData);
          return new Response(JSON.stringify({
            type: "text",
            response: followUpResult?.message?.content || toolResponseContent,
            usage: followUpResult?.usage || followUpData.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`Error in create_lookalike_audience:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: `❌ Erro ao criar público semelhante: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle list_custom_audiences tool
      if (functionName === 'list_custom_audiences') {
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          const authHeader = req.headers.get('Authorization');
          const userToken = authHeader ? authHeader.replace('Bearer ', '') : '';
          const finalAccountId = globalAccountId || functionArgs.accountId;
          if (!finalAccountId) {
            return new Response(JSON.stringify({
              type: "text",
              response: "⚠️ Para listar públicos, você precisa ter uma conta de anúncios selecionada.",
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Get access token
          const token = await getAccessToken(supabase, finalAccountId, authHeader);
          if (!token) {
            return new Response(JSON.stringify({
              type: "text",
              response: "⚠️ Não foi possível obter o token de acesso da conta.",
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          const payload = {
            action: 'LIST',
            accountId: finalAccountId,
            accessToken: token
          };
          console.log(`📊 [LADS-BRAIN] Listando públicos personalizados`);
          const audienceResponse = await fetch(`${supabaseUrl}/functions/v1/manage-custom-audiences`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userToken || supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify(payload)
          });
          const audienceData = await audienceResponse.json();
          let toolResponseContent = '';
          if (audienceData.error) {
            toolResponseContent = `❌ Erro ao listar públicos: ${audienceData.error}`;
          } else if (!audienceData.audiences || audienceData.audiences.length === 0) {
            toolResponseContent = `📭 Nenhum público personalizado encontrado nesta conta. Você pode criar um público de site ou lookalike usando os comandos de criação.`;
          } else {
            const audienceList = audienceData.audiences.slice(0, 15) // Limit to 15 for readability
            .map((a)=>`• **${a.name}** (${a.subtype || 'CUSTOM'}) - ID: ${a.id}`).join('\n');
            toolResponseContent = `📊 **Públicos disponíveis (${audienceData.audiences.length} total):**\n\n${audienceList}${audienceData.audiences.length > 15 ? `\n\n... e mais ${audienceData.audiences.length - 15} públicos.` : ''}`;
          }
          // Send tool response back to AI
          const followUpMessages = [
            ...messages,
            aiMessage,
            {
              role: 'tool',
              tool_call_id: toolCall?.id || 'unknown',
              content: toolResponseContent
            }
          ];
          const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: followUpMessages,
              temperature: 0.7,
              max_tokens: 1500,
              tools: tools,
              tool_choice: "auto",
              parallel_tool_calls: false
            })
          });
          const followUpData = await followUpResponse.json();
          const followUpResult = getOpenAIMessage(followUpData);
          return new Response(JSON.stringify({
            type: "text",
            response: followUpResult?.message?.content || toolResponseContent,
            usage: followUpResult?.usage || followUpData.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`Error in list_custom_audiences:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: `❌ Erro ao listar públicos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // ========== AUTOMATION RULE HANDLERS ==========
      // Handle list_automation_rules tool
      if (functionName === 'list_automation_rules') {
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          const authHeader = req.headers.get('Authorization');
          const userToken = authHeader ? authHeader.replace('Bearer ', '') : '';
          const finalAccountId = globalAccountId || functionArgs.accountId;
          const ruleResponse = await fetch(`${supabaseUrl}/functions/v1/manage-ad-rules`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userToken || supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({
              action: 'READ_ALL',
              accountId: finalAccountId
            })
          });
          const ruleData = await ruleResponse.json();
          let toolResponseContent = '';
          if (ruleData.error) {
            toolResponseContent = `❌ Erro ao listar regras: ${ruleData.error}`;
          } else if (!ruleData.rules || ruleData.rules.length === 0) {
            toolResponseContent = `📭 Nenhuma regra de automação encontrada. O usuário pode criar uma nova usando comandos como "criar regra para pausar se CPA > 50".`;
          } else {
            const ruleList = ruleData.rules.slice(0, 10).map((r)=>`• **${r.name}** (${r.status}) - Ação: ${r.action_type} | ID: ${r.id}`).join('\n');
            toolResponseContent = `⚡ **Regras de automação (${ruleData.rules.length} total):**\n\n${ruleList}`;
          }
          const followUpMessages = [
            ...messages,
            aiMessage,
            {
              role: 'tool',
              tool_call_id: toolCall?.id || 'unknown',
              content: toolResponseContent
            }
          ];
          const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: followUpMessages,
              temperature: 0.7,
              max_tokens: 2000,
              tools: tools,
              tool_choice: "auto",
              parallel_tool_calls: false
            })
          });
          const followUpData = await followUpResponse.json();
          const followUpResult = getOpenAIMessage(followUpData);
          return new Response(JSON.stringify({
            type: "text",
            response: followUpResult?.message?.content || toolResponseContent,
            usage: followUpResult?.usage || followUpData.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`Error in list_automation_rules:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: `❌ Erro ao listar regras: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle create_automation_rule tool
      if (functionName === 'create_automation_rule') {
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          const authHeader = req.headers.get('Authorization');
          const userToken = authHeader ? authHeader.replace('Bearer ', '') : '';
          const finalAccountId = globalAccountId || functionArgs.accountId;
          const token = await getAccessToken(supabase, finalAccountId, authHeader);
          // Get workspaceId from ad_accounts table
          const { data: accountData } = await supabase.from('ad_accounts').select('workspace_id').eq('id', finalAccountId).single();
          const workspaceId = accountData?.workspace_id;
          if (!workspaceId || !finalAccountId) {
            return new Response(JSON.stringify({
              type: "text",
              response: "⚠️ Conta ou workspace não encontrados.",
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Build evaluation_spec - IMPORTANT: Don't duplicate condition field
          const currencyFields = [
            "spent",
            "cpa",
            "cpc"
          ];
          const numValue = parseFloat(functionArgs.condition_value);
          const conditionValue = !isNaN(numValue) && currencyFields.includes(functionArgs.condition_field) ? Math.round(numValue * 100) // Convert to centavos
           : numValue || functionArgs.condition_value;
          // Base filters (common to both TRIGGER and SCHEDULE)
          const baseFilters = [
            {
              field: "entity_type",
              value: [
                functionArgs.entity_type || "ADSET"
              ],
              operator: "IN"
            },
            {
              field: "time_preset",
              value: "LAST_7_DAYS",
              operator: "EQUAL"
            },
            {
              field: "effective_status",
              value: [
                "ACTIVE"
              ],
              operator: "IN"
            }
          ];
          const evaluation_spec = {
            evaluation_type: functionArgs.trigger_type || "SCHEDULE",
            filters: [
              ...baseFilters
            ]
          };
          // For TRIGGER: condition goes in the trigger object, NOT in filters
          // For SCHEDULE: condition goes in the filters array
          if (functionArgs.trigger_type === "TRIGGER") {
            evaluation_spec.trigger = {
              type: "STATS_CHANGE",
              field: functionArgs.condition_field,
              value: conditionValue,
              operator: functionArgs.condition_operator
            };
          } else {
            // SCHEDULE type - add condition to filters
            evaluation_spec.filters.push({
              field: functionArgs.condition_field,
              value: conditionValue,
              operator: functionArgs.condition_operator
            });
          }
          // Build execution_spec based on action type
          const execution_spec = {
            execution_type: functionArgs.action_type
          };
          // Actions that require execution_options with change_spec
          const budgetActions = [
            "INCREASE_DAILY_BUDGET_BY",
            "DECREASE_DAILY_BUDGET_BY",
            "INCREASE_LIFETIME_BUDGET_BY",
            "DECREASE_LIFETIME_BUDGET_BY",
            "CHANGE_BUDGET",
            "CHANGE_CAMPAIGN_BUDGET"
          ];
          const bidActions = [
            "INCREASE_BID_BY",
            "DECREASE_BID_BY"
          ];
          if ((budgetActions.includes(functionArgs.action_type) || bidActions.includes(functionArgs.action_type)) && functionArgs.action_value) {
            let amount = parseFloat(functionArgs.action_value);
            // Ensure correct sign for DECREASE actions
            if (functionArgs.action_type.includes("DECREASE") && amount > 0) {
              amount = -Math.abs(amount);
            } else if (functionArgs.action_type.includes("INCREASE") && amount < 0) {
              amount = Math.abs(amount);
            }
            execution_spec.execution_options = [
              {
                field: "change_spec",
                value: {
                  amount: amount,
                  unit: "PERCENTAGE"
                },
                operator: "EQUAL"
              }
            ];
          }
          const ruleData = {
            name: functionArgs.name,
            description: functionArgs.description || null,
            rule_type: "META",
            trigger_type: functionArgs.trigger_type || "SCHEDULE",
            entity_type: functionArgs.entity_type || "ADSET",
            condition_field: functionArgs.condition_field,
            condition_operator: functionArgs.condition_operator,
            condition_value: functionArgs.condition_value,
            action_type: functionArgs.action_type,
            action_value: functionArgs.action_value || null,
            evaluation_spec,
            execution_spec,
            schedule_spec: {
              schedule_type: "DAILY"
            }
          };
          const ruleResponse = await fetch(`${supabaseUrl}/functions/v1/manage-ad-rules`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userToken || supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({
              action: 'CREATE',
              ruleData,
              accountId: finalAccountId,
              workspaceId,
              accessToken: token
            })
          });
          const result = await ruleResponse.json();
          let toolResponseContent = '';
          if (result.error) {
            toolResponseContent = `❌ Erro ao criar regra: ${result.error}`;
          } else {
            toolResponseContent = `✅ **Regra "${functionArgs.name}" criada com sucesso!**\n\n📊 **Condição:** ${functionArgs.condition_field} ${functionArgs.condition_operator} ${functionArgs.condition_value}\n⚡ **Ação:** ${functionArgs.action_type}${functionArgs.action_value ? ` (${functionArgs.action_value}%)` : ''}\n📅 **Gatilho:** ${functionArgs.trigger_type === 'TRIGGER' ? 'Tempo Real' : 'Agendado (Diário)'}`;
          }
          const followUpMessages = [
            ...messages,
            aiMessage,
            {
              role: 'tool',
              tool_call_id: toolCall?.id || 'unknown',
              content: toolResponseContent
            }
          ];
          const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: followUpMessages,
              temperature: 0.7,
              max_tokens: 2000,
              tools: tools,
              tool_choice: "auto",
              parallel_tool_calls: false
            })
          });
          const followUpData = await followUpResponse.json();
          const followUpResult = getOpenAIMessage(followUpData);
          return new Response(JSON.stringify({
            type: "text",
            response: followUpResult?.message?.content || toolResponseContent,
            usage: followUpResult?.usage || followUpData.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`Error in create_automation_rule:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: `❌ Erro ao criar regra: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle toggle_automation_rule tool
      if (functionName === 'toggle_automation_rule') {
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          const authHeader = req.headers.get('Authorization');
          const userToken = authHeader ? authHeader.replace('Bearer ', '') : '';
          const token = await getAccessToken(supabase, globalAccountId, authHeader);
          const ruleResponse = await fetch(`${supabaseUrl}/functions/v1/manage-ad-rules`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userToken || supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({
              action: 'TOGGLE',
              ruleId: functionArgs.ruleId,
              accessToken: token
            })
          });
          const result = await ruleResponse.json();
          let toolResponseContent = '';
          if (result.error) {
            toolResponseContent = `❌ Erro ao alterar regra: ${result.error}`;
          } else {
            const newStatus = result.rule?.status === 'ACTIVE' ? 'ativada' : 'pausada';
            toolResponseContent = `✅ **Regra "${functionArgs.ruleName || result.rule?.name || 'ID: ' + functionArgs.ruleId}" ${newStatus} com sucesso!**`;
          }
          const followUpMessages = [
            ...messages,
            aiMessage,
            {
              role: 'tool',
              tool_call_id: toolCall?.id || 'unknown',
              content: toolResponseContent
            }
          ];
          const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: followUpMessages,
              temperature: 0.7,
              max_tokens: 2000,
              tools: tools,
              tool_choice: "auto",
              parallel_tool_calls: false
            })
          });
          const followUpData = await followUpResponse.json();
          const followUpResult = getOpenAIMessage(followUpData);
          return new Response(JSON.stringify({
            type: "text",
            response: followUpResult?.message?.content || toolResponseContent,
            usage: followUpResult?.usage || followUpData.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`Error in toggle_automation_rule:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: `❌ Erro ao alterar regra: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle delete_automation_rule tool
      if (functionName === 'delete_automation_rule') {
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          const authHeader = req.headers.get('Authorization');
          const userToken = authHeader ? authHeader.replace('Bearer ', '') : '';
          const token = await getAccessToken(supabase, globalAccountId, authHeader);
          const ruleResponse = await fetch(`${supabaseUrl}/functions/v1/manage-ad-rules`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userToken || supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({
              action: 'DELETE',
              ruleId: functionArgs.ruleId,
              accessToken: token
            })
          });
          const result = await ruleResponse.json();
          let toolResponseContent = '';
          if (result.error) {
            toolResponseContent = `❌ Erro ao excluir regra: ${result.error}`;
          } else {
            toolResponseContent = `🗑️ **Regra "${functionArgs.ruleName || 'ID: ' + functionArgs.ruleId}" excluída com sucesso!**`;
          }
          const followUpMessages = [
            ...messages,
            aiMessage,
            {
              role: 'tool',
              tool_call_id: toolCall?.id || 'unknown',
              content: toolResponseContent
            }
          ];
          const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: followUpMessages,
              temperature: 0.7,
              max_tokens: 2000,
              tools: tools,
              tool_choice: "auto",
              parallel_tool_calls: false
            })
          });
          const followUpData = await followUpResponse.json();
          const followUpResult = getOpenAIMessage(followUpData);
          return new Response(JSON.stringify({
            type: "text",
            response: followUpResult?.message?.content || toolResponseContent,
            usage: followUpResult?.usage || followUpData.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`Error in delete_automation_rule:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: `❌ Erro ao excluir regra: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle get_ad_account_identities tool
      if (functionName === 'get_ad_account_identities') {
        try {
          const authHeader = req.headers.get('Authorization');
          const finalAccountId = globalAccountId || functionArgs.accountId;
          console.log(`🆔 [LADS-BRAIN] Buscando identidades para conta: ${finalAccountId}`);
          const token = await getAccessToken(supabase, finalAccountId, authHeader);
          if (!token) {
            throw new Error("Token de acesso não encontrado. Por favor, reconecte sua conta do Facebook.");
          }
          // 1. Buscar Páginas
          const pagesUrl = `https://graph.facebook.com/v24.0/${finalAccountId.replace('act_', '')}/promotable_page_ids?access_token=${token}`;
          const pagesResponse = await fetch(pagesUrl);
          const pagesData = await pagesResponse.json();
          if (pagesData.error) {
            throw new Error(`Erro Meta (Pages): ${pagesData.error.message}`);
          }
          // Para cada ID de página, buscar o nome e detalhes
          const pageIds = pagesData.data || [];
          const pagesDetails = await Promise.all(pageIds.map(async (p)=>{
            const detailsUrl = `https://graph.facebook.com/v24.0/${p.id}?fields=name,username,picture&access_token=${token}`;
            const r = await fetch(detailsUrl);
            const d = await r.json();
            return {
              id: d.id,
              name: d.name,
              type: 'PAGE'
            };
          }));
          // 2. Buscar Instagram Accounts
          const instaUrl = `https://graph.facebook.com/v24.0/${finalAccountId.replace('act_', '')}/instagram_accounts?fields=id,username,profile_pic&access_token=${token}`;
          const instaResponse = await fetch(instaUrl);
          const instaData = await instaResponse.json();
          if (instaData.error) {
            console.warn(`⚠️ [LADS-BRAIN] Erro ao buscar Instagram: ${instaData.error.message}`);
          }
          const instagrams = (instaData.data || []).map((i)=>({
              id: i.id,
              name: i.username,
              type: 'INSTAGRAM'
            }));
          const identities = [
            ...pagesDetails,
            ...instagrams
          ];
          const toolResponseContent = JSON.stringify({
            success: true,
            identities: identities,
            count: identities.length,
            message: identities.length > 0 ? `Encontrei ${pagesDetails.length} Páginas e ${instagrams.length} Contas do Instagram.` : "⚠️ Encontrei 0 páginas. Verifique se o seu token tem permissão de 'pages_show_list' ou se você é admin da página."
          });
          // Send tool response back to AI
          const followUpMessages = [
            ...messages,
            aiMessage,
            {
              role: 'tool',
              tool_call_id: toolCall?.id || 'unknown',
              content: toolResponseContent
            }
          ];
          const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: followUpMessages,
              temperature: 0.7,
              max_tokens: 2000,
              tools: finalTools,
              tool_choice: "auto",
              parallel_tool_calls: false
            })
          });
          const followUpData = await followUpResponse.json();
          const followUpResult = getOpenAIMessage(followUpData);
          if (!followUpResult) {
            return new Response(JSON.stringify({
              type: "text",
              response: "Erro ao processar identidades."
            }), {
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          return new Response(JSON.stringify({
            type: "text",
            response: followUpResult.message.content,
            usage: followUpResult.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error(`Error calling get_ad_account_identities:`, error);
          return new Response(JSON.stringify({
            type: "text",
            response: `❌ Erro ao buscar identidades: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle manage_client_goal tool (contextualize analysis with client goals)
      if (functionName === 'manage_client_goal') {
        try {
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          // Get auth token from request
          const authHeader = req.headers.get('Authorization');
          const userToken = authHeader ? authHeader.replace('Bearer ', '') : '';
          // Meta é GLOBAL POR USUÁRIO (não precisa de account_id)
          // Prepare payload for manage-client-goal (account_id é opcional agora)
          const payload = {
            metric: functionArgs.metric,
            action: functionArgs.action
          };
          // account_id é opcional (mantido apenas para compatibilidade, mas não usado na busca)
          if (functionArgs.account_id || globalAccountId) {
            payload.account_id = functionArgs.account_id || globalAccountId;
          }
          if (functionArgs.action === 'SET' && functionArgs.target_value !== undefined) {
            payload.target_value = functionArgs.target_value;
          }
          console.log(`🎯 [LADS-BRAIN] Chamando manage-client-goal com payload:`, JSON.stringify(payload));
          const goalResponse = await fetch(`${supabaseUrl}/functions/v1/manage-client-goal`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userToken || supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify(payload)
          });
          // VERIFICAÇÃO DE STATUS HTTP: Garantir que a resposta é válida
          if (!goalResponse.ok) {
            console.error(`❌ [LADS-BRAIN] manage-client-goal retornou status ${goalResponse.status}`);
            // Continuar com fallback ao invés de quebrar (SILENCIOSO)
            const defaultFallback = 3.0;
            const toolResponseContent = `Meta ${functionArgs.metric} não pôde ser consultada (erro do servidor). Usando valor padrão de ${defaultFallback}${functionArgs.metric === 'target_roas' ? 'x' : ''}.`;
            const followUpMessages = [
              ...messages,
              aiMessage,
              {
                role: 'tool',
                tool_call_id: toolCall?.id || 'unknown',
                content: toolResponseContent
              }
            ];
            const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: followUpMessages,
                temperature: 0.7,
                max_tokens: 2000,
                tools: finalTools,
                tool_choice: "auto",
                parallel_tool_calls: false
              })
            });
            const followUpData = await followUpResponse.json();
            // GUARD CLAUSE: Usar helper function
            const followUpResult = getOpenAIMessage(followUpData);
            if (!followUpResult) {
              return new Response(JSON.stringify({
                type: "text",
                response: "Erro ao processar a resposta da IA. Por favor, tente novamente.",
                usage: data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            const followUpMessage = followUpResult.message;
            const nextToolCallResult = getFirstToolCall(followUpMessage);
            if (nextToolCallResult) {
              const nextFunctionName = nextToolCallResult.name;
              const nextFunctionArgs = nextToolCallResult.arguments;
              return new Response(JSON.stringify({
                type: "function_call",
                function: nextFunctionName,
                arguments: nextFunctionArgs,
                usage: followUpData.usage || data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            return new Response(JSON.stringify({
              type: "text",
              response: followUpMessage.content || toolResponseContent,
              usage: followUpData.usage || data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // VERIFICAÇÃO DE DADOS: Tentar parse do JSON com proteção
          let goalData;
          try {
            goalData = await goalResponse.json();
            // VERIFICAÇÃO DE DADOS: Log da resposta para debug
            console.log(`🎯 [LADS-BRAIN] Resposta de manage-client-goal:`, JSON.stringify(goalData, null, 2));
          } catch (jsonError) {
            console.error(`❌ [LADS-BRAIN] Erro ao fazer parse do JSON de manage-client-goal:`, jsonError);
            // Continuar com fallback (SILENCIOSO)
            const defaultFallback = 3.0;
            const toolResponseContent = `Meta ${functionArgs.metric} não pôde ser consultada (erro no formato da resposta). Usando valor padrão de ${defaultFallback}${functionArgs.metric === 'target_roas' ? 'x' : ''}.`;
            const followUpMessages = [
              ...messages,
              aiMessage,
              {
                role: 'tool',
                tool_call_id: toolCall?.id || 'unknown',
                content: toolResponseContent
              }
            ];
            const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: followUpMessages,
                temperature: 0.7,
                max_tokens: 2000,
                tools: finalTools,
                tool_choice: "auto",
                parallel_tool_calls: false
              })
            });
            const followUpData = await followUpResponse.json();
            // GUARD CLAUSE: Usar helper function
            const followUpResult = getOpenAIMessage(followUpData);
            if (!followUpResult) {
              return new Response(JSON.stringify({
                type: "text",
                response: "Erro ao processar a resposta da IA. Por favor, tente novamente.",
                usage: data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            const followUpMessage = followUpResult.message;
            const nextToolCallResult = getFirstToolCall(followUpMessage);
            if (nextToolCallResult) {
              const nextFunctionName = nextToolCallResult.name;
              const nextFunctionArgs = nextToolCallResult.arguments;
              return new Response(JSON.stringify({
                type: "function_call",
                function: nextFunctionName,
                arguments: nextFunctionArgs,
                usage: followUpData.usage || data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            return new Response(JSON.stringify({
              type: "text",
              response: followUpMessage.content || toolResponseContent,
              usage: followUpData.usage || data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // GUARD CLAUSE: Sempre tratar goalData como pode ser inválido
          if (!goalData) {
            console.error(`❌ [LADS-BRAIN] Resposta vazia de manage-client-goal`);
            // SILENCIOSO: Usar fallback e continuar
            const defaultFallback = 3.0;
            const toolResponseContent = `Meta ${functionArgs.metric} não pôde ser consultada. Usando valor padrão de ${defaultFallback}${functionArgs.metric === 'target_roas' ? 'x' : ''}.`;
            // Continuar o fluxo mesmo com erro (não quebrar o chat)
            const followUpMessages = [
              ...messages,
              aiMessage,
              {
                role: 'tool',
                tool_call_id: toolCall?.id || 'unknown',
                content: toolResponseContent
              }
            ];
            const followUpResponse = await callOpenAIWithRetry(OPENAI_API_KEY, {
              model: 'gpt-4o-mini',
              messages: followUpMessages,
              temperature: 0.7,
              max_tokens: 2000,
              tools: tools,
              tool_choice: "auto",
              parallel_tool_calls: false
            });
            const followUpData = await followUpResponse.json();
            // GUARD CLAUSE: Usar helper function
            const followUpResult = getOpenAIMessage(followUpData);
            if (!followUpResult) {
              return new Response(JSON.stringify({
                type: "text",
                response: toolResponseContent || "Erro ao processar a resposta da IA. Por favor, tente novamente.",
                usage: data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            const followUpMessage = followUpResult.message;
            return new Response(JSON.stringify({
              type: "text",
              response: followUpMessage.content || toolResponseContent,
              usage: followUpResult.usage || followUpData.usage || data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Para GET, sempre considerar success:true como válido (fallback já implementado no backend)
          if (functionArgs.action === 'GET' && goalData.success === false && !goalData.target_value && !goalData.default_value) {
            // Se falhou mas não temos fallback, criar um (SILENCIOSO)
            console.log(`⚠️ [LADS-BRAIN] Meta ${functionArgs.metric} falhou mas continuando com fallback`);
            goalData.success = true;
            goalData.default_value = 3.0;
            goalData.is_default = true;
          }
          // Para GET, SEMPRE usar fallback se não tiver target_value (não quebrar o chat)
          if (functionArgs.action === 'GET' && (!goalData.target_value || goalData.target_value === null)) {
            const defaultValue = goalData.default_value || 3.0;
            const toolResponseContent = `Meta ${functionArgs.metric} não está definida. Usando valor padrão de ${defaultValue}${functionArgs.metric === 'target_roas' ? 'x' : functionArgs.metric === 'target_cpa' || functionArgs.metric === 'target_cpc' ? ' (R$)' : '%'}.`;
            // Continuar normalmente com o fallback
            const followUpMessages = [
              ...messages,
              aiMessage,
              {
                role: 'tool',
                tool_call_id: toolCall?.id || 'unknown',
                content: toolResponseContent
              }
            ];
            const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: followUpMessages,
                temperature: 0.7,
                max_tokens: 2000,
                tools: finalTools,
                tool_choice: "auto",
                parallel_tool_calls: false
              })
            });
            const followUpData = await followUpResponse.json();
            // GUARD CLAUSE: Usar helper function
            const followUpResult = getOpenAIMessage(followUpData);
            if (!followUpResult) {
              return new Response(JSON.stringify({
                type: "text",
                response: "Erro ao processar a resposta da IA. Por favor, tente novamente.",
                usage: data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            const followUpMessage = followUpResult.message;
            const nextToolCallResult = getFirstToolCall(followUpMessage);
            if (nextToolCallResult) {
              const nextFunctionName = nextToolCallResult.name;
              const nextFunctionArgs = nextToolCallResult.arguments;
              return new Response(JSON.stringify({
                type: "function_call",
                function: nextFunctionName,
                arguments: nextFunctionArgs,
                usage: followUpData.usage || data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            return new Response(JSON.stringify({
              type: "text",
              response: followUpMessage.content || toolResponseContent,
              usage: followUpData.usage || data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Se chegou aqui, a meta existe ou é um SET
          // Format response for AI to process
          let toolResponseContent = '';
          if (functionArgs.action === 'GET') {
            // Já verificado acima que target_value existe
            toolResponseContent = `Meta ${functionArgs.metric} (global por usuário): ${goalData.target_value}`;
          } else if (functionArgs.action === 'SET') {
            toolResponseContent = `Meta ${functionArgs.metric} definida como ${functionArgs.target_value} (global por usuário).`;
          }
          // Send tool response back to AI for follow-up conversation
          const followUpMessages = [
            ...messages,
            aiMessage,
            {
              role: 'tool',
              tool_call_id: toolCall?.id || 'unknown',
              content: toolResponseContent
            }
          ];
          const followUpResponse = await callOpenAIWithRetry(OPENAI_API_KEY, {
            model: 'gpt-4o-mini',
            messages: followUpMessages,
            temperature: 0.7,
            max_tokens: 2000,
            tools: tools,
            tool_choice: "auto",
            parallel_tool_calls: false
          });
          const followUpData = await followUpResponse.json();
          // 🔒 GUARD: Validate follow-up response
          const followUpResult = getOpenAIMessage(followUpData);
          if (!followUpResult || !followUpResult.message) {
            console.error('❌ [LADS-BRAIN] Follow-up response invalid (manage_client_goal):', JSON.stringify(followUpData).substring(0, 300));
            return new Response(JSON.stringify({
              type: "text",
              response: toolResponseContent || "Operação realizada, mas não consegui gerar resposta. Tente novamente.",
              usage: followUpData?.usage || data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          const followUpMessage = followUpResult.message;
          // Check if AI wants to call another function (chain of tools)
          if (followUpMessage?.tool_calls && followUpMessage.tool_calls.length > 0) {
            // Return function call to frontend to handle
            const nextToolCall = followUpMessage.tool_calls[0];
            const nextFunctionName = nextToolCall.function.name;
            const nextFunctionArgs = JSON.parse(nextToolCall.function.arguments);
            return new Response(JSON.stringify({
              type: "function_call",
              function: nextFunctionName,
              arguments: nextFunctionArgs,
              usage: followUpData.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Return text response if AI doesn't call another function
          return new Response(JSON.stringify({
            type: "text",
            response: followUpMessage.content || toolResponseContent,
            usage: followUpData.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          // SILENCIOSO: Se manage_client_goal falhar, usar fallback e continuar
          console.error(`❌ [LADS-BRAIN] Erro ao chamar manage_client_goal:`, error);
          if (functionArgs.action === 'GET') {
            // Para GET, sempre usar fallback silencioso (não quebrar o chat)
            const defaultFallback = 3.0;
            const toolResponseContent = `Meta ${functionArgs.metric} não pôde ser consultada. Usando valor padrão de ${defaultFallback}${functionArgs.metric === 'target_roas' ? 'x' : ''}.`;
            // Continuar o fluxo normalmente com fallback
            const followUpMessages = [
              ...messages,
              aiMessage,
              {
                role: 'tool',
                tool_call_id: toolCall?.id || 'unknown',
                content: toolResponseContent
              }
            ];
            const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: followUpMessages,
                temperature: 0.7,
                max_tokens: 2000,
                tools: finalTools,
                tool_choice: "auto",
                parallel_tool_calls: false
              })
            });
            const followUpData = await followUpResponse.json();
            const followUpResult = getOpenAIMessage(followUpData);
            if (!followUpResult) {
              return new Response(JSON.stringify({
                type: "text",
                response: toolResponseContent,
                usage: data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            const followUpMessage = followUpResult.message;
            const nextToolCallResult = getFirstToolCall(followUpMessage);
            if (nextToolCallResult) {
              return new Response(JSON.stringify({
                type: "function_call",
                function: nextToolCallResult.name,
                arguments: nextToolCallResult.arguments,
                usage: followUpResult.usage || data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            return new Response(JSON.stringify({
              type: "text",
              response: followUpMessage.content || toolResponseContent,
              usage: followUpResult.usage || data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Para SET, retornar erro (mas ainda não quebrar)
          return new Response(JSON.stringify({
            type: "text",
            response: `Erro ao gerenciar meta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle propose_campaign_structure tool (special validation before returning to frontend)
      if (functionName === 'propose_campaign_structure') {
        try {
          console.log("🚀 [LADS-BRAIN] Tool propose_campaign_structure chamada pela IA");
          // 🛡️ MANDATORY TOOL CALL ENFORCEMENT
          // Check if the AI is trying to use cities/regions or interests without calling the required tools first
          // Helper: Check if conversation history contains a specific tool call
          const hasToolCallInHistory = (toolName)=>{
            return messages.some((msg)=>{
              // Check assistant messages with tool_calls
              if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
                return msg.tool_calls.some((tc)=>tc.function?.name === toolName);
              }
              // 🌍 Enhanced detection for searchMetaGeo
              if (toolName === 'searchMetaGeo') {
                // Check tool response messages
                if (msg.role === 'tool') {
                  const content = msg.content || '';
                  return content.includes('locations') || content.includes('key');
                }
                // Check if assistant message confirms location was found (text pattern)
                if (msg.role === 'assistant') {
                  const content = msg.content || '';
                  // Patterns that indicate searchMetaGeo was already used
                  return content.includes('Encontrei') && (content.includes('cidade') || content.includes('city') || content.includes('region') || content.includes('estado')) || content.includes('Localização') && content.includes('key:') || content.includes('📍') && content.includes('key');
                }
                // Check function call marker in message
                if (msg.functionCall?.name === toolName || msg.functionCall?.name === 'searchMetaGeo') {
                  return true;
                }
              }
              // 🎯 Check for user-confirmed interest selection
              if (toolName === 'request_interest_selection' && msg.role === 'user') {
                const content = msg.content || '';
                return content.includes('Selecionei os interesses:') || content.includes('__INTEREST_SELECTION__');
              }
              return false;
            });
          };
          // Check if campaign has cities or regions
          const hasCities = functionArgs.targeting?.geo_locations?.cities?.length > 0 || (functionArgs.adsets || []).some((adset)=>adset.targeting?.geo_locations?.cities?.length > 0);
          const hasRegions = functionArgs.targeting?.geo_locations?.regions?.length > 0 || (functionArgs.adsets || []).some((adset)=>adset.targeting?.geo_locations?.regions?.length > 0);
          // Check if campaign has interests
          const hasInterests = functionArgs.targeting?.interests?.length > 0 || (functionArgs.adsets || []).some((adset)=>adset.targeting?.interests?.length > 0);
          // 🔧 HELPER: Check if a geo key is valid (numeric string)
          const isValidNumericKey = (key)=>{
            if (!key) return false;
            const keyStr = String(key);
            return /^\d+$/.test(keyStr) && keyStr.length >= 5;
          };
          // 🔧 CHECK: If all cities/regions have valid numeric keys, they're already resolved - SKIP enforcement
          const allCitiesHaveValidKeys = [
            ...functionArgs.targeting?.geo_locations?.cities || [],
            ...(functionArgs.adsets || []).flatMap((a)=>a.targeting?.geo_locations?.cities || [])
          ].every((c)=>isValidNumericKey(c.key));
          const allRegionsHaveValidKeys = [
            ...functionArgs.targeting?.geo_locations?.regions || [],
            ...(functionArgs.adsets || []).flatMap((a)=>a.targeting?.geo_locations?.regions || [])
          ].every((r)=>isValidNumericKey(r.key));
          const allGeoKeysAreValid = (!hasCities || allCitiesHaveValidKeys) && (!hasRegions || allRegionsHaveValidKeys);
          if (allGeoKeysAreValid && (hasCities || hasRegions)) {
            console.log("✅ [LADS-BRAIN] GEO BYPASS: All cities/regions have valid numeric keys, skipping searchMetaGeo enforcement");
          }
          // 🔧 HELPER: Check if a value is a valid 2-letter country code
          const isValid2LetterCountryCode = (code)=>{
            if (!code || typeof code !== 'string') return false;
            const trimmed = code.trim().toUpperCase();
            // Must be exactly 2 letters (country code)
            return /^[A-Z]{2}$/.test(trimmed);
          };
          // 🔧 CHECK: Validate countries array - detect invalid values like "New York"
          // Instead of blocking immediately, try to AUTO-RESOLVE them as cities first
          const allCountries = [
            ...functionArgs.targeting?.geo_locations?.countries || [],
            ...(functionArgs.adsets || []).flatMap((a)=>a.targeting?.geo_locations?.countries || [])
          ];
          const invalidCountryCodes = allCountries.filter((c)=>!isValid2LetterCountryCode(c));
          // 🌍 AUTO-RESOLVE: If there are invalid country codes, try to resolve them as cities BEFORE blocking
          if (invalidCountryCodes.length > 0) {
            console.log("🔄 [LADS-BRAIN] Detected city names in countries array, attempting auto-resolution:", invalidCountryCodes);
            // @ts-ignore: Deno global
            const supabaseUrlGeo = Deno.env.get('SUPABASE_URL') ?? '';
            // @ts-ignore: Deno global
            const supabaseServiceKeyGeo = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
            // Helper to resolve a location quickly
            const quickResolveLocation = async (name)=>{
              try {
                const response = await fetch(`${supabaseUrlGeo}/functions/v1/search-meta-geo`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${supabaseServiceKeyGeo}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    query: name,
                    locationType: 'city',
                    accountId: globalAccountId
                  })
                });
                const geoData = await response.json();
                if (geoData.results && geoData.results.length > 0) {
                  const result = geoData.results[0];
                  return {
                    key: String(result.key),
                    name: result.name,
                    type: result.type || 'city'
                  };
                }
              } catch (e) {
                console.error(`❌ [AUTO-RESOLVE] Failed to resolve "${name}":`, e);
              }
              return null;
            };
            let allResolved = true;
            const resolutionResults = [];
            // Try to resolve each invalid code
            for (const invalidCode of invalidCountryCodes){
              const resolved = await quickResolveLocation(invalidCode);
              if (resolved) {
                resolutionResults.push({
                  original: invalidCode,
                  resolved
                });
              } else {
                allResolved = false;
                break;
              }
            }
            if (allResolved && resolutionResults.length > 0) {
              console.log("✅ [LADS-BRAIN] Auto-resolved all invalid country codes:", resolutionResults);
              // Apply resolutions to the actual targeting in adsets
              for (const adset of functionArgs.adsets || []){
                const countries = adset.targeting?.geo_locations?.countries || [];
                for(let i = countries.length - 1; i >= 0; i--){
                  const country = countries[i];
                  const resolution = resolutionResults.find((r)=>r.original === country);
                  if (resolution) {
                    countries.splice(i, 1);
                    if (!adset.targeting.geo_locations.cities) {
                      adset.targeting.geo_locations.cities = [];
                    }
                    adset.targeting.geo_locations.cities.push({
                      key: resolution.resolved.key,
                      name: resolution.resolved.name,
                      radius: 40,
                      distance_unit: 'kilometer'
                    });
                    console.log(`✅ [AUTO-RESOLVE] Moved "${resolution.original}" to cities as: ${resolution.resolved.name} (key: ${resolution.resolved.key})`);
                  }
                }
              }
              // Also check top-level targeting
              const topCountries = functionArgs.targeting?.geo_locations?.countries || [];
              for(let i = topCountries.length - 1; i >= 0; i--){
                const country = topCountries[i];
                const resolution = resolutionResults.find((r)=>r.original === country);
                if (resolution) {
                  topCountries.splice(i, 1);
                  if (!functionArgs.targeting.geo_locations.cities) {
                    functionArgs.targeting.geo_locations.cities = [];
                  }
                  functionArgs.targeting.geo_locations.cities.push({
                    key: resolution.resolved.key,
                    name: resolution.resolved.name,
                    radius: 40,
                    distance_unit: 'kilometer'
                  });
                }
              }
            } else {
              // Resolution failed - show error to user (bilingual)
              console.error("❌ [LADS-BRAIN] BLOCKED: Could not auto-resolve invalid country codes:", invalidCountryCodes);
              const isEnglish = aiLanguage === 'en' || aiLanguage === 'en-US';
              const errorMessage = isEnglish ? `⚠️ **Location Error**

"${invalidCountryCodes.join(', ')}" is NOT a valid country code. It appears to be a city or region name.

**To target a city/region, you must:**
1. Call \`searchMetaGeo({ query: "${invalidCountryCodes[0]}", locationType: "city" })\` to get the proper key
2. Use the returned numeric KEY in the targeting

**To target a country:**
- Use a 2-letter country code like "US", "GB", "CA"
- Example: \`{ countries: ["US"] }\`

Please use searchMetaGeo to resolve the location first.` : `⚠️ **Erro de Localização**

"${invalidCountryCodes.join(', ')}" NÃO é um código de país válido. Parece ser um nome de cidade ou região.

**Para segmentar uma cidade/região, você deve:**
1. Chamar \`searchMetaGeo({ query: "${invalidCountryCodes[0]}", locationType: "city" })\` para obter a key correta
2. Usar a KEY numérica retornada no targeting

**Para segmentar um país:**
- Use um código de país de 2 letras como "BR", "US", "PT"
- Exemplo: \`{ countries: ["BR"] }\`

Por favor, use searchMetaGeo para resolver a localização primeiro.`;
              return new Response(JSON.stringify({
                type: "text",
                response: errorMessage,
                usage: data?.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
          }
          // 🌍 AUTO-RESOLUTION: If cities/regions don't have valid keys, resolve them automatically
          if ((hasCities || hasRegions) && !allGeoKeysAreValid) {
            console.log("🔄 [LADS-BRAIN] AUTO-RESOLVING: Cities/regions need valid keys, calling search-meta-geo...");
            // Helper function to resolve location via search-meta-geo
            // Returns key, name, AND type (city/region/country) for proper routing
            const resolveLocation = async (name, locationType)=>{
              try {
                // @ts-ignore: Deno global
                const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
                // @ts-ignore: Deno global  
                const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
                const searchResponse = await fetch(`${supabaseUrl}/functions/v1/search-meta-geo`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    query: name,
                    locationType: locationType,
                    accountId: globalAccountId
                  })
                });
                const searchData = await searchResponse.json();
                if (searchData?.locations?.length > 0) {
                  const loc = searchData.locations[0];
                  console.log(`✅ [AUTO-GEO] Resolved "${name}" -> key: ${loc.key}, name: ${loc.name}, type: ${loc.type}`);
                  return {
                    key: loc.key,
                    name: loc.name,
                    type: loc.type || locationType
                  };
                }
              } catch (e) {
                console.error(`❌ [AUTO-GEO] Failed to resolve "${name}":`, e);
              }
              return null;
            };
            // Resolve cities
            const allCities = [
              ...functionArgs.targeting?.geo_locations?.cities || [],
              ...(functionArgs.adsets || []).flatMap((a)=>a.targeting?.geo_locations?.cities || [])
            ];
            for (const city of allCities){
              if (!isValidNumericKey(city.key) && city.name) {
                const resolved = await resolveLocation(city.name, 'city');
                if (resolved) {
                  city.key = resolved.key;
                  city.name = resolved.name;
                }
              }
            }
            // Resolve regions
            const allRegions = [
              ...functionArgs.targeting?.geo_locations?.regions || [],
              ...(functionArgs.adsets || []).flatMap((a)=>a.targeting?.geo_locations?.regions || [])
            ];
            for (const region of allRegions){
              if (!isValidNumericKey(region.key) && region.name) {
                const resolved = await resolveLocation(region.name, 'region');
                if (resolved) {
                  region.key = resolved.key;
                  region.name = resolved.name;
                }
              }
            }
            // Also check countries array for invalid values (city names in countries)
            for (const adset of functionArgs.adsets || []){
              const geoLocations = adset.targeting?.geo_locations;
              // 🔧 HANDLE STRING ARRAY FORMAT: AI sometimes generates geo_locations as ["New York"]
              // Route to correct array based on actual location type returned by Meta
              if (Array.isArray(geoLocations) && geoLocations.length > 0 && typeof geoLocations[0] === 'string') {
                console.log(`🔄 [AUTO-GEO] Converting string array geo_locations:`, geoLocations);
                const cities = [];
                const regions = [];
                const countries = [];
                for (const locationName of geoLocations){
                  if (typeof locationName === 'string' && locationName.length > 0) {
                    // Try to resolve - will return actual type from Meta
                    const resolved = await resolveLocation(locationName, 'city');
                    if (resolved) {
                      // Route to correct array based on type
                      if (resolved.type === 'country') {
                        // For countries, just need the 2-letter code
                        countries.push(resolved.key);
                      } else if (resolved.type === 'region') {
                        regions.push({
                          key: resolved.key,
                          name: resolved.name
                        });
                      } else {
                        // Default to city
                        cities.push({
                          key: resolved.key,
                          name: resolved.name,
                          radius: 40,
                          distance_unit: 'kilometer'
                        });
                      }
                    }
                  }
                }
                // Build geo_locations with correct arrays
                adset.targeting.geo_locations = {
                  ...cities.length > 0 ? {
                    cities
                  } : {},
                  ...regions.length > 0 ? {
                    regions
                  } : {},
                  ...countries.length > 0 ? {
                    countries
                  } : {}
                };
                console.log(`✅ [AUTO-GEO] Converted with proper type routing:`, adset.targeting.geo_locations);
              }
              // Check countries array for invalid values
              const countries = adset.targeting?.geo_locations?.countries || [];
              for(let i = countries.length - 1; i >= 0; i--){
                const country = countries[i];
                if (!isValid2LetterCountryCode(country)) {
                  console.log(`🔄 [AUTO-GEO] "${country}" is not a country code, resolving as city...`);
                  const resolved = await resolveLocation(country, 'city');
                  if (resolved) {
                    countries.splice(i, 1);
                    if (!adset.targeting.geo_locations.cities) {
                      adset.targeting.geo_locations.cities = [];
                    }
                    adset.targeting.geo_locations.cities.push({
                      key: resolved.key,
                      name: resolved.name,
                      radius: 40,
                      distance_unit: 'kilometer'
                    });
                  }
                }
              }
              // 🔧 PIXEL ID FIX: If pixel_id is a name, get numeric ID from defaults
              if (adset.promoted_object?.pixel_id && !/^\d+$/.test(adset.promoted_object.pixel_id)) {
                console.log(`🔄 [AUTO-GEO] Pixel ID "${adset.promoted_object.pixel_id}" is a name, looking up...`);
                const pixelMatch = defaultsContext?.match(/Pixel ID:\s*(\d+)/);
                if (pixelMatch && pixelMatch[1]) {
                  console.log(`✅ [AUTO-GEO] Resolved pixel to ID: ${pixelMatch[1]}`);
                  adset.promoted_object.pixel_id = pixelMatch[1];
                }
              }
            }
            console.log("✅ [LADS-BRAIN] AUTO-RESOLUTION complete, proceeding with campaign...");
          }
          // 🔧 ALWAYS FIX PIXEL ID: Runs independently of geo-resolution
          for (const adset of functionArgs.adsets || []){
            if (adset.promoted_object?.pixel_id && !/^\d+$/.test(adset.promoted_object.pixel_id)) {
              console.log(`🔄 [AUTO-FIX] Pixel ID "${adset.promoted_object.pixel_id}" is a name, looking up...`);
              // Try multiple regex patterns to find pixel ID in defaults
              const pixelMatch = defaultsContext?.match(/Pixel ID:\s*['"]?(\d+)['"]?/) || defaultsContext?.match(/default_pixel_id.*?['"](\d+)['"]/) || defaultsContext?.match(/(\d{10,20})/); // Fallback: any 10-20 digit number
              if (pixelMatch && pixelMatch[1]) {
                console.log(`✅ [AUTO-FIX] Resolved pixel to ID: ${pixelMatch[1]}`);
                adset.promoted_object.pixel_id = pixelMatch[1];
              } else {
                console.error(`❌ [AUTO-FIX] Could not find pixel ID in defaults. Defaults context: "${defaultsContext?.substring(0, 200)}..."`);
              }
            }
          }
          // 🎯 INTEREST ENFORCEMENT: If interests are used, request_interest_selection MUST have been called
          if (hasInterests && !hasToolCallInHistory('request_interest_selection')) {
            console.error("❌ [LADS-BRAIN] BLOCKED: Campaign has interests but request_interest_selection was never called!");
            // Extract the interest names the AI is trying to use
            const interestNames = [
              ...(functionArgs.targeting?.interests || []).map((i)=>i.name || i.id),
              ...(functionArgs.adsets || []).flatMap((a)=>(a.targeting?.interests || []).map((i)=>i.name || i.id))
            ].filter(Boolean).join(', ');
            // FORCE the AI to open the interest selection widget
            return new Response(JSON.stringify({
              type: "function_call",
              function: "request_interest_selection",
              arguments: {
                suggested_query: interestNames || ""
              },
              _enforcement_note: "Auto-triggered because AI tried to use interests without calling request_interest_selection first"
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Validação básica dos argumentos
          if (!functionArgs.structure) {
            functionArgs.structure = '1-1-1'; // Default seguro
            console.log("⚠️ [LADS-BRAIN] Estrutura não fornecida, usando padrão 1-1-1");
          }
          if (!functionArgs.objective) {
            functionArgs.objective = 'SALES'; // Default
            console.log("⚠️ [LADS-BRAIN] Objetivo não fornecido, usando padrão SALES");
          }
          if (!functionArgs.budget || functionArgs.budget <= 0) {
            functionArgs.budget = 50; // Default R$ 50/dia
            console.log("⚠️ [LADS-BRAIN] Orçamento não fornecido ou inválido, usando padrão R$ 50");
          }
          // Garantir que accountId está presente nos argumentos (para o frontend usar)
          if (!functionArgs.accountId && globalAccountId) {
            functionArgs.accountId = globalAccountId;
            console.log("✅ [LADS-BRAIN] AccountId injetado nos argumentos:", globalAccountId);
          }
          // 🛡️ GEO GUARDRAIL: Block placeholder keys (but not legitimate numeric keys)
          // Helper function to check if a key is a placeholder
          const isPlaceholderKey = (key)=>{
            if (!key) return false;
            const keyStr = String(key);
            // Block exact placeholder patterns used in examples
            return keyStr.includes('USE_SEARCH_RESULT') || keyStr.includes('_KEY') || // SP_KEY, RJ_KEY
            keyStr === '123456' || keyStr === '1234' || keyStr.startsWith('123456_') || keyStr.startsWith('1234_');
          };
          const checkGeoLocations = (geoLocs)=>{
            if (!geoLocs) return false;
            const hasBadCity = (geoLocs.cities || []).some((c)=>isPlaceholderKey(c.key));
            const hasBadRegion = (geoLocs.regions || []).some((r)=>isPlaceholderKey(r.key));
            return hasBadCity || hasBadRegion;
          };
          // Check top-level targeting
          const topLevelBad = checkGeoLocations(functionArgs.targeting?.geo_locations);
          // Check each adset's targeting
          const adsetBad = (functionArgs.adsets || []).some((adset)=>checkGeoLocations(adset.targeting?.geo_locations));
          if (topLevelBad || adsetBad) {
            console.error("❌ [LADS-BRAIN] IA usou key de exemplo proibida na geolocalização!");
            // 🔧 SIMPLIFIED GUARDRAIL: Return text error immediately (bilingual)
            const isEnglish = aiLanguage === 'en' || aiLanguage === 'en-US';
            const userFriendlyError = isEnglish ? `⚠️ **Location Error**

I couldn't configure the location correctly. This happens when the city search wasn't done beforehand.

**To fix this, please tell me the city/state clearly:**
- Example: "Target New York City"
- Example: "Campaign for Los Angeles and Miami"

I'll search for the correct locations and continue the process.` : `⚠️ **Erro de Localização**

Não consegui configurar a localização corretamente. Isso acontece quando a busca de cidades não foi feita antes.

**Para corrigir, por favor me informe a cidade/estado de forma clara:**
- Exemplo: "Segmentar para a cidade de São Paulo"
- Exemplo: "Campanha para Curitiba e Rio de Janeiro"

Vou buscar as localizações corretas e continuar o processo.`;
            return new Response(JSON.stringify({
              type: "text",
              response: userFriendlyError,
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // 🔧 OPTIMIZATION: Validate all interests in PARALLEL to prevent timeouts
          const targeting = functionArgs.targeting || {};
          const interestCache = new Map();
          if (targeting.interests && Array.isArray(targeting.interests) && targeting.interests.length > 0) {
            console.log("🔍 [LADS-BRAIN] Validando TODOS os interesses em PARALELO:", targeting.interests.length);
            // @ts-ignore: Deno global
            const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
            // @ts-ignore: Deno global
            const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
            const validationPromises = targeting.interests.map(async (interest)=>{
              const interestName = interest.name || interest.id || interest;
              // Skip if already in cache
              if (interestCache.has(interestName)) return interestCache.get(interestName);
              // Skip if already looks like a valid numeric ID (string of digits > 6)
              if (typeof interest.id === 'string' && /^\d{7,}$/.test(interest.id)) {
                console.log(`⏩ [LADS-BRAIN] Pulando validação para ID já numérico: ${interest.id}`);
                const result = {
                  id: interest.id,
                  name: interest.name || interestName
                };
                interestCache.set(interestName, result);
                return result;
              }
              console.log(`🔍 [LADS-BRAIN] Buscando interesse REAL para: "${interestName}"`);
              try {
                const searchRes = await fetch(`${supabaseUrl}/functions/v1/search-meta-interests`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    query: interestName,
                    accountId: globalAccountId
                  })
                });
                const searchData = await searchRes.json();
                if (searchData.results && searchData.results.length > 0) {
                  const realInterest = searchData.results[0];
                  const result = {
                    id: String(realInterest.id),
                    name: realInterest.name
                  };
                  interestCache.set(interestName, result);
                  return result;
                }
                interestCache.set(interestName, null);
                return null;
              } catch (err) {
                console.error(`❌ [LADS-BRAIN] Erro ao validar "${interestName}":`, err);
                return null;
              }
            });
            const results = await Promise.all(validationPromises);
            const validatedInterests = results.filter((r)=>r !== null);
            if (validatedInterests.length > 0) {
              functionArgs.targeting = {
                ...targeting,
                interests: validatedInterests
              };
              console.log(`✅ [LADS-BRAIN] ${validatedInterests.length} interesses VALIDADOS.`);
            } else {
              delete functionArgs.targeting.interests;
              console.log(`⚠️ [LADS-BRAIN] Nenhum interesse válido encontrado.`);
            }
          }
          // 🔧 OPTIMIZATION: Also parallelize interests in AdSets
          if (functionArgs.adsets && Array.isArray(functionArgs.adsets)) {
            console.log(`🔍 [LADS-BRAIN] Validando interesses em ${functionArgs.adsets.length} adsets (em paralelo)...`);
            // @ts-ignore: Deno global
            const supabaseUrl2 = Deno.env.get('SUPABASE_URL') ?? '';
            // @ts-ignore: Deno global
            const supabaseServiceKey2 = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
            const adsetPromises = functionArgs.adsets.map(async (adset, index)=>{
              if (adset.targeting?.interests && Array.isArray(adset.targeting.interests) && adset.targeting.interests.length > 0) {
                const adsetValidationPromises = adset.targeting.interests.map(async (interest)=>{
                  const interestName = interest.name || interest.id || interest;
                  if (interestCache.has(interestName)) return interestCache.get(interestName);
                  if (typeof interest.id === 'string' && /^\d{7,}$/.test(interest.id)) {
                    const result = {
                      id: interest.id,
                      name: interest.name || interestName
                    };
                    interestCache.set(interestName, result);
                    return result;
                  }
                  try {
                    const searchRes = await fetch(`${supabaseUrl2}/functions/v1/search-meta-interests`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${supabaseServiceKey2}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        query: interestName,
                        accountId: globalAccountId
                      })
                    });
                    const searchData = await searchRes.json();
                    if (searchData.results && searchData.results.length > 0) {
                      const realInterest = searchData.results[0];
                      const result = {
                        id: String(realInterest.id),
                        name: realInterest.name
                      };
                      interestCache.set(interestName, result);
                      return result;
                    }
                    interestCache.set(interestName, null);
                    return null;
                  } catch (err) {
                    return null;
                  }
                });
                const adsetResults = await Promise.all(adsetValidationPromises);
                const validatedAdsetInterests = adsetResults.filter((r)=>r !== null);
                if (validatedAdsetInterests.length > 0) {
                  adset.targeting.interests = validatedAdsetInterests;
                } else {
                  delete adset.targeting.interests;
                }
              }
              return adset;
            });
            await Promise.all(adsetPromises);
          }
          // Segurança contra payloads gigantes
          let responseBody;
          try {
            responseBody = JSON.stringify({
              type: "function_call",
              function: functionName,
              arguments: functionArgs,
              usage: data.usage
            });
            console.log(`✅ [LADS-BRAIN] Payload de resposta gerado com sucesso (${responseBody.length} chars).`);
          } catch (serializeError) {
            console.error("❌ [LADS-BRAIN] Erro ao serializar resposta:", serializeError);
            throw new Error("Falha ao gerar resposta JSON (possível payload excessivo).");
          }
          // Retornar tool call validada ao frontend
          return new Response(responseBody, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          // TRATAMENTO DE ERRO: Em vez de quebrar, retornar erro estruturado
          console.error("❌ [LADS-BRAIN] Erro ao processar propose_campaign_structure:", error);
          // Retornar erro como function_call com campo de erro (frontend pode tratar)
          return new Response(JSON.stringify({
            type: "function_call",
            function: functionName,
            arguments: functionArgs || {},
            error: error.message || "Erro ao processar proposta de campanha",
            error_details: error.stack || null,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle updateDraftCard tool (modifica Draft Card existente - retorna ao frontend)
      if (functionName === 'updateDraftCard') {
        try {
          console.log("✏️ [LADS-BRAIN] Tool updateDraftCard chamada pela IA");
          console.log("📦 [LADS-BRAIN] Argumentos:", JSON.stringify(functionArgs, null, 2));
          // Validação básica
          if (!functionArgs.operation) {
            functionArgs.operation = 'update_all_ads';
          }
          if (!functionArgs.fields || Object.keys(functionArgs.fields).length === 0) {
            return new Response(JSON.stringify({
              type: "text",
              response: "⚠️ Nenhum campo especificado para atualizar. Informe quais campos deseja modificar.",
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Gerar mensagem de confirmação para o usuário
          // Mensagem interna para o sistema (o usuário verá a reação natural da IA)
          const confirmationMessage = "Operação realizada com sucesso.";
          // Retornar tool call ao frontend para processar
          return new Response(JSON.stringify({
            type: "function_call",
            function: functionName,
            arguments: functionArgs,
            confirmationMessage,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.error("❌ [LADS-BRAIN] Erro ao processar updateDraftCard:", error);
          return new Response(JSON.stringify({
            type: "text",
            response: `❌ Erro ao atualizar draft: ${error.message}`,
            usage: data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      // Handle createCampaignDraft tool (execução direta da criação - BLINDADA)
      if (functionName === 'createCampaignDraft') {
        console.log("🚀 [TOOL] Iniciando createCampaignDraft...");
        try {
          // 1. Recuperação Segura do Token
          // @ts-ignore: Deno global
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
          // @ts-ignore: Deno global
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
          const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
            db: {
              schema: 'ads'
            }
          });
          const authHeader = req.headers.get('Authorization');
          const userToken = authHeader ? authHeader.replace('Bearer ', '') : '';
          // Obter user.id para getAccessToken
          let userId = null;
          if (authHeader) {
            try {
              const { data: { user }, error: userError } = await supabaseClient.auth.getUser(userToken);
              if (!userError && user) {
                userId = user.id;
              }
            } catch (error) {
              console.error("❌ [TOOL] Erro ao obter user:", error);
            }
          }
          const token = await getAccessToken(supabaseClient, null, authHeader);
          if (!token) {
            throw new Error(`Token do Facebook não encontrado para o usuário. Por favor, reconecte sua conta.`);
          }
          // 2. Preparação do Payload
          const aiArgs = typeof functionArgs === 'string' ? JSON.parse(functionArgs) : functionArgs;
          // 🛡️ PHASE 3: Comprehensive validation with recovery messages
          const validationErrors = [];
          const validationWarnings = [];
          // Validate campaign exists
          if (!aiArgs.campaign) {
            validationErrors.push('Estrutura de campanha ausente');
          } else {
            if (!aiArgs.campaign.name) {
              validationWarnings.push('Nome da campanha ausente, será gerado automaticamente');
              aiArgs.campaign.name = 'Nova Campanha LADS';
            }
            if (!aiArgs.campaign.objective) {
              validationWarnings.push('Objetivo ausente, usando OUTCOME_SALES como padrão');
              aiArgs.campaign.objective = 'OUTCOME_SALES';
            }
          }
          // 🆕 OBJECTIVE-SPECIFIC VALIDATION AND DEFAULTS
          const objective = aiArgs.campaign?.objective || 'OUTCOME_SALES';
          const isLeads = objective === 'OUTCOME_LEADS';
          const isTraffic = objective === 'OUTCOME_TRAFFIC';
          const isSales = objective === 'OUTCOME_SALES' || objective === 'PRODUCT_CATALOG_SALES';
          const isEngagement = objective === 'OUTCOME_ENGAGEMENT';
          const isAwareness = objective === 'OUTCOME_AWARENESS';
          console.log(`🎯 [OBJECTIVE] Campaign objective: ${objective} (Leads=${isLeads}, Traffic=${isTraffic}, Sales=${isSales})`);
          // Set objective-specific defaults for each adset
          (aiArgs.adsets || []).forEach((adset, i)=>{
            // 🆕 Set default optimization_goal based on objective
            if (!adset.optimization_goal) {
              if (isLeads) {
                // LEADS: Default to LEAD_GENERATION (for instant forms) or OFFSITE_CONVERSIONS (for website)
                adset.optimization_goal = adset.destination_type === 'WEBSITE' ? 'OFFSITE_CONVERSIONS' : 'LEAD_GENERATION';
                console.log(`    🎯 [OBJECTIVE] AdSet[${i}] optimization_goal set to ${adset.optimization_goal} (LEADS)`);
              } else if (isTraffic) {
                // TRAFFIC: Default to LANDING_PAGE_VIEWS (higher quality than LINK_CLICKS)
                adset.optimization_goal = 'LANDING_PAGE_VIEWS';
                console.log(`    🎯 [OBJECTIVE] AdSet[${i}] optimization_goal set to LANDING_PAGE_VIEWS (TRAFFIC)`);
              } else if (isEngagement) {
                adset.optimization_goal = adset.destination_type === 'MESSENGER' || adset.destination_type === 'WHATSAPP' ? 'CONVERSATIONS' : 'POST_ENGAGEMENT';
                console.log(`    🎯 [OBJECTIVE] AdSet[${i}] optimization_goal set to ${adset.optimization_goal} (ENGAGEMENT)`);
              } else if (isAwareness) {
                adset.optimization_goal = 'REACH';
                console.log(`    🎯 [OBJECTIVE] AdSet[${i}] optimization_goal set to REACH (AWARENESS)`);
              } else {
                // SALES: Default to OFFSITE_CONVERSIONS
                adset.optimization_goal = 'OFFSITE_CONVERSIONS';
              }
            }
            // 🆕 Set default custom_event_type based on objective
            if (!adset.promoted_object?.custom_event_type) {
              if (isLeads) {
                adset.promoted_object = {
                  ...adset.promoted_object || {},
                  custom_event_type: 'LEAD'
                };
                console.log(`    🎯 [OBJECTIVE] AdSet[${i}] custom_event_type set to LEAD`);
              } else if (isSales) {
                adset.promoted_object = {
                  ...adset.promoted_object || {},
                  custom_event_type: 'PURCHASE'
                };
              }
            // TRAFFIC and AWARENESS don't need custom_event_type
            }
            // 🆕 Validate pixel requirements based on objective
            const needsPixel = isSales || isLeads && adset.destination_type !== 'ON_AD';
            if (needsPixel && !adset.promoted_object?.pixel_id && !aiArgs.pixel_id) {
              // Will be injected later from accountDefaults if available
              console.log(`    ⚠️ [OBJECTIVE] AdSet[${i}] needs pixel_id (objective=${objective})`);
            }
            // Traffic doesn't require pixel - clear promoted_object if empty
            if (isTraffic && adset.optimization_goal === 'LANDING_PAGE_VIEWS') {
              // TRAFFIC with LANDING_PAGE_VIEWS doesn't need promoted_object
              if (!adset.promoted_object?.pixel_id) {
                console.log(`    🎯 [OBJECTIVE] AdSet[${i}] TRAFFIC mode - promoted_object not required`);
              }
            }
          });
          // Validate adsets (bilingual)
          const isEnglishValidation = aiLanguage === 'en' || aiLanguage === 'en-US';
          if (!Array.isArray(aiArgs.adsets) || aiArgs.adsets.length === 0) {
            validationErrors.push(isEnglishValidation ? 'No ad sets (AdSet) configured. Please specify how many ad sets you want to create.' : 'Nenhum conjunto de anúncios (AdSet) foi configurado. Informe quantos conjuntos deseja criar.');
          }
          // Count total ads and check for missing creatives
          let totalAds = 0;
          let adsWithoutCreative = 0;
          let adsetsWithoutGeo = 0;
          (aiArgs.adsets || []).forEach((adset, i)=>{
            if (!adset.targeting?.geo_locations) {
              adsetsWithoutGeo++;
            }
            (adset.ads || []).forEach((ad)=>{
              totalAds++;
              if (!ad.creative_hash && !ad.video_id) {
                adsWithoutCreative++;
              }
            });
          });
          if (adsWithoutCreative > 0) {
            validationWarnings.push(isEnglishValidation ? `${adsWithoutCreative} ads are missing creatives (image/video). They may fail to publish.` : `${adsWithoutCreative} anúncios estão sem criativo (imagem/vídeo). Eles podem falhar na publicação.`);
          }
          if (adsetsWithoutGeo > 0) {
            validationWarnings.push(isEnglishValidation ? `${adsetsWithoutGeo} ad sets are missing location targeting. Location must be resolved via searchMetaGeo.` : `${adsetsWithoutGeo} conjuntos estão sem localização definida. A localização deve ser resolvida via searchMetaGeo.`);
          }
          // If there are critical errors, return helpful message to user
          if (validationErrors.length > 0) {
            console.error("❌ [VALIDATION] Critical errors:", validationErrors);
            const recoveryMessage = isEnglishValidation ? `⚠️ Unable to create campaign. Issues found:\n${validationErrors.map((e)=>`• ${e}`).join('\n')}\n\nCan we start over? Tell me what you need.` : `⚠️ Não foi possível criar a campanha. Problemas encontrados:\n${validationErrors.map((e)=>`• ${e}`).join('\n')}\n\nPodemos recomeçar? Me diga o que você precisa.`;
            return new Response(JSON.stringify({
              type: "text",
              response: recoveryMessage,
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Log warnings but continue
          if (validationWarnings.length > 0) {
            console.warn("⚠️ [VALIDATION] Warnings (continuing):", validationWarnings);
          }
          // 🔍 PHASE 1: Detailed logging for debugging multi-adset campaigns
          console.log("🔍 [TOOL] ===== createCampaignDraft Structure Validation =====");
          console.log("📊 [TOOL] Campaign:", aiArgs.campaign?.name, "Objective:", aiArgs.campaign?.objective);
          console.log("📊 [TOOL] AdSets received:", aiArgs.adsets?.length || 0, "Total Ads:", totalAds);
          // Validate and log each adset
          const validatedAdSets = (aiArgs.adsets || []).map((adset, i)=>{
            console.log(`  📊 [TOOL] AdSet[${i}]: name="${adset.name}"`);
            console.log(`    📊 Targeting geo_locations:`, JSON.stringify(adset.targeting?.geo_locations));
            console.log(`    📊 Ads count:`, adset.ads?.length || 0);
            // 🔧 VALIDATION: Ensure geo_locations exists - GLOBAL: No silent fallback
            if (!adset.targeting?.geo_locations) {
              console.error(`    ❌ [VALIDATION] AdSet[${i}] missing geo_locations! Location must be resolved in chat via searchMetaGeo.`);
              // 🌍 GLOBAL: Don't add fallback - return error to user
              validationErrors.push(isEnglishValidation ? `Ad set "${adset.name || `AdSet ${i + 1}`}" is missing location targeting. Use searchMetaGeo to define the location.` : `O conjunto de anúncios "${adset.name || `AdSet ${i + 1}`}" está sem localização definida. Use searchMetaGeo para definir a localização.`);
            }
            // 🔧 FIX: Inject PIXEL ID from AI args or Defaults (Vital for Conversion Campaigns)
            // Priority: 1. aiArgs.pixel_id (explicit from AI), 2. accountDefaults
            // @ts-ignore: accountDefaults might be available in scope
            const pixelIdToUse = aiArgs.pixel_id || accountDefaults?.default_pixel_id || accountDefaults?.pixel_id;
            if (pixelIdToUse && !adset.promoted_object?.pixel_id) {
              console.log(`    🔧 [FIX] Injecting Pixel ID ${pixelIdToUse} into AdSet[${i}]`);
              adset.promoted_object = {
                ...adset.promoted_object || {},
                pixel_id: pixelIdToUse,
                custom_event_type: adset.promoted_object?.custom_event_type || 'PURCHASE' // Default to Purchase for Sales
              };
            }
            // 🔧 VALIDATION: Ensure ads have proper creative assignment
            const validatedAds = (adset.ads || []).map((ad, j)=>{
              // 🔧 FIX: Ambiguity Sanitizer
              // If video_id exists, FORCE remove creative_hash to prevent logic errors downstream
              if (ad.video_id) {
                if (ad.creative_hash) {
                  console.log(`      🔧 [FIX] Ad[${j}] has both video_id and creative_hash. Removing hash to enforce VIDEO.`);
                  delete ad.creative_hash;
                }
              }
              console.log(`      📊 [TOOL] Ad[${j}]: creative_hash=${ad.creative_hash || 'N/A'}, video_id=${ad.video_id || 'N/A'}`);
              if (!ad.creative_hash && !ad.video_id) {
                console.warn(`      ⚠️ [VALIDATION] Ad[${j}] has no creative_hash or video_id`);
              }
              return ad;
            });
            return {
              ...adset,
              ads: validatedAds
            };
          });
          // 🔧 FIX: Start Time (Ensure Future Date +15min to avoid 'Past Time' error)
          let validStartTime = aiArgs.campaign?.start_time;
          if (!validStartTime || new Date(validStartTime) < new Date()) {
            const nowPlus10 = new Date(Date.now() + 15 * 60 * 1000); // Now + 15 min
            validStartTime = nowPlus10.toISOString();
            console.log(`    🔧 [FIX] Adjusted Start Time to future: ${validStartTime}`);
          }
          // 🔧 FIX: ABO vs CBO Logic - Respect explicit budget_strategy from AI
          // Priority: 1. aiArgs.budget_strategy (explicit), 2. Infer from budgets
          const hasAdSetBudgets = validatedAdSets.some((as)=>as.daily_budget && as.daily_budget > 0);
          const explicitBudgetStrategy = aiArgs.budget_strategy; // 'CBO' or 'ABO'
          const effectiveBudgetStrategy = explicitBudgetStrategy || (hasAdSetBudgets ? 'ABO' : 'CBO');
          console.log(`    📊 [BUDGET] Explicit Strategy: ${explicitBudgetStrategy || 'NOT SET'}, Effective: ${effectiveBudgetStrategy}`);
          let campaignDailyBudget = aiArgs.campaign?.daily_budget;
          if (effectiveBudgetStrategy === 'ABO') {
            console.log("    🔧 [FIX] ABO Mode. Clearing Campaign Budget & distributing to AdSets.");
            // Calculate per-adset budget if not already set
            const totalBudget = campaignDailyBudget || 100; // Default R$100
            const perAdSetBudget = Math.round(totalBudget / validatedAdSets.length);
            validatedAdSets.forEach((adset, i)=>{
              if (!adset.daily_budget || adset.daily_budget <= 0) {
                adset.daily_budget = perAdSetBudget;
                console.log(`      🔧 [FIX] AdSet[${i}] budget set to ${perAdSetBudget} (distributed)`);
              }
            });
            campaignDailyBudget = undefined; // Force ABO (no campaign budget)
          } else {
            console.log("    🔧 [FIX] CBO Mode. Ensuring Campaign Budget exists.");
            if (!campaignDailyBudget || campaignDailyBudget <= 0) {
              console.log("    🔧 [FIX] CBO inferred but no budget. Setting default R$100.");
              campaignDailyBudget = 100; // Default fallback
            }
            // Clear adset budgets for CBO
            validatedAdSets.forEach((adset)=>{
              delete adset.daily_budget;
            });
          }
          // TRANSFORMER: Adaptar output da AI para o formato Hierárquico do create-meta-campaign
          // 🔧 FIX: Inject instagram_actor_id and page_id from accountDefaults
          const defaultInstagramId = accountDefaults?.default_instagram_id || null;
          const defaultPageId = accountDefaults?.default_page_id || accountDefaults?.facebook_page_id || null;
          console.log(`📸 [TOOL] Injecting defaults - Page: ${defaultPageId}, Instagram: ${defaultInstagramId}`);
          const payload = {
            mode: 'hierarchical',
            accountId: globalAccountId || aiArgs.accountId,
            apiAccountId: globalAccountId || aiArgs.accountId,
            metaAccessToken: token,
            accessToken: token,
            // 🔧 FIX: Pass instagram_actor_id and page_id at top level for create-meta-campaign
            instagram_actor_id: defaultInstagramId,
            page_id: defaultPageId,
            // A AI retorna 'campaign' e 'adsets' como irmãos. A função espera adSets DENTRO de campaign.
            campaign: {
              ...aiArgs.campaign || {},
              daily_budget: campaignDailyBudget,
              start_time: validStartTime,
              adSets: validatedAdSets // Use validated adsets with fallbacks
            }
          };
          console.log("📦 [TOOL] Payload transformado para create-meta-campaign (Hierarchical).");
          console.log("📦 [TOOL] Campaign Name:", payload.campaign?.name);
          console.log("📦 [TOOL] AdSets count:", payload.campaign?.adSets?.length);
          console.log("🔍 [TOOL] ===== End Structure Validation =====");
          // 3. Chamada da Função de Criação via fetch (Edge Function)
          const createResponse = await fetch(`${supabaseUrl}/functions/v1/create-meta-campaign`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userToken || supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify(payload)
          });
          const result = await createResponse.json();
          // 4. Processar resultado e retornar para IA processar (seguindo padrão das outras tools)
          let toolResponseContent = '';
          if (!createResponse.ok || !result.success) {
            // Se a criação falhou, capturar o erro estruturado
            const errorMessage = result.error || result.message || `Erro HTTP ${createResponse.status}`;
            const errorSubcode = result.error_code || result.error_subcode || "N/A";
            console.error("❌ [TOOL ERROR] Falha na criação:", errorMessage);
            toolResponseContent = `❌ Falha na criação da campanha: ${errorMessage} (Subcode: ${errorSubcode}). Verifique se a conta de anúncios está ativa e se o token é válido.`;
          } else {
            console.log("✅ [TOOL] Sucesso:", result);
            toolResponseContent = `✅ Campanha criada com sucesso! ID: ${result.campaign_id || 'N/A'}. ${result.message || 'Campanha pronta para ativação.'}`;
          }
          // 5. Fazer follow-up call para IA processar o resultado (padrão das outras tools)
          const followUpMessages = [
            ...messages,
            aiMessage,
            {
              role: 'tool',
              tool_call_id: toolCall?.id || 'unknown',
              content: toolResponseContent
            }
          ];
          const followUpResponse = await callOpenAIWithRetry(OPENAI_API_KEY, {
            model: 'gpt-4o-mini',
            messages: followUpMessages,
            temperature: 0.7,
            max_tokens: 2000,
            tools: tools,
            tool_choice: "auto",
            parallel_tool_calls: false
          });
          const followUpData = await followUpResponse.json();
          const followUpResult = getOpenAIMessage(followUpData);
          if (!followUpResult) {
            return new Response(JSON.stringify({
              type: "text",
              response: toolResponseContent,
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          const followUpMessage = followUpResult.message;
          const nextToolCallResult = getFirstToolCall(followUpMessage);
          if (nextToolCallResult) {
            return new Response(JSON.stringify({
              type: "function_call",
              function: nextToolCallResult.name,
              arguments: nextToolCallResult.arguments,
              usage: followUpResult.usage || data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          return new Response(JSON.stringify({
            type: "text",
            response: followUpMessage.content || toolResponseContent,
            usage: followUpResult.usage || data.usage
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          // 6. CAPTURA DE ERRO (O Pulo do Gato)
          // Em vez de deixar o servidor cair, capturamos o erro e devolvemos para IA processar
          console.error("❌ [TOOL ERROR] Falha ao criar campanha:", error);
          console.error("❌ [TOOL ERROR] Stack:", error.stack);
          const errorMessage = error.response?.data?.error?.message || error.message || "Erro desconhecido";
          const errorSubcode = error.response?.data?.error?.error_subcode || error.error_subcode || "N/A";
          const toolResponseContent = `❌ Falha na criação da campanha: ${errorMessage} (Subcode: ${errorSubcode}). Verifique se a conta de anúncios está ativa e se o token é válido.`;
          // Fazer follow-up call mesmo em caso de erro (para IA explicar o erro ao usuário)
          const followUpMessages = [
            ...messages,
            aiMessage,
            {
              role: 'tool',
              tool_call_id: toolCall?.id || 'unknown',
              content: toolResponseContent
            }
          ];
          try {
            const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: followUpMessages,
                temperature: 0.7,
                max_tokens: 2000,
                tools: finalTools,
                tool_choice: "auto",
                parallel_tool_calls: false
              })
            });
            const followUpData = await followUpResponse.json();
            const followUpResult = getOpenAIMessage(followUpData);
            if (!followUpResult) {
              return new Response(JSON.stringify({
                type: "text",
                response: toolResponseContent,
                usage: data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            const followUpMessage = followUpResult.message;
            const nextToolCallResult = getFirstToolCall(followUpMessage);
            if (nextToolCallResult) {
              return new Response(JSON.stringify({
                type: "function_call",
                function: nextToolCallResult.name,
                arguments: nextToolCallResult.arguments,
                usage: followUpResult.usage || data.usage
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json'
                }
              });
            }
            return new Response(JSON.stringify({
              type: "text",
              response: followUpMessage.content || toolResponseContent,
              usage: followUpResult.usage || data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          } catch (followUpError) {
            // Se até o follow-up falhar, retornar erro estruturado
            console.error("❌ [TOOL ERROR] Erro no follow-up:", followUpError);
            return new Response(JSON.stringify({
              type: "text",
              response: toolResponseContent,
              usage: data.usage
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
        }
      }
      // For other functions, return to frontend
      console.log(`⚠️ [LADS-BRAIN] Função não tratada: ${functionName} - retornando como function_call`);
      return new Response(JSON.stringify({
        type: "function_call",
        function: functionName,
        arguments: functionArgs,
        usage: data.usage
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Normal text response
    const aiResponse = aiMessage.content;
    return new Response(JSON.stringify({
      type: "text",
      response: aiResponse,
      usage: data.usage
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ [LADS-BRAIN] Erro geral na Edge Function:', error);
    console.error('❌ [LADS-BRAIN] Stack trace:', error instanceof Error ? error.stack : 'N/A');
    // Determinar tipo de erro e sugerir ação específica
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    let recoveryMessage = '';
    if (errorMessage.toLowerCase().includes('pixel') || errorMessage.toLowerCase().includes('promoted_object')) {
      recoveryMessage = '⚠️ Houve um problema com a seleção do pixel. Quer que eu liste os pixels disponíveis novamente?';
    } else if (errorMessage.toLowerCase().includes('json') || errorMessage.toLowerCase().includes('parse')) {
      recoveryMessage = '⚠️ Não consegui processar sua última mensagem. Pode reformular de outra forma?';
    } else if (errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')) {
      recoveryMessage = '⚠️ Problema de conexão detectado. Tente novamente em alguns segundos.';
    } else if (errorMessage.toLowerCase().includes('token') || errorMessage.toLowerCase().includes('auth')) {
      recoveryMessage = '⚠️ Houve um problema de autenticação. Tente recarregar a página ou reconectar sua conta do Meta.';
    } else if (errorMessage.toLowerCase().includes('account') || errorMessage.toLowerCase().includes('conta')) {
      recoveryMessage = '⚠️ Problema ao acessar a conta de anúncios. Verifique se você selecionou uma conta válida no seletor acima.';
    } else {
      recoveryMessage = '⚠️ Encontrei um problema inesperado. Podemos tentar novamente ou recomeçar esta etapa. O que prefere?';
    }
    // TRATAMENTO DEFENSIVO: Sempre retornar status 200 com erro estruturado (não quebrar o stream)
    return new Response(JSON.stringify({
      type: "text",
      response: `${recoveryMessage}\n\n_Se o problema persistir, tente: (1) Reformular sua mensagem, (2) Clicar no botão de atualizar, ou (3) Recarregar a página._`,
      error: errorMessage,
      error_details: error instanceof Error ? error.stack : null,
      recoverable: true
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}));
