// Classificador heurístico de demandas Shopify.
// Recebe { title, description } e retorna { type, complexity, suggestedSkill, canAutoExecute, suggestedRole, confidence }.
//
// Regras são keyword-based. Performance > acurácia: se não der match, cai em "other" e pede revisão humana.

export const TYPES = [
  'design-creative',  // arte, criativo, banner, folheto, peça de tráfego pago
  'content-copy',     // copy/texto do site, SEO, descrição institucional
  'pricing',          // atualizar preço, compare-at, desconto no pix
  'discount',         // cupom, pague X leve Y
  'theme-fix',        // bug específico no tema (estrela sumiu, barra progresso, etc)
  'theme-config',     // contato, announcement, cores, milestones
  'new-section',      // criar seção nova / copiar de outra loja
  'product-import',   // importar produtos do template
  'product-edit',     // editar produtos existentes (títulos, descrições, variantes)
  'collection',       // coleções (ordenar, criar, corrigir vazia, menu quebrado)
  'page',             // páginas legais, FAQ, institucional
  'image',            // imagens (trocar, reordenar, batch)
  'qa',               // auditoria, quality-gate, compare catalogs
  'deploy',           // deploy loja nova
  'integration',      // Yampi, BK Reviews, apps externos
  'other',            // fallback
];

// Ordem importa: primeira regra que casar vence. Regras mais específicas PRIMEIRO.
const RULES = [
  // Design / criativo (NÃO é Shopify) — prioridade alta pra não cair em pricing/discount
  {
    type: 'design-creative', complexity: 'medium', suggestedSkill: null, canAutoExecute: false, suggestedRole: 'junior',
    patterns: [/\bcriativ[oa]s?\b|\bbanner/i, /\barte(s)? (para|de|do|da)/i, /\bfolheto/i, /cria[çc][aã]o de (arte|imagem|banner|criativ|design)/i, /cria[çc][aã]o em imagem/i, /\bpop[- ]?up\b/i, /design de/i],
  },

  // Content / copy (também NÃO é Shopify de código)
  {
    type: 'content-copy', complexity: 'medium', suggestedSkill: null, canAutoExecute: false, suggestedRole: 'junior',
    patterns: [/subir copy|copy profissional|texto institucion|descri[çc][aã]o institucion|escrever texto|redigir/i],
  },

  // Pricing (trivial, auto-execute) — mais específico agora
  {
    type: 'pricing', complexity: 'trivial', suggestedSkill: 'update-prices', canAutoExecute: true, suggestedRole: 'claude',
    patterns: [
      /\balterar? pre[çc]/i,
      /\bmudar pre[çc]/i,
      /\batualiz[ae]r? pre[çc]/i,
      /\breajust[ae]/i,
      /\btabela de pre[çc]/i,
      /\bpre[çc]o(s)? (incorreto|errad|divergent|de R\$|promocion|novo)/i,
      /\baument[ae]r? (o )?pre[çc]/i,
      /\bR\$\s?\d+\s?(,|\.)?\d*\s*(para|pra|ao inv[eé]s|em vez)/i,
    ],
  },
  {
    type: 'pricing', complexity: 'trivial', suggestedSkill: 'bulk-fix-prices', canAutoExecute: true, suggestedRole: 'claude',
    patterns: [/bater pre[çc]|conferir pre[çc]|auditar pre[çc]|pente fino.*pre[çc]/i],
  },

  // Desconto (mais específico — evita "promoção" genérico)
  {
    type: 'discount', complexity: 'trivial', suggestedSkill: 'create-discount', canAutoExecute: true, suggestedRole: 'claude',
    patterns: [
      /\bcupom\b/i,
      /\bpague\s?\d+\s?leve\s?\d+\b/i,
      /\bleve\s?\d+\s?(e\s?)?pague\s?\d+\b/i,
      /\bbxgy\b|\bbuy\s?x\s?get\s?y\b/i,
      /\bdesconto (no )?pix\b/i,
      /criar desconto|novo desconto/i,
    ],
  },

  // Theme fix (específico — precisa investigação)
  {
    type: 'theme-fix', complexity: 'medium', suggestedSkill: 'lever-theme', canAutoExecute: false, suggestedRole: 'senior',
    patterns: [/estrela|avalia[çc][aã]o|rating|review|barra de progres|progress.?bar|milestone|carrinho|cart drawer|menu mobile|header|footer|anúncio|announcement/i],
  },

  // Theme config (briefing)
  {
    type: 'theme-config', complexity: 'trivial', suggestedSkill: 'configure-theme', canAutoExecute: true, suggestedRole: 'claude',
    patterns: [/configur[ae] tema|contato no rodapé|whatsapp|instagram|anúncio do topo|frete grátis|cor principal|social link/i],
  },

  // Nova section
  {
    type: 'new-section', complexity: 'complex', suggestedSkill: 'code-blocks', canAutoExecute: false, suggestedRole: 'senior',
    patterns: [/criar (nova )?seç[aã]o|nova seção|copi[ae]r seç[aã]o|clonar section|criar bloco|novo block/i],
  },

  // Product import
  {
    type: 'product-import', complexity: 'medium', suggestedSkill: 'import-missing', canAutoExecute: true, suggestedRole: 'claude',
    patterns: [/importar produt|produtos faltando|faltando camisa|copiar produt|template tem mais/i],
  },

  // Product edit em massa
  {
    type: 'product-edit', complexity: 'trivial', suggestedSkill: 'clean-titles', canAutoExecute: true, suggestedRole: 'claude',
    patterns: [/limpar (nome|t[ií]tulo)|retirar marca|nike do t[ií]tulo|adidas do t[ií]tulo|tirar marc/i],
  },
  {
    type: 'product-edit', complexity: 'medium', suggestedSkill: 'bulk-descriptions', canAutoExecute: false, suggestedRole: 'senior',
    patterns: [/descriç[aã]o|padronizar descri|template de descri/i],
  },
  {
    type: 'product-edit', complexity: 'trivial', suggestedSkill: 'dedupe-products', canAutoExecute: true, suggestedRole: 'claude',
    patterns: [/produto duplicad|camisa repetid|dedup|remover repetid/i],
  },
  {
    type: 'product-edit', complexity: 'trivial', suggestedSkill: 'fix-options', canAutoExecute: true, suggestedRole: 'claude',
    patterns: [/tamanho (2GG|3GG|4GG|PP)|op[çc][aã]o padr[aã]o|renomear (tamanho|personaliz)|escassez/i],
  },

  // Collection
  {
    type: 'collection', complexity: 'trivial', suggestedSkill: 'sort-collections', canAutoExecute: true, suggestedRole: 'claude',
    patterns: [/ordenar col|reordenar col|organiz[ae]r col|coleç[aã]o fora de ordem/i],
  },
  {
    type: 'collection', complexity: 'trivial', suggestedSkill: 'fix-empty-collections', canAutoExecute: false, suggestedRole: 'junior',
    patterns: [/coleç[aã]o vazia|smart collection sem produt|col.*n[aã]o popul/i],
  },
  {
    type: 'collection', complexity: 'trivial', suggestedSkill: 'fix-broken-menus', canAutoExecute: false, suggestedRole: 'junior',
    patterns: [/menu quebrad|link (quebrad|[oó]rfão)|item de menu (sumiu|404)/i],
  },

  // Page
  {
    type: 'page', complexity: 'trivial', suggestedSkill: 'create-standard-pages', canAutoExecute: true, suggestedRole: 'claude',
    patterns: [/p[aá]gina (legal|padr[aã]o|FAQ|privacidade|aviso legal|compra segura|entreg[ae])/i],
  },

  // Image (gap — ainda não tem skill, role junior)
  {
    type: 'image', complexity: 'medium', suggestedSkill: null, canAutoExecute: false, suggestedRole: 'junior',
    patterns: [/foto|imagem|trocar (foto|imagem)|batch (de )?imagen|reordenar (foto|imagem)/i],
  },

  // QA
  {
    type: 'qa', complexity: 'trivial', suggestedSkill: 'quality-gate', canAutoExecute: true, suggestedRole: 'claude',
    patterns: [/auditoria|quality gate|radar|sa[úu]de da loja|checar loja/i],
  },

  // Deploy
  {
    type: 'deploy', complexity: 'complex', suggestedSkill: 'deploy-store', canAutoExecute: false, suggestedRole: 'lead',
    patterns: [/deploy (nova )?loja|subir loja|criar loja|replicar template|loja nova/i],
  },

  // Integração
  {
    type: 'integration', complexity: 'complex', suggestedSkill: 'yampi-checkout', canAutoExecute: false, suggestedRole: 'senior',
    patterns: [/yampi|cartpanda|checkout externo/i],
  },
];

export function classify(title, description) {
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  if (!text.trim()) {
    return { type: 'other', complexity: 'unknown', suggestedSkill: null, canAutoExecute: false, suggestedRole: 'lead', confidence: 0, reason: 'vazio' };
  }

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        return {
          type: rule.type,
          complexity: rule.complexity,
          suggestedSkill: rule.suggestedSkill,
          canAutoExecute: rule.canAutoExecute,
          suggestedRole: rule.suggestedRole,
          confidence: 0.7, // heuristica — não é LLM
          matchedPattern: pattern.source.slice(0, 40),
        };
      }
    }
  }

  // Fallback mudou: default vai pro JUNIOR (não lead). User pediu explicitamente
  // pra tirar carga dele. Se for realmente complexo, o LLM sobrescreve pra senior/lead.
  return { type: 'other', complexity: 'unknown', suggestedSkill: null, canAutoExecute: false, suggestedRole: 'junior', confidence: 0.3, reason: 'sem match heurístico — junior por default' };
}

// Load balancing: dada a lista de assignees ativos com contagem de tasks,
// retorna o que tem menos carga no role sugerido.
export function balanceLoad(suggestedRole, teamLoad) {
  // teamLoad: [{ userId, role, activeTasks }, ...]
  const candidates = teamLoad.filter(m => m.role === suggestedRole);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.activeTasks - b.activeTasks);
  return candidates[0];
}
