/**
 * crm-generate-greeting — Edge Function
 *
 * Deep module (JEB: Deep Modules vs Shallow). Interface estreita:
 *   POST { leadId: string } → { message: string, model: string }
 *
 * Internamente:
 * - Auth do user via JWT do Authorization header.
 * - Busca o lead inteiro via service_role (front nao precisa enviar contexto).
 * - Monta prompt com persona da skill heloisa-reply (.claude/skills/heloisa-reply).
 * - Chama Gemini primeiro (mais estavel em prod). Fallback pra Claude.
 * - Logs estruturados de cada step pra debug rapido em get_logs.
 *
 * Por que dedicada e nao reusar claude-ai/gemini-ai genericas:
 * - Persona da Heloisa eh especifica desse caso. Centralizar aqui evita
 *   espalhar prompt pelo front (anti-padrao JEB).
 * - Interface so precisa do leadId — toda complexidade (busca, prompt, IA,
 *   fallback) fica escondida. Cliente do endpoint (front) tem 1 chamada.
 * - Falha de provider IA fica isolada — Gemini fora? Claude assume sem o
 *   front saber.
 */

import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Persona da Heloisa baseada em .claude/skills/heloisa-reply/SKILL.md + catalog.md.
// Sincronizar este bloco quando a skill for atualizada — fonte canonica continua
// sendo o markdown do skill. Mensagem visa abrir conversa de forma calorosa e
// especifica ao cenario do lead, NUNCA generica.
const HELOISA_SYSTEM = `Voce e a Heloisa, SDR + atendente da Beacon Agency. Sua mensagem AGORA e a PRIMEIRA mensagem WhatsApp pra um lead novo do funil comercial. Lead acabou de subir pra etapa "1o Contato" — ele NAO te conhece ainda, voce esta entrando em contato.

═══ Quem e a Beacon ═══
Agencia referencia em ecommerce, com forca em camisa de futebol no Brasil. Atende multiplos nichos (moda, suplemento, eletronico, joia, retro). Lojas que rodam com a gente: Mantos do PH, TRAVE, Voltz Club, Loja da Torcida, Retro Football Shop, Mega Manto, Diario Stores, Golaco, Boutique do Boleiro, Coringao Shop.

═══ Sua persona ═══
SDR + atendente. Fala como gente no zap, nao como bot. Curta, contextual, calorosa SEM SER MELOSA. Voce ja viu o cadastro do lead — usa isso pra mostrar que vc OUVIU/ENTENDEU o cenario dele em vez de mandar generico.

═══ ESTRUTURA DA MENSAGEM (4 blocos obrigatorios, NESSA ORDEM) ═══

[1] **Saudacao + apresentacao** (1 linha):
    "Oi <primeiro nome>, tudo bem? Aqui e a Heloisa da Beacon."

[2] **Reconhecimento do cenario dele** (1-2 linhas):
    Mostra que voce LEU o cadastro. Cita 1-2 detalhes especificos:
    - Se tem store_name: "Vi aqui que vc ta tocando a <store_name>"
    - Se tem vertente clara: "Vi que o foco e <vertente>"
    - Se tem faturamento: NAO cita o valor literal — usa como pista de maturidade
    - Se tem observations com historico: parafraseia 1 detalhe relevante
    Se faltar contexto, abre com sondagem suave: "Vi que vc preencheu o form, queria entender melhor o cenario contigo"

[3] **Prova social CONTEXTUAL ao nicho** (1 linha, OPCIONAL):
    So inclui se o nicho/vertente bate. Exemplos:
    - Camisa/futebol/manto/jersey: "A gente toca aqui Mantos do PH, Diario Stores, Brasileirissimo, varias lojas do nicho que ja vc deve ter visto por ai"
    - Moda em geral: "A gente atende varias lojas de moda no Brasil"
    - Sem nicho claro: PULA esse bloco
    NUNCA inventa loja — usa SO as do catalogo acima.

[4] **CTA conversacional** (1 linha):
    Puxa pra dialogo, NAO pra call ainda. Ex:
    - "Posso te perguntar como ta hoje a operacao? <pergunta contextual>"
    - "Me conta mais sobre o momento, vc ja ta vendendo ou tocando do zero?"
    - "Curti aqui pelo que vi do cadastro — me explica melhor como ta tocando isso ai?"
    A pergunta tem que ser ESPECIFICA ao que voce sabe do lead, nao roteiro padrao.

═══ Resultado esperado: 4-6 linhas no total. Calorosa, especifica, sem enrolar. ═══

═══ REGRAS DE TOM (TODAS obrigatorias) ═══
- Portugues falado de WhatsApp: "ta", "vc", "pra", "to", "tava". Sem corporate.
- Apresentacao 1x so — nunca repete "Heloisa da Beacon".
- ZERO emoji. (Excecao: so se o lead usou emoji primeiro — nao e o caso aqui.)
- ZERO travessao (—), ZERO reticencias (...), ZERO parenteses explicativos, ZERO dois-pontos exceto em URL. Use VIRGULA no lugar.
- NUNCA "Ola, espero que esteja bem". NUNCA "Tudo bem com voce?". Direto.
- NAO oferte call agora. NAO pergunte gargalo se nivel for zero ("comecando do zero"). NAO mande valor. Aqui e abertura, nao venda.
- Pergunta diagnostica = 1 so. Nada de metralhar.

═══ EXEMPLOS DE BOA MENSAGEM ═══

Exemplo 1 (lead com store_name + vertente camisa):
"""
Oi Bruno, tudo bem? Aqui e a Heloisa da Beacon.
Vi aqui que vc ta tocando a Camisaria do Esporte, focada em camisa de time. A gente toca varias lojas do nicho aqui, Mantos do PH, Brasileirissimo, Diario, vc deve ter visto por ai.
Me conta como ta o momento, vc ja ta vendendo ou ainda estruturando a operacao?
"""

Exemplo 2 (lead sem loja, observations dizendo "iniciando"):
"""
Oi Francis, tudo bem? Aqui e a Heloisa da Beacon.
Vi aqui no cadastro que vc ta comecando a estruturar a operacao agora, ainda sem loja rodando. Curti que vc ja foi correr atras.
Me conta um pouco mais, qual o nicho que vc quer atacar e ja tem alguma estrutura inicial ou e do zero mesmo?
"""

Exemplo 3 (lead com lead_status "Reativacao" + observations historico):
"""
Oi Matias, tudo bem? Aqui e a Heloisa da Beacon de novo.
Voltei aqui pra continuar nossa conversa, vi que ficou pendente desde a ultima vez que falamos sobre site novo. Tava tudo certo daquela vez ou vc ja tomou outro rumo?
Me conta como ta agora, posso te ajudar a destravar isso ou vc ja resolveu por outro lado?
"""

═══ Sua resposta ═══

Responda APENAS com o texto que vai pro WhatsApp. Sem aspas envolvendo, sem "aqui esta", sem explicacao, sem assinatura.`

function buildUserPrompt(lead: Record<string, any>) {
    const ctx = {
        nome: lead.name,
        empresa: lead.store_name || null,
        vertente: lead.product_interest || null,
        faturamento: lead.revenue || null,
        site: lead.site_url || null,
        etapa_funil: lead.lead_status || null,
        temperatura: lead.lead_score || null,
        tipo_projeto: lead.project_type || null,
        prazo: lead.project_timeline || null,
        orcamento: lead.budget_range || null,
        oferta_em_jogo: lead.offer_detail || null,
        observacoes: lead.observations || null,
    }
    return `Contexto do lead (campos vazios = ignore):\n${JSON.stringify(ctx, null, 2)}\n\nGere a mensagem.`
}

async function tryGemini(userPrompt: string): Promise<{ text: string; model: string } | null> {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
        console.log('[crm-generate-greeting] GEMINI_API_KEY ausente, pulando Gemini')
        return null
    }
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: HELOISA_SYSTEM }] },
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                // 1500 tokens = ~1100 palavras, folga grande pra mensagem de 4-6 linhas.
                // O bug da sessao anterior era cortar em ~50 chars; eleva pra ter certeza
                // que nao e MAX_TOKENS.
                generationConfig: { temperature: 0.8, maxOutputTokens: 1500 },
            }),
        })
        if (!res.ok) {
            const errText = await res.text()
            console.warn(`[crm-generate-greeting] Gemini ${res.status}: ${errText.slice(0, 500)}`)
            return null
        }
        const body = await res.json() as any
        const candidate = body?.candidates?.[0]
        const finishReason = candidate?.finishReason
        // Concatena TODAS as parts (Gemini pode quebrar em multiplas).
        const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []
        const text: string = parts.map((p: any) => p?.text || '').join('').trim()

        if (!text) {
            console.warn(`[crm-generate-greeting] Gemini vazio. finishReason=${finishReason} body=${JSON.stringify(body).slice(0, 500)}`)
            return null
        }
        if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
            // SAFETY, RECITATION, OTHER — resposta nao confiavel
            console.warn(`[crm-generate-greeting] Gemini finishReason ruim: ${finishReason}. Tentando fallback Claude.`)
            return null
        }
        if (finishReason === 'MAX_TOKENS') {
            console.warn(`[crm-generate-greeting] Gemini truncou em MAX_TOKENS (${text.length} chars). Devolve assim mesmo mas alerta.`)
        }
        return { text, model: 'gemini-2.5-flash' }
    } catch (err: any) {
        console.warn('[crm-generate-greeting] Gemini exception:', err?.message)
        return null
    }
}

async function tryClaude(userPrompt: string): Promise<{ text: string; model: string } | null> {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
        console.log('[crm-generate-greeting] ANTHROPIC_API_KEY ausente, pulando Claude')
        return null
    }
    const candidates = ['claude-haiku-4-5-20251001', 'claude-3-5-haiku-20241022', 'claude-3-5-haiku-latest']
    for (const model of candidates) {
        try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    max_tokens: 1500,
                    temperature: 0.8,
                    system: HELOISA_SYSTEM,
                    messages: [{ role: 'user', content: userPrompt }],
                }),
            })
            if (!res.ok) {
                const errText = await res.text()
                console.warn(`[crm-generate-greeting] Claude ${model} ${res.status}: ${errText.slice(0, 300)}`)
                continue
            }
            const body = await res.json() as any
            const block = Array.isArray(body.content) ? body.content.find((b: any) => b?.type === 'text') : null
            const text: string = (block?.text || '').trim()
            if (!text) {
                console.warn(`[crm-generate-greeting] Claude ${model} retornou vazio`)
                continue
            }
            return { text, model }
        } catch (err: any) {
            console.warn(`[crm-generate-greeting] Claude ${model} exception:`, err?.message)
        }
    }
    return null
}

Deno.serve(instrument("crm-generate-greeting", async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // AUTH — exige JWT do usuario logado
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || supabaseService)
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    try {
        const { leadId } = await req.json() as { leadId?: string }
        if (!leadId) {
            return new Response(JSON.stringify({ error: 'leadId obrigatorio' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Busca lead com service_role (front nao precisa mandar contexto)
        const supabase = createClient(supabaseUrl, supabaseService)
        const { data: lead, error: leadErr } = await supabase
            .from('crm_leads')
            .select('id, name, store_name, phone, email, site_url, revenue, lead_score, product_interest, lead_status, project_type, project_timeline, budget_range, offer_detail, observations, workspace_id')
            .eq('id', leadId)
            .single()

        if (leadErr || !lead) {
            console.error('[crm-generate-greeting] Lead nao encontrado:', leadId, leadErr?.message)
            return new Response(JSON.stringify({ error: 'Lead nao encontrado' }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        if (!lead.name) {
            return new Response(JSON.stringify({ error: 'Lead sem nome — preencha antes de gerar' }), {
                status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        console.log(`[crm-generate-greeting] Gerando saudacao pra lead ${lead.id} (${lead.name})`)
        const userPrompt = buildUserPrompt(lead)

        // Tenta Gemini primeiro (mais estavel em prod hoje). Fallback Claude.
        let result = await tryGemini(userPrompt)
        if (!result) {
            console.log('[crm-generate-greeting] Gemini falhou, tentando Claude')
            result = await tryClaude(userPrompt)
        }

        if (!result) {
            return new Response(JSON.stringify({
                error: 'Nenhum provider de IA disponivel no momento. Veja logs da edge function.',
            }), {
                status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        console.log(`[crm-generate-greeting] OK via ${result.model} (${result.text.length} chars)`)
        return new Response(JSON.stringify({
            message: result.text,
            model: result.model,
        }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (err: any) {
        console.error('[crm-generate-greeting] Erro inesperado:', err?.message, err?.stack)
        return new Response(JSON.stringify({ error: err?.message || 'Erro desconhecido' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
}))
