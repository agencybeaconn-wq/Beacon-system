---
name: code-blocks
description: Copia features entre lojas Shopify com validacao CI/CD. Valida antes de aplicar, so sobe se 100%. Contexto viaja com o codigo.
argument-hint: "copiar [o que] da [loja origem] para [loja destino]"
---

# Code Blocks

Copia features entre lojas Shopify. Funciona de qualquer pasta. Contexto completo: `CONTEXT.md` (mesma pasta).

**De qualquer pasta:** se você está numa pasta de tema (ex: TG-Jerseys-Theme), não tem `.env` nem tokens. Mas o Lever-System tem. Caminho: lê `c:\Users\pedro\OneDrive\Documentos\Lever System\Lever-System\.env` → SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY → buscar tokens no banco. Aplica em arquivos LOCAIS (onde deu theme pull). Colaborador confere e dá `theme push` manual. **Nunca push direto pela skill.**

## Modos operantes (DEFINIR ANTES DE TUDO)

Code-blocks tem 3 modos. **Identificar o modo do pedido ANTES de começar o fluxo.** Se não estiver claro, **perguntar ao Pedro: "modo cópia ou inspiração?"** antes de qualquer ação.

### 🎯 Modo CÓPIA (ctrl+c/ctrl+v)

**Gatilhos:** "replica", "copia", "põe a mesma de X", "igual ao X", "1:1", "propaga"

**Quando:**
- Fonte = **Template** (BR ou EN) — template existe pra ser replicado em N lojas
- Fonte = loja-referência canônica usada como padrão Lever
- Destino aceita config idêntica (mesma brand-family, mesma oferta)
- Fix sistêmico que vai em N lojas igual (ex: handle drift no patch-script)

**Como:** flow padrão (validar → backup → PUT). Adaptações só de **idioma, paths, classes técnicas**.

**Não muda:** textos visíveis, cores, ícones, oferta, política comercial — TUDO igual à fonte.

**Exemplos reais:**
- "Copia cart-drawer do Template BR pra Goal Nations"
- "Replica Kit Casal da JGS na Mega Mantos"
- "Propaga esse fix de handle pra todas as lojas com patch-script"

### 🏺 Modo INSPIRAÇÃO (jarro de barro)

**Gatilhos:** "estilo", "referência", "baseado em", "como X faz", "estrutura igual", "inspirar", "usar X como ref"

**Quando:**
- Loja-destino tem brand/oferta/política **própria** (cliente único, não template-clone)
- Fonte = loja cliente (não template canônico)
- Pedido sugere espírito da feature, não cópia literal

**Como:**
1. **Estudar** a referência — ler, entender o ESPÍRITO da feature (o que faz funcionar lá)
2. **Identificar** mecanismo (técnico, reusável) vs configuração visual (precisa adaptar)
3. **Levantar com Pedro** decisões específicas da loja-destino:
   - Textos comerciais (garantia X ou Y dias? frete política?)
   - Cores da brand (cada loja tem identidade)
   - Ícones que combinam com o vibe
   - Tom/voz da marca
4. **Construir** versão própria — mesmo mecanismo, config visual adaptada ao destino
5. Validar igual (não pode pitfall, não copiar texto/cor sem perguntar)

**Pode copiar:** mecanismo (block type, snippet liquid, schema, classes CSS técnicas, JS)

**NUNCA copia sem perguntar:** textos visíveis, cores hex (exceto regras Lever universais como `#22c55e`), ícones SVG, política comercial, tom de marca

**Exemplos reais:**
- "Usa o PDP da Mantos PH como **referência** em estrutura pra Loja da Torcida"
- "**Estilo** Mantos do PH"
- "Inspira no cart-drawer da JGS pra montar a versão da Footmania"

### 🧩 Modo HÍBRIDO

**Quando:** estrutura técnica é Lever-padrão (reusa) mas brand/textos precisam adaptar.

**Como:** mecanismo do CÓPIA + config visual do INSPIRAÇÃO.

**Exemplo:** copia snippet `cart-item-kit-casal.liquid` 1:1 (mecanismo técnico) mas adapta cor do badge e textos pro contexto da loja.

### Regra de ouro pra decidir

1. **Lê pedido com atenção** — palavras-chave acima
2. **Não tá claro?** Pergunta ao Pedro ANTES de começar
3. **Fonte = Template Lever?** → geralmente **CÓPIA**
4. **Fonte = loja cliente?** → geralmente **INSPIRAÇÃO** ou **HÍBRIDO**
5. **Dúvida persiste?** Default = **INSPIRAÇÃO** (mais seguro, evita retrabalho de ctrl+c errado)

**Contexto histórico:** ver memory `feedback_code_blocks_inspirar_nao_copiar` — bug recorrente que motivou essa formalização (2026-05-14).

## Fluxo

```
0.  HISTORICO     → blocks/history/ tem operação similar? Reusar padrão
1.  NAVEGAR       → lê .env do Lever-System (caminho absoluto)
2.  ABRIR PA      → acessa loja ORIGEM via API
3.  EXTRAI        → código + contexto
3b. VALIDA ORIGEM → validateAll() no source (BLOQUEIA se emoji/pitfall)
4.  GIRAR         → adapta idioma/estrutura pro DESTINO
5.  VALIDA PROPOSTA → validateAll() no .PATCHED (BLOQUEIA, não warning)
6.  PREVIEW       → mostra mudança, espera "sim"
7.  BACKUP        → backupAsset() ANTES do PUT (auto, obrigatório)
8.  APLICAR       → PUT no tema destino
9.  VERIFICA      → re-fetch + validateAll() pós-fetch (BLOQUEIA — se emoji vazou, reverte)
10. PRECO         → se copiou produto: detectPricePattern() + applyPriceToVariants()
11. HISTORICO     → blocks/history/ (OBRIGATORIO)
12. REPORT        → writeReport() em blocks/reports/ (auto, não prosa)
13. CANDIDATO?    → "ficou bom, marcar?"
```

**Forçados:** 3b, 5, 7, 9, 11, 12, 13. **Bloqueiam se `validateAll().pitfalls.length>0`:** 3b, 5, 9. Reverte no 9 se já aplicou.

## Modos de cópia (escolher ANTES — define adaptação e backup)

- **Full file** — substituir `arquivo.liquid` inteiro. Só quando destino não tem customizações próprias (intocado desde deploy).
- **Merge cirúrgico por block_type** (mais comum 2026-04+) — section com `{% schema %}` no destino já tem N block types; extrair do origem só os M faltantes + `{% case block.type %}` correspondentes + splicar no schema. **Schema diff obrigatório** antes de aplicar (block types origem vs destino). Mesmo block type com settings diferentes em ambos = conflito, bloqueia.
- **Inject incremental** — injetar CSS/JS/liquid em arquivo existente (pontos de sutura: antes de `</style>`, dentro de `{%- liquid -%}`, antes de `</cart-drawer>`). Checar chaves/parênteses antes e depois.

**Regra:** nunca substituir arquivo com customizações do destino. Preferir cirúrgico. Full file só em snippets settings-driven não tocados (ex: `cart-progress-bar.liquid`).

## Multi-fonte
Mesma feature em 3+ lojas → backupar todas no mesmo timestamp (`2026-MM-DDa_LOJA_arquivo.bak`) e comparar antes de escolher origem. "Melhor" nem sempre é a mais recente — checar `blocks/history/` pra saber qual foi mais validada.

## Sandbox (`scripts/theme_dump/`)
Convenção obrigatória de sufixos:
- `.LIVE` — snapshot atual da loja (pull fresco). Read-only de referência.
- `.PATCHED` — proposta em construção. Edita livremente. Vai pro PUT.
- `.APPLIED` — pós-PUT (re-fetch). Deve bater com `.PATCHED`. Divergir = falha silenciosa da API.

**NÃO criar** `.FIXED`, `.REVERTED`, `.v2` — vira lixo. Reverter via `backupAsset()`/`restoreAsset()`. Uma pasta por operação: `scripts/theme_dump/LOJA-operacao/`.

## Patches reutilizáveis (`blocks/patches/`)
Scripts de transformação reaproveitáveis. Nomear: `YYYY-MM-DD_categoria_descricao.mjs`. **NÃO** em `c:/tmp/` (cache per-machine). Cabeçalho obrigatório:
```
// Patch: [descrição]
// Origem: [histórico md]
// Aplicável a: [lista de lojas com pré-requisito]
// Pré-requisito: [ex: cart-drawer v3 do Template BR]
```

## Libs compartilhadas (SEMPRE USAR — não reimplementar)
- `code-blocks-validate.mjs` — `validateLiquid()`, `validateJS()`, `validateLeverPitfalls()`, `validateAll()`, **`schemaBlockDiff()`** (merge cirúrgico), **`scanCTAColors()`** (visual)
- `code-blocks-report.mjs` — `generateReport()`, `writeReport()` → `blocks/reports/YYYY-MM-DD_loja_resumo.md`
- `code-blocks-price-match.mjs` — `detectPricePattern()`, `applyPriceToVariants()`, `categorizeByTitle()`
- `code-blocks-backup.mjs` — `backupAsset()`, `restoreAsset()`, `listBackups()`
- `duplicate-signature.mjs` — `signature()`, `findDuplicates()`
- `shopify-api.mjs` — API compartilhada
- `shopify-pricing.mjs` — `categorize()` já trata patches

**Regra dura:** ao escrever .cjs/.mjs temporário, SEMPRE importar dessas libs. Se precisar, estender a lib — não reescrever lógica de categorizar/comparar/detectar/validar.

## Integração com skills (não reimplementar)
Duplicatas no destino → `dedupe-products` · Coleções vazias → `fix-empty-collections` · Menus quebrados → `fix-broken-menus` · Auditoria pós-op → `quality-gate`. Code-blocks FOCA em transferir; outras cuidam de limpeza/validação.

## Identificar origem + destino + extrair + adaptar
- Ler `.env` do Lever-System; `agency_clients?name=ilike.*NOME*` pra buscar AMBOS; pegar id, name, shopify_domain, template_type (BR/EN), moeda, shopify_access_token
- **Tema:** SEMPRE procurar tema com "Lever" no nome (`LEVER | TG Jerseys`, `Tema Lever`, `LEVER EVER [nome]`). NUNCA comparar com tema publicado se não for tema Lever. Sem tema Lever → avisar
- Origem e destino do mesmo idioma? Se não, adaptar
- **Idioma traduzir:** Name↔Nome, Number↔Numero, Qty↔Qtd, FREE↔GRATIS, You save↔Voce economiza, Finalize Purchase↔Finalizar Compra, Customize↔Personalizar, Size↔Tamanho (dicionário completo abaixo)
- **Estrutura:** mapear classes CSS e IDs do destino vs origem
- Capturar do origem: código (Liquid/CSS/JS), arquivo+posição, idioma, comportamento, dependências, cuidados

## Validação (BLOCO 4 — o mais importante)
- **Compatibilidade** — bloco encaixa? (formato da peça)
- **Conflito vs melhoria** — quebra outro (BLOQUEIA) ou substitui melhor (ACEITA)? Melhoria = mesma função + mesmas interfaces + não remove dependências
- **Filtro cascata duplicatas** — se puxa produtos, comparar título com destino. Existente = chutado. NUNCA deixar duplicar
- **Dependências** — faltam variáveis, snippets, sections?
- **Integridade JS/Liquid/CSS** — chaves {}, parênteses (), if/endif, for/endfor, assigns, seletores existem, !important não conflita
- **Idioma** — tudo no idioma do destino
- **Escopo** — só altera o que foi pedido
- **Schema diff** — se tem `{% schema %}`, listar block types; copiar só ausentes; mesmo type com settings diferentes = conflito
- **Visual consistency** — bloco renderiza CTA/button/cor? Scan de hex hardcoded + `var(--*)` cross-check com cart-drawer/checkout/buy-buttons do destino. Cor varia por loja
- **Preserved pitfalls** — se colaborador disse "mantém o layout deles" ou "não mexe em X", pitfalls conhecidos NÃO são corrigidos auto. Registrar no histórico

Resultado: NOVO (100%), MELHORIA (100%), BLOQUEADO (lista problemas).

## Preview + Aplicar + Verificar
Só se validação 100%. Mostrar arquivos/linhas/comportamento. Esperar "sim". Backup antes.

**2 modos de aplicar:**
- Pasta de tema (theme pull): modifica LOCAIS → colaborador confere → theme push manual
- Lever-System (sem tema local): PUT via Shopify API direto → colaborador confere na loja

**Pós-upload SEMPRE verificar:** reler arquivo após PUT, confirmar mudanças. Reportar sucesso só depois.

**⚠️ Subagentes:** Bash BLOQUEADO em background. Usar subagentes SO pra análise/leitura. Execução (rodar .cjs, PUT) SEMPRE na sessão principal.

## Histórico (OBRIGATORIO) + Candidatos
**Após aplicar, salvar em `blocks/history/DATA_LOJA_BLOCO.md`:** operação (data, origem, destino, status), código extraído + adaptações, features/traduções, notas. Log resumido em `blocks/history/LOG.md`. **Sem histórico, bloco não vira candidato.**

**Adendos mesma sessão** — feature ganha iterações no mesmo dia (ex: Mega Mantos 04-16 teve 3 adendos no cart-drawer)? **NÃO criar arquivo novo.** Adicionar `## Adendo YYYY-MM-DD (N) — título` no fim do original. Mantém narrativa linear.

**"Marca como candidato":** salvar em `blocks/candidates/RANKING.md` por categoria (carrinho lateral, personalização, coleções, produto, tema geral) + subcategoria (layout, qty selector, checkout, milestones). Se já tem candidato na mesma categoria → mostrar diff lado a lado, perguntar "substituir #1 ou manter ambos?". Skill NÃO decide ranking. Pra subir pra Template: lê #1 → adapta idioma → valida → aplica se 100%.

## Lições aprendidas (erros reais)

1. **Perguntar ANTES de remover** — na Setor Esportes, removemos Yampi achando que era pra tirar. Era pra consertar. Sempre perguntar: "voce quer manter X ou trocar?"
2. **Buscar a melhor implementacao** — antes de copiar, sugerir: "quer que eu procure qual loja tem a melhor versao disso?"
3. **Historico completo de primeira** — salvar com passo a passo e codigo, nao resumo raso.
4. **Relatorio automatico** — ao final de cada uso, salvar relatorio em blocks/reports/ automaticamente.

## Pitfalls do Tema Lever (validateLeverPitfalls() já checa)

1. **`<a href="/checkout">` em loja com senha** → falha silenciosa. Usar `<button type="submit" name="checkout" form="CartDrawer-Form">`
2. **Classe `button` extra no checkout** → `class="cart__checkout-button button"` conflita com base.css. Manter só `cart__checkout-button`
3. **Hardcoded `icon-shirt` em progress-bar** → ignora `milestone_X_icon` setting. Usar `{% case milestone_X_icon %}`
4. **`encodeURIComponent` em lever-protection** → license com Ç/ã quebra URL. Sempre `encodeURIComponent(licenseKey)`
5. **Filtro `image_url` em URL completa de CDN** → corrompe. URL completa = sem filtro
6. **`});` solto após remoção de bloco JS** → contar chaves antes de deletar
7. **Subagentes têm Bash bloqueado** → análise/leitura só. Execução na sessão principal
8. **Filtro cascata básico não pega variações** → usar `duplicate-signature.mjs` (normaliza ordem, acentos, fillers, sinônimos)
9. **Hardcoded currency cents em cart-drawer BR** → `assign pers_fee = 2000` (R$20) quebra em EN (deveria ser 500 = $5). BR→EN: converter literais ou ler de `pricing.extras.nome_numero`
10. **Cores de CTA inconsistentes entre blocos** — qualquer button/CTA com `var(--color-button)` puxa cor do tema (varia por loja). Scan hex hardcoded + `var(--*)` no novo, cross-check com cart-drawer/checkout/buy-buttons. Verde Lever: `#22c55e` bg / `#16a34a` hover
11. **Emojis em textos visíveis (Lever theme)** — regra da casa: só ícones SVG. Remover 🎁 🔥 💰 🎉 🏆 ao copiar, substituir por `{% render 'icon-gift' %}` etc. Ver memory `feedback_no_emojis_use_icons`.
12. **`$` literal em `String.replace` replacement** — dispara backreferences (`$1`, `$&`). `"R$109"` como replacement explodiu. Usar callback `() => valor` ou escapar `$$`
13. **CRLF (`\r\n`) em asset Shopify (Windows)** — `JSON.parse` de `settings_*.json` falha. Normalizar: `content.replace(/\r\n/g, '\n')`
14. **Scope `read_publications` ausente no token** — produtos importados pela API ficam `status: ACTIVE` mas NÃO publicados na Online Store (storefront mostra placeholder). Verificar scope do token antes de operação que cria produto. Ver memory `feedback_active_vs_published` + `feedback_shopify_publish_collections`.
15. **Properties com prefixo `_` aparecem no checkout custom (Yampi / CartPanda)** — convenção Shopify diz que `properties[_foo]` é privada (não exibida no checkout). Mas checkouts custom NÃO respeitam isso. `properties[_patch_image]`, `properties[_linked_to]`, etc. ficam visíveis no resumo do pedido. Solução: NÃO usar properties auxiliares com `_`. Em vez disso: cachear no `localStorage` (PDP→cart) ou ler do DOM do line item escondido (cart drawer).
16. **Event delegation pra inputs em forma do produto** — Dawn re-renderiza `variant-selects`, removendo listeners diretos. Toggles (Personalizar/Não, patch Sim/Não) precisam de delegation: `document.addEventListener('change', e => e.target.matches('input[name="X"]') && handler())`
17. **Patch como line item separado conta em Bxgy** — Shopify Discount Bxgy contabiliza por quantity nas coleções customerBuys/Gets. Patch (cobra R$50) em coleção indireta (frontpage) **conta como camisa** e ativa "Pague 1 Leve 2" com 1 camisa + 1 patch. Solução: smart collection `Camisas Promo` (regra `tag != excluded-from-promo`) + tagear patches `excluded-from-promo` + `discountAutomaticBxgyUpdate` pra usar SÓ essa coleção. Ver `create-discount` SKILL.md

### Dicionário BR→EN (cart drawer + customization)
| BR | EN | Contexto |
|---|---|---|
| Nome / Número / Posição / Jogador | Name / Number / Position / Player | property keys — DEVEM bater com customization-inputs |
| 'personalizar' / 'com personalização' | 'customize' | option value detection |
| 'Manga' / 'Peito' | 'Sleeve' / 'Chest' | patch position |
| Qtd / Tamanho | Qty / Size | labels |
| GRÁTIS | FREE | badge |
| Camisa | Jersey | breakdown label |
| Personalização | Customization | breakdown label |
| Você está economizando | You're saving | footer message |
| FINALIZAR COMPRA | CHECKOUT | button |
| CONTINUAR COMPRANDO | CONTINUE SHOPPING | empty cart button |
| Seu carrinho está vazio | Your cart is empty | empty state |
| Frete grátis | Free shipping | milestone |
| Diminuir/Aumentar quantidade | Decrease/Increase quantity | aria-label |

## Template de histórico auto-gerado (preencher com dados reais, não perguntar)

```markdown
# Bloco: [nome descritivo]

## Operação
- **Data:** YYYY-MM-DD
- **Origem:** [loja + tema]
- **Destino:** [loja + tema]
- **Idioma:** BR/EN
- **Validação:** [100% | erros listados]
- **Status:** [Aplicado | Falhou | Parcial]

## Arquivos tocados
| Arquivo | Antes | Depois | Diff |
|---|---|---|---|
| ... | N linhas | M linhas | +/-K |

## Features adicionadas
[lista]

## Traduções feitas
[se origem idioma != destino]

## Erros encontrados durante execução
[do validateAll + tentativas falhadas]

## Lições / candidato?
[livre]
```

## Regras

1. Nada pré-definido — colaborador aponta origem + destino + o que copiar
2. Validação obrigatória — só aplica se 100%
3. Compatibilidade — blocos são peças de quebra-cabeça, formato deve encaixar
4. Melhorias aceitas — mesma peça melhor pode subir
5. Conflitos bloqueiam — formato diferente não sobe
6. Contexto viaja com código — bloco = código + história + lições
7. Ler destino antes — nunca copiar cego
8. Adaptar idioma — sempre checar PT vs EN
9. Só colaborador decide — Template, candidatos, ranking
10. Backup antes de modificar
11. **BR e EN nunca se misturam** (ver CLAUDE.md L65) — loja BR → Template BR; loja EN → Template EN
12. **Dados únicos por cliente — NUNCA copiar:** preços (price, compare_at), tokens, domínio, theme/collection/variant IDs, imagens CDN, contato, logo, redes sociais, frete, moeda, announcement bar, metafield valores. **PODE copiar:** produtos (maioria usa Template, sem preços — aplicar depois via `/bulk-fix-prices`) e estoque
13. **Filtro cascata anti-duplicatas (AGGRESSIVE)** — ao transferir/importar produtos, signature normalization:
    1. lowercase + remove acentos
    2. anos: `2026/27` → `2627`, `2025/2026` → `2526`, `11/12` → `1112`
    3. remover pontuação → espaços
    4. remover fillers: `adidas, nike, puma, umbro, mizuno, jordan, kappa, castore, macron, camisa, camiseta, conjunto, kit, de, do, da, masculina, masculino, m, home, treino, pre, jogo`
    5. canonicalizar sinônimos: `primeira/1/home → i`, `segunda/2/away → ii`, `terceira/3/third → iii`, `feminino/fem → feminina`, `jogador/player/authentic → jogador`, `torcedor/fan/tor → torcedor`, `infantil/kids → infantil`
    6. ordenar tokens alfabéticamente + dedupe + join `-`
    7. mesma signature = DUPLICATAS (manter o mais antigo)
    **Atenção:** filtro pode ser agressivo demais — "Camisa Treino X" e "Conjunto Treino X" viram mesma signature mas são diferentes (camisa vs kit). Revisar antes de deletar em massa
14. **Validação de fotos** — ao transferir produtos, comparar fotos:
    - Buscar por **fragmentos curtos** (corin, retr, femin) — pega typos. Memory `feedback_search_fragments`
    - **Todas** as imagens, não só a primeira. Usar `baseImg()`: strip UUID suffix (`_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) pra comparar conteúdo real
    - Camisa I=home (clara), II=away (escura), III=alternativa. Foto da I mostra escura → ERRADA
    - Títulos diferem? Match manual: trocar season (2024/25→2025/26), adicionar/remover "Torcedor"/"Nike", inverter ordem
    - Foto compartilhada entre produtos diferentes (ex: Retrô 2009 e 2011 mesma foto) = FAIL
    - Feminino com foto masculina, infantil com foto adulta = FAIL
    - Listar erros, **nunca corrigir sem confirmação**
15. **Pipeline de validação cruzada** — skills não trabalham isoladas. Ao executar uma que modifica produtos, validar com as relacionadas antes de considerar concluído:
    ```
    import-missing → fix-photos → bulk-fix-prices → fix-options → audit-store
         │              │              │                │             │
      produtos       imagens        preços          variantes    verifica tudo
    ```
    - `import-missing` importou? → `fix-photos` checa se fotos vieram certas
    - `fix-photos` corrigiu? → `bulk-fix-prices` checa se preços não foram achatados (respeitar acréscimos: Personalização +R$30, 2GG/3GG/4GG +R$10)
    - `bulk-fix-prices` ajustou? → `fix-options` checa se variantes/opções estão padronizadas
    - Qualquer skill terminou? → `audit-store` roda como verificação final
    - **Cada skill reporta o que fez.** A próxima na pipeline usa esse report como input. Se uma falhou, as seguintes sabem e não propagam o erro.
    - **Custo-benefício:** NÃO rodar a pipeline inteira sempre. Só validar o que a skill anterior tocou. Ex: `import-missing` importou 5 produtos? → `fix-photos` checa SÓ esses 5, não a loja toda. `bulk-fix-prices` ajustou preços? → `fix-options` checa SÓ os produtos que tiveram preço alterado. Escopo mínimo, máximo resultado. `audit-store` completo só quando colaborador pedir explicitamente.

Processe $ARGUMENTS conforme acima.
