// gemini-classifier — chama edge function supabase/functions/gemini-ai pra classificar demandas.
//
// Output schema validado contra shape da triage V2.

import https from 'https';

const SYSTEM_PROMPT = `Você é a TRIAGEM AUTOMÁTICA de demandas de uma agência Shopify (Lever Agency).
Sua função é ler a demanda de um cliente e classificar pra direcionar pro dev certo (Pedro junior, Felipe senior, você lead) ou executar automaticamente via Claude Code.

SKILLS DISPONÍVEIS (31 total):
- update-prices: atualiza preços a partir de texto livre (WhatsApp/briefing)
- bulk-fix-prices: audita e corrige preços vs banco do cliente
- fix-compare-at: aplica/corrige compare_at_price (preço "de") em massa
- create-discount: cria cupons BXGY (Pague X Leve Y) na Shopify
- lever-theme: edita tema Lever (pull/edit/preview/push)
- configure-theme: configura contato, announcement, cores via briefing
- code-blocks: copia feature entre lojas com validação CI/CD
- dedupe-products: remove produtos duplicados
- import-missing: importa produtos faltantes do template
- clean-titles: remove marcas (Nike/Adidas) dos títulos
- bulk-descriptions: edita descrições em massa
- duplicate-variants: copia variantes entre produtos
- batch-images: reordena/substitui/dedupe imagens em massa
- fix-options: padroniza tamanhos (2GG/3GG/4GG)
- sort-collections: ordena produtos nas coleções
- fix-empty-collections: trata coleções vazias
- fix-broken-menus: remove links órfãos do menu
- create-standard-pages: páginas legais padrão
- deploy-store: deploy completo de loja nova
- audit-store: auditoria completa (17 checks)
- quality-gate: radar de saúde da loja
- compare-catalogs: diff estrutural entre lojas
- yampi-checkout: integração Yampi
- triage: você

ROLES:
- claude: auto-execução (só demandas TRIVIAIS e SEGURAS — preço específico, dedupe, sort, clean titles)
- junior: Pedro (em treinamento). Demandas medium guiadas com skill clara.
- senior: Felipe/João Vithor. Theme-fix, investigação, integrações, demandas complexas.
- lead: Você. Só estratégico (deploy nova loja, integrações novas, crises). EVITAR.

REGRA DE OURO: TIRE DEMANDA DO LEAD SEMPRE QUE POSSÍVEL. Se der pra mandar pro Pedro com perguntas no lugar, FAÇA.

Sua tarefa é retornar JSON EXATO (sem markdown, sem explicação fora do JSON):

{
  "type": "pricing | discount | theme-fix | theme-config | new-section | product-import | product-edit | collection | page | image | qa | deploy | integration | design-creative | content-copy | other",
  "complexity": "trivial | medium | complex",
  "suggestedSkill": "nome-da-skill-ou-null",
  "canAutoExecute": true | false,
  "suggestedRole": "claude | junior | senior | lead",
  "confidence": 0.0-1.0,
  "readinessScore": 0-100,
  "missingInfo": ["Pergunta específica 1?", "Pergunta específica 2?"],
  "blockers": ["Gargalo 1", "Gargalo 2"],
  "suggestedNextSteps": ["Passo 1 acionável", "Passo 2 acionável"],
  "reasoning": "2-3 frases explicando a decisão"
}

REGRAS:
- Se demanda é clara + skill existe + seguro → canAutoExecute: true, role: claude, readinessScore 90+
- Se demanda é clara mas exige revisão humana → role: junior, readinessScore 70+
- Se demanda é vaga → MISSINGINFO com perguntas ESPECÍFICAS (não genéricas). Role default junior, readinessScore < 50
- blockers: gargalos REAIS, não genéricos. Ex: "Template BR não tem times da NBA" > "Pode ter bloqueios"
- suggestedNextSteps: acionáveis por uma pessoa em 1 dia. Max 3 itens.
- Design/banner/criativo/copy → NUNCA canAutoExecute. Role junior.
- Demandas de "deploy nova loja" ou "integração custom" → role lead.
`;

/**
 * Chama Gemini direto (API pública) — não precisa de Supabase auth.
 * Requer GEMINI_API_KEY no env.
 */
function callGeminiDirect(prompt, apiKey) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 2048, topP: 0.95 },
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 45000,
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(b);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (!text) return reject(new Error('Gemini retornou sem texto: ' + JSON.stringify(parsed).slice(0, 300)));
          resolve(text);
        } catch (e) { reject(new Error('Erro parseando Gemini: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Gemini timeout 45s')));
    req.write(body);
    req.end();
  });
}

/**
 * Chama via edge function supabase (fallback — requer auth JWT ou service role).
 */
function callGeminiEdge(prompt, env) {
  const token = process.env.SB_SECRET || env.VITE_SUPABASE_ANON_KEY;
  const body = JSON.stringify({ action: 'analyze', prompt, temperature: 0.3, maxTokens: 2048 });
  return new Promise((resolve, reject) => {
    const host = env.VITE_SUPABASE_URL.replace(/https?:\/\//, '').replace(/\/$/, '');
    const req = https.request({
      hostname: host, path: '/functions/v1/gemini-ai', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'apikey': token },
      timeout: 45000,
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(b);
          const text = parsed.text || parsed.result?.text || '';
          if (!text) return reject(new Error('Edge function retornou vazio: ' + b.slice(0, 200)));
          resolve(text);
        } catch (e) { reject(new Error('Erro parseando edge: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Edge timeout 45s')));
    req.write(body);
    req.end();
  });
}

/**
 * @param {object} demand - { title, description, clientName? }
 * @param {object} env - { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY }
 * @returns {Promise<object>} triage_result
 */
export async function classifyWithGemini(demand, env) {
  const userPrompt = `DEMANDA:
Cliente: ${demand.clientName || 'N/A'}
Título: ${demand.title || ''}
Descrição: ${demand.description || ''}
Área (self-reported): ${demand.area || 'N/A'}
Prioridade (cliente): ${demand.client_priority || 'normal'}

Classifique segundo o shape JSON. Retorne APENAS o JSON, sem markdown.`;

  const fullPrompt = SYSTEM_PROMPT + '\n\n---\n\n' + userPrompt;

  // Preferência: chama Gemini direto (sem auth Supabase) se GEMINI_API_KEY setado
  const geminiKey = process.env.GEMINI_API_KEY;
  let text;
  if (geminiKey) {
    text = await callGeminiDirect(fullPrompt, geminiKey);
  } else {
    text = await callGeminiEdge(fullPrompt, env);
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM não retornou JSON válido: ' + text.slice(0, 200));
  const triageJson = JSON.parse(jsonMatch[0]);
  return {
    ...triageJson,
    classifier: 'llm',
    classifiedAt: new Date().toISOString(),
  };
}

/**
 * Merge heurística + LLM. Gemini ganha quando confidence > 0.75.
 */
export function mergeTriage(heuristic, llm) {
  if (!llm) return { ...heuristic, classifier: 'heuristic' };
  if (llm.confidence != null && llm.confidence > 0.75) {
    return {
      ...llm,
      // Preserva heuristic fields se LLM não trouxe
      type: llm.type || heuristic.type,
      complexity: llm.complexity || heuristic.complexity,
      suggestedSkill: llm.suggestedSkill || heuristic.suggestedSkill,
      canAutoExecute: llm.canAutoExecute ?? heuristic.canAutoExecute,
      suggestedRole: llm.suggestedRole || heuristic.suggestedRole,
      missingInfo: llm.missingInfo || [],
      blockers: llm.blockers || [],
      suggestedNextSteps: llm.suggestedNextSteps || [],
    };
  }
  // LLM não confiante → usa heurística mas anexa missing info se vieram
  return {
    ...heuristic,
    missingInfo: llm.missingInfo || [],
    blockers: llm.blockers || [],
    suggestedNextSteps: llm.suggestedNextSteps || [],
    reasoning: llm.reasoning,
    classifier: 'hybrid',
  };
}
