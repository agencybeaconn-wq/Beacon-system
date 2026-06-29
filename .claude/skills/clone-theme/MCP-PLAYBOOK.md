# MCP Playwright Playbook — `clone-theme` interativo

Este playbook descreve **o que Claude faz** quando o user pede pra clonar uma loja e o MCP `mcp__playwright__*` está disponível na sessão.

**Quando usar:** sempre que tiver MCP Playwright disponível. Augmenta (não substitui) os scripts standalone — eles continuam rodando, mas a inspeção interativa SUBSTITUI/REFORÇA detector + discovery + audit visual.

**Quando NÃO usar:** em scripts CI/background, ou se o user pediu pipeline 100% automático sem refinamento.

---

## Fase A — INSPEÇÃO INICIAL (substitui parte do `clone-detect-platform`)

Quando user cola URL, ANTES de rodar qualquer script:

```
1. mcp__playwright__browser_navigate <url>
2. mcp__playwright__browser_wait_for { time: 2 }
3. mcp__playwright__browser_network_requests
4. mcp__playwright__browser_console_messages
5. mcp__playwright__browser_evaluate { function: "() => ({
     hasShopify: !!window.Shopify,
     hasNextData: !!window.__NEXT_DATA__,
     hasNuxt: !!window.__NUXT__,
     hasWix: !!window.__WIX_RUNTIME__,
     hasBC: !!window.BCData,
     hasMagento: !!window.checkoutConfig,
     generator: document.querySelector('meta[name=generator]')?.content,
     bodyClasses: document.body.className,
     productEndpoints: performance.getEntriesByType('resource')
       .filter(r => /products|catalog|api/.test(r.name))
       .map(r => r.name)
   })" }
6. mcp__playwright__browser_take_screenshot { filename: 'home.png' }
```

**Output esperado pra Claude reportar pro user:**
- Plataforma detectada com confidence alta
- Endpoints de produto identificados (qual chamar pro normalize)
- Console errors visíveis (pista de problemas no alvo)
- Framework (Next/Nuxt/Vue) detectado → ajusta estratégia de scrape

---

## Fase B — DISCOVERY INTERATIVO (complementa `clone-discover`)

Captura URLs ocultas atrás de interação:

```
1. mcp__playwright__browser_snapshot           # captura accessibility tree atual
2. Identifica menu items com submenu (role="menubar", aria-haspopup)
3. Pra cada item:
   - mcp__playwright__browser_hover <item>
   - mcp__playwright__browser_wait_for { time: 0.5 }
   - mcp__playwright__browser_snapshot
   - Coleta novos links que apareceram
4. mcp__playwright__browser_evaluate { function: "() => [...document.querySelectorAll('a[href]')].map(a => a.href)" }
5. Filtra por padrão (products/, collections/, etc) — gera lista pra clone-scrape
```

**Ganho:** lojas com mega-menu (Lucky Fours, lojas premium) revelam 2-3x mais URLs do que parsing estático do HTML.

---

## Fase C — SCRAPE DE SPA (substitui scrape pra Next/Nuxt/Vue)

Quando Fase A detectou framework moderno:

```
1. mcp__playwright__browser_navigate <plp_url>
2. mcp__playwright__browser_wait_for { text: "Add to cart" }    # espera hidratação real
3. mcp__playwright__browser_evaluate { function: "async () => {
     // Força lazy load de todos os cards
     for (let i = 0; i < 10; i++) {
       window.scrollTo(0, document.body.scrollHeight);
       await new Promise(r => setTimeout(r, 800));
     }
     // Tenta clicar em 'Load more' se existir
     const btn = [...document.querySelectorAll('button')].find(b => /load more|ver mais|carregar/i.test(b.textContent));
     if (btn) { btn.click(); await new Promise(r => setTimeout(r, 1500)); }
     return document.querySelectorAll('[data-product-id], .product-card, [class*=\\\"ProductCard\\\"]').length;
   }" }
4. mcp__playwright__browser_snapshot              # accessibility tree completa
5. mcp__playwright__browser_take_screenshot { fullPage: true }
6. Extrai products do snapshot via regras semânticas
```

**Ganho:** captura ~80% dos produtos em SPAs (vs 30-40% do scrape estático).

---

## Fase D — VALIDAÇÃO PÓS-UPLOAD (substitui parte do `clone-self-heal`)

Depois que user fez upload do ZIP e tem preview URL:

```
1. mcp__playwright__browser_navigate <preview_url>
2. mcp__playwright__browser_wait_for { time: 3 }
3. mcp__playwright__browser_console_messages      # captura erros Liquid runtime
4. mcp__playwright__browser_network_requests      # vê 404s de assets
5. mcp__playwright__browser_evaluate { function: "() => ({
     hasError: !!document.querySelector('.error, [class*=\\\"error\\\"]'),
     liquidError: document.body.innerText.includes('Liquid error'),
     missingAssets: [...document.querySelectorAll('img')].filter(img => img.naturalWidth === 0).map(img => img.src),
   })" }
6. Pra cada erro encontrado:
   - Identifica arquivo Liquid responsável
   - Roda fix via Edit
   - Re-sincroniza via _sync-targeted.mjs
   - Volta pro passo 1
```

**Ganho:** self-heal REATIVO (vê o que tá quebrado no preview), não só estático. Pega erros Liquid runtime que `theme check` não detecta.

---

## Fase E — AUDIT VISUAL SEMÂNTICO (substitui `clone-audit-visual`)

Em vez de só gerar screenshots side-by-side, EU comparo:

```
1. Pra cada rota (home, pdp, plp, cart):
   - mcp__playwright__browser_navigate <target_url>
   - mcp__playwright__browser_take_screenshot { filename: 'target.png' }
   - mcp__playwright__browser_navigate <clone_url>
   - mcp__playwright__browser_take_screenshot { filename: 'clone.png' }
2. Read target.png + Read clone.png  ← eu (Claude) leio as duas imagens
3. Comparo semanticamente:
   - "Header: alvo tem fundo transparente sobre banner; clone tem fundo sólido verde"
   - "Cards: alvo usa aspect-ratio 1:1; clone está 4:5"
   - "Hero: alvo tem overlay escuro 40%; clone sem overlay"
   - "Botão CTA: alvo é arredondado 100px; clone tem border-radius 4px"
4. Gero relatório de divergências PRIORIZADAS (criticidade visual)
5. Pra cada divergência crítica, proponho fix concreto (CSS variable + sync)
```

**Ganho enorme:** feedback acionável e SEMÂNTICO, não pixel-diff. Em 5 min eu identifico o que humano levaria 30 min comparando.

---

## Quando NÃO usar MCP Playwright

| Cenário | Use Node Playwright (script standalone) |
|---|---|
| User pediu pipeline 100% automatizado sem chat | `clone-theme.mjs <url> --slug X` |
| Scrape de catálogo grande (100+ produtos paralelos) | Node Playwright via clone-scrape (paralelizável) |
| Background job em CI/cron | Node Playwright (não precisa Claude rodando) |
| Audit visual em lote (10+ lojas) | Node Playwright (paralelo) |

## Quando SEM dúvida usar MCP Playwright

| Cenário | Por quê |
|---|---|
| User cola URL nova e pede "clona pra mim" | Fase A em 30s → diagnóstico antes de gastar 5 min em scripts |
| Detector estático retornou platform=unknown | Inspeção interativa resolve |
| Self-heal reportou orphan refs misteriosos | Navego no preview e vejo o erro real |
| User pergunta "tá bom?" depois do upload | Fase E me dá relatório semântico em 2 min |
| Loja é SPA (Next/Nuxt/Vue detectado) | Fase C captura conteúdo que scrape estático perde |

---

## Integração com scripts standalone

MCP Playwright NÃO substitui os scripts. O fluxo recomendado quando rodo a skill interativamente:

```
1. user cola URL
2. EU rodo Fase A (MCP Playwright) — 30s, gera diagnóstico
3. EU decido baseado no diagnóstico:
   - Plataforma conhecida + estática → roda pipeline standalone direto
   - SPA / framework moderno → faço Fase C antes do scrape standalone
   - Plataforma unknown → faço Fase B + Fase A profunda antes
4. user roda clone-theme.mjs <url> --slug X
5. Após assemble + self-heal estáticos, EU rodo Fase D (preview) e Fase E (audit visual)
6. Reporto divergências + sugiro fixes
```

Tempo total interativo: ~15-20 min (vs ~12 min standalone + 30+ min de refino humano manual).
**Fidelidade final esperada: 95%+ para qualquer plataforma** (vs 60-85% standalone-only).
