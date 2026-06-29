# Diário — Agente Catálogo

> Cérebro persistente. Cada operação de catálogo registra entrada aqui.

## Como ler
- Ordem cronológica reversa
- Filtrar por loja (Ctrl+F nome) ou tipo (#precos, #produtos, #colecoes, #cupom)

## Fontes que alimentaram este cérebro (Fase 0 — 2026-05-18)
- 14 skills de catálogo no `.claude/skills/`
- Memories de preço/personalização: `feedback_pricing_increments`, `feedback_personalizacao_minimo_30`, `feedback_compare_at_2x_rule`, `feedback_compare_at_no_inflate`, `feedback_kit_casal_compare_at`, `feedback_kit_casal_excluir_bxgy`
- Memories de sizes: `feedback_br_size_notation`, `feedback_en_sizes_xl`
- Memories de coleções: `feedback_collection_dedupe_prefer_lever`, `feedback_sao_paulo_catchall_pattern`, `feedback_banner_message_over_image`, `feedback_team_alias_normalize`, `feedback_reorder_active_only`, `feedback_team_competitions_membership`
- Memories de cupom: `feedback_cupons_automatic`

## Padrões destilados

### Acréscimos canônicos
- Personalização (nome+número): **+R$ 30** mínimo
- 2GG: **+R$ 10** · 3GG: **+R$ 20** · 4GG: **+R$ 30** (sobre base)
- Customize > No (senão BxGy dá grátis a personalizada)

### compare_at
- 2x preço real **APENAS na criação** de produto novo
- Update de preço base **NÃO** mexe em compare_at
- Patches e personalização **NÃO levam** compare_at
- Kit Casal segue padrão 2x nas variants sem personalização

### Sizes
- BR: P/M/G/GG/2GG/3GG/4GG
- EN: P/M/G/GG/2XL/3XL/4XL

### Cupons
- BxGy Lever = **automatic discounts** (sem código)
- Usar `discountAutomaticBxgyCreate`, não `discountCodeBxgyCreate`
- Apontar pra coleção "Camisas Promo" (smart, filtra tag `excluded-from-promo`)
- Patches e Kit Casal NÃO entram (tag `excluded-from-promo`)

### Coleções
- Duplicatas: manter a com mais vendor=Lever Ecomm, renomear pro handle canônico
- `sao-paulo` é catch-all bug — swap atômico com `sao-paulo-fc`
- Reorder: filtrar `status=ACTIVE` antes (DRAFTs furam)
- Atribuição banner: pela MENSAGEM (headline/CTA), não pela imagem
- Brasil primeiro: só lojas BR (currency BRL/locale pt)
- Pente fino competições: Flamengo→Brasileirão+Libertadores, Real Madrid→La Liga+Champions, Copa do Mundo só seleções

---

## Entradas

<!-- Formato:
### YYYY-MM-DD — [Cliente] — [#tipo]
**Loja:** ...
**Ação:** ...
**Counts:** N produtos / N variants / N coleções
**Olhos:** [status]
**Achados:** ...
**Lições:** ...
-->

### 2026-05-19 — Loja da Torcida — #produtos #colecoes #menu #home

**Loja:** Loja da torcida (xdppna-zt.myshopify.com) — UUID 3a9a7bf6-e392-427c-ae73-0d2823dbe53f
**Ação:** Importar 11 acessórios do bezutts.com.br (Copa do Mundo 2026) → criar coleção `acessorios` → vincular produtos → menu main-menu-1 → home (templates/index.json do tema MAIN "Tema Lever Rolagem")

**Counts:**
- 11 produtos novos (105 → 116)
- 1 custom collection nova (`acessorios`, id 281256362056)
- 11 collects vinculando produtos à coleção
- 1 item de menu novo (main-menu-1: 5 → 6 items, "Acessórios" entre Retrô e Inverno)
- 2 sections novas na home (título "ACESSÓRIOS" + featured-collection-tabs apontando pra `acessorios`, inseridas antes de `video_TdzRRP`/penúltimo)

**Olhos:**
- olho-duplicatas: 0 duplicatas pré-import (105 produtos atuais x 11 bezutts, nenhum título batia)
- olho-precificacao: replicação FIEL conforme decisão Pedro (incluindo bug `compare_at < price` em 8 produtos do bezutts — não corrigido, conversa cliente depois)
- olho-variants-br-en: Tamanho="Único" em todos (acessórios, OK BR)
- olho-imagens: 11 produtos com 1-5 imagens (resolução máxima 2048 via path replace `_NxN_` → `_2048x2048_`); Shopify CDN re-hospedou todas
- olho-smart-collections: N/A (custom collection manual)

**Achados:**
- Tema MAIN "Tema Lever Rolagem" usa padrão `_blocks` com `ai_gen_block_af59fe2` (verde #278a01 shimmer #ffc900) como heading antes de cada featured-collection-tabs — repliquei estética idêntica
- Menu handle ativo confirmado é `main-menu-1` (não `main-menu`); ambos existem mas só `main-menu-1` aparece no tema
- main-menu-1 tinha 5 items, "Retrô" estava como type=HTTP (não COLLECTION) — preservei como veio
- Inventory: variants nascem com `inv_qty=0` automaticamente quando POST sem location; combinado com `inventory_policy=deny` resulta em "esgotado" natural (decisão Pedro: produtos são decoração de catálogo)
- Token Loja da torcida não tem read_locations/read_publications, mas productCreate sem locationId funcionou (Shopify resolve default)

**Lições (padrão Lever ditado por Pedro — replicar):**
1. **Importação de fonte externa:** vendor SEMPRE `Lever Ecomm` (sobrescrever marca da fonte, mesmo se for "Fornecedor Oficial" ou nome da loja origem)
2. **Preço replica fiel** — bugs incluídos. Decisão de preço é com cliente, não decisão técnica do Boss
3. **Descrição/imagens replicam fiel** se o produto for "decoração de catálogo" (esgotado, scarcity visual, vitrine)
4. **Tags preservadas + tag Lever adicionada** (`excluded-from-promo` quando produto não deve entrar em BxGy)
5. **ZERO atalho:** coleção criada + menu atualizado + home atualizada = experiência completa. Meia-boca não conta como entrega
6. **Volume aparente é estratégia válida:** produtos esgotados na home dão sensação de "vendemos muito"
7. **Snapshot before/after obrigatório** em batches sequenciais — diff só do que mudou, sem ruído

**Arquivos:**
- BEFORE: `scripts/theme_dump/loja-da-torcida/2026-05-19/before/` (products-list, menu-main, themes-list, index.json, duplicate-check)
- AFTER: `scripts/theme_dump/loja-da-torcida/2026-05-19/after/` (products-list, menu-main, diff.json)
- Outputs: `created-products.json` (11 IDs), `created-collection.json` (1), `collects.json` (11), `after-index.json` (templates/index.json final)
- Scripts reusáveis: `.claude/tmp/torcida-before-snapshot.mjs`, `torcida-batch1-create-products.mjs` ... `torcida-batch5-home.mjs`, `torcida-after-snapshot.mjs`

**Verificação visual:** https://xdppna-zt.myshopify.com/collections/acessorios


### 2026-05-19 — Loja da Torcida — #colecoes #reorder (continuação)

**Loja:** Loja da torcida (xdppna-zt.myshopify.com) — UUID 3a9a7bf6-e392-427c-ae73-0d2823dbe53f
**Ação:** Fixar Kit Casal Brasil HOME (7058587779144) na posição 1 e Kit Casal Brasil AWAY (7058587844680) na posição 2 em 3 coleções smart manual-sort.

**Counts:**
- 3 coleções alteradas: `brasil` (112 prods), `selecoes` (113 prods), `masculino-brasil` (86 prods)
- 1 coleção alvo descartada após verificação: `feminina-brasil` (Kit Casal NÃO é membro — rule exige "feminina"+"Camisa" no título, Kit Casal não bate)
- 2 produtos movidos por coleção (6 moves totais via 3 jobs `collectionReorderProducts`)

**Olhos:**
- olho-precificacao: N/A (só reorder, zero alteração de preço)
- olho-variants-br-en: N/A
- olho-duplicatas: N/A
- olho-smart-collections: rules limpas, Kit Casal membro legítimo (tag `brasil`+`selecoes`, título contém "Brasil", não contém "feminin"/"infantil")
- feedback_reorder_active_only: top dos 3 ANTES já era ACTIVE (não impactou); 1 DRAFT em `selecoes` permanece na pos 4 (não relevante porque alvo é só pos 1-2)

**Resultado verificado (top 3 AFTER):**
- `brasil`: 1.Kit Casal HOME · 2.Kit Casal AWAY · 3.Camisa Neymar Jr II
- `selecoes`: 1.Kit Casal HOME · 2.Kit Casal AWAY · 3.Camisa Brasil 2026 I
- `masculino-brasil`: 1.Kit Casal HOME · 2.Kit Casal AWAY · 3.Camisa Neymar Jr I

**Achados:**
- Kit Casal HOME/AWAY estavam fora do top 50 nas 3 coleções antes do pin (provavelmente no fim por ordem cronológica de adição — produtos criados depois caem no final em manual-sort)
- `feminina-brasil` smart rule é conjunctive ("feminina" AND "Camisa") — exclui Kit Casal por design. Se o cliente quiser Kit Casal lá, a rule precisa ser expandida (ou adicionar Kit Casal manualmente via custom collection separada)
- Mutation `collectionReorderProducts` aceita até N moves em uma call; Shopify enfileira como job assíncrono — esperar `job.done` (todos os 3 concluíram em <2s, sem retry necessário)
- Ordem relativa dos demais produtos preservada (Neymar I/II, Goleiros, etc. mantiveram posição relativa entre si, só desceram 2 slots)

**Lições:**
1. **Antes de fazer pin, verificar membership** — `feminina-brasil` parecia alvo óbvio mas Kit Casal não estava lá; perda de tempo se rodasse cego
2. **`collectionReorderProducts` exige `sort_order = manual`** — as 4 coleções já estavam MANUAL, então não precisou flipar antes (memory pitfall conhecido: se for outro tipo de sort, flipa pra manual + delay 2.5s)
3. **`newPosition` é string 0-indexed** — pos 1 visual = "0", pos 2 = "1"
4. **Membership confirmada via `product.collections`** com handle comparado contra lista de targets — mais robusto que paginar produtos da coleção atrás do alvo

**Arquivos:**
- BEFORE: `.claude/tmp/torcida-before-pin.json` (top 10 das 4 coleções alvo + membership)
- RESULT: `.claude/tmp/torcida-pin-kit-casal-RESULT.json` (before_top10 + after_top10 + check por coleção)
- DRY-RUN: `.claude/tmp/torcida-pin-kit-casal-DRYRUN.json`
- Scripts: `.claude/tmp/torcida-snapshot-collections.mjs`, `torcida-verify-kit-casal.mjs`, `torcida-pin-kit-casal.mjs`

**Verificação visual:**
- https://xdppna-zt.myshopify.com/collections/brasil
- https://xdppna-zt.myshopify.com/collections/selecoes
- https://xdppna-zt.myshopify.com/collections/masculino-brasil


### 2026-05-19 — Loja da Torcida — #colecoes #reorder (reversão)

**Loja:** Loja da torcida (xdppna-zt.myshopify.com) — UUID 3a9a7bf6-e392-427c-ae73-0d2823dbe53f
**Ação:** REVERTER pin anterior — Pedro pediu Neymar I/II nas pos 1+2 e Kit Casal HOME/AWAY nas pos 3+4 (atrás dos Neymars), nas mesmas 3 coleções `brasil`, `selecoes`, `masculino-brasil`.

**Estado ANTES (top 4):**
- `brasil`: 1.Kit Casal HOME · 2.Kit Casal AWAY · 3.Neymar II · 4.Neymar I
- `selecoes`: 1.Kit Casal HOME · 2.Kit Casal AWAY · 3.Camisa Brasil 2026 I · 4.Brasil Feminino I (DRAFT) — Neymars FORA do top 15
- `masculino-brasil`: 1.Kit Casal HOME · 2.Kit Casal AWAY · 3.Neymar I · 4.Neymar II

**Counts:**
- 3 coleções alteradas (mesmas IDs: 280479334472 / 280483037256 / 280481857608)
- 4 produtos pinados por coleção (12 moves totais via 3 jobs `collectionReorderProducts`)
- Em `selecoes` os 2 Neymars subiram do bulk pro topo (não estavam no top 15)

**Olhos:**
- olho-precificacao: N/A (só reorder)
- olho-variants-br-en: N/A
- olho-duplicatas: N/A
- olho-smart-collections: N/A (rules intocadas; só pin manual)
- feedback_reorder_active_only: ✅ os 4 pinados são ACTIVE; o DRAFT em `selecoes` foi naturalmente empurrado de pos 4 para pos 6+, sai do top 5 da vitrine

**Resultado verificado (top 5 AFTER):**
- `brasil`: 1.Neymar I · 2.Neymar II · 3.Kit Casal HOME · 4.Kit Casal AWAY · 5.Camisa Brasil 2026 I
- `selecoes`: 1.Neymar I · 2.Neymar II · 3.Kit Casal HOME · 4.Kit Casal AWAY · 5.Camisa Brasil 2026 I
- `masculino-brasil`: 1.Neymar I · 2.Neymar II · 3.Kit Casal HOME · 4.Kit Casal AWAY · 5.Camisa Brasil 2026 I

**Achados:**
- Quando se pinou Kit Casal originalmente (entry anterior 16:00), os Neymars desceram pra pos 3+4 em `brasil`/`masculino-brasil` mas em `selecoes` os Neymars já estavam soterrados (fora do top 15) — ou seja, o pin reverso AGORA dobrou de função: pin Neymar + pin Kit Casal
- `collectionReorderProducts` move TODOS os IDs informados pra suas `newPosition` numa única chamada, e os demais produtos se acomodam preservando ordem relativa — comportamento perfeito pra esse caso (não precisou pin produto-por-produto)
- 3 jobs concluíram em 2s cada, zero retry, zero userError
- Pedro está calibrando hierarquia da vitrine de Copa do Mundo: **Neymar > Kit Casal**. Faz sentido — Neymar é o gatilho emocional/midiático principal, Kit Casal é up-sell secundário

**Lições:**
1. **Pin múltiplo numa única chamada** — `moves: [...]` com várias entries em `collectionReorderProducts` é a forma certa; Shopify acomoda os outros produtos sem precisar mover um por um
2. **`newPosition` zero-indexed string** — pos visual 1=`"0"`, pos 2=`"1"`, pos 3=`"2"`, pos 4=`"3"`
3. **Ordem dentro do array de moves não importa** — Shopify resolve pelo `newPosition`; passei Neymar I primeiro com pos "0" e funcionou
4. **Reversão de pin tem custo zero** — mesma mutation, novas posições. Sem `unpin` no Shopify (sort_order=manual mantém manual)
5. **Estratégia de vitrine evolui** — primeiro pin foi "destacar produto novo (Kit Casal)", agora é "manter ícone (Neymar) no topo + Kit Casal logo atrás". Boss aprende com Pedro: pin é instrumento, não dogma

**Arquivos:**
- INSPECT: `.claude/tmp/torcida-reorder-inspect.json` (estado antes do reorder hoje)
- APPLY: `.claude/tmp/torcida-reorder-apply-report.json` (3 jobs submetidos)
- VERIFY: `.claude/tmp/torcida-reorder-verify-report.json` (top 5 após reorder)
- Scripts: `.claude/tmp/torcida-reorder-step1-inspect.mjs`, `torcida-reorder-step2-apply.mjs`, `torcida-reorder-step3-verify.mjs`

**Verificação visual:**
- https://xdppna-zt.myshopify.com/collections/brasil
- https://xdppna-zt.myshopify.com/collections/selecoes
- https://xdppna-zt.myshopify.com/collections/masculino-brasil


### 2026-05-20 — Mantos do PH — #domain #bloqueio-api

**Loja:** Mantos do PH (a9dc24-2.myshopify.com) — UUID 053f7258-95f4-4ca9-81ad-4032b18829ba
**Ação:** Tentar cadastrar `www.mantosdoph.com.br` como secondary domain via Admin API (apex `mantosdoph.com.br` permanece primary). DNS já válido (CNAME → shops.myshopify.com).

**Counts:**
- 0 domains adicionados (bloqueio: API Shopify não expõe a operação)
- 0 produtos / coleções / variants alterados
- 4 scripts de diagnóstico rodados (step1, step1b, step1c, step1d)

**Olhos:**
- olho-precificacao: N/A (zero produto/preço)
- olho-variants-br-en: N/A
- olho-duplicatas: N/A
- olho-smart-collections: N/A

**Pré-fix (smoke):**
- `HEAD https://www.mantosdoph.com.br/` → **404** (Cloudflare; Shopify rejeita host desconhecido)
- `HEAD https://mantosdoph.com.br/` → **200** (apex saudável)

**Diagnóstico definitivo:**
1. **plan_name=`basic`** (não Plus)
2. **477 mutations totais** disponíveis pro token, **0 contendo "domain"** (filtro `__schema.mutationType.fields` regex `/domain/i`)
3. Mutation forçada `domainCreate(domain: { host: "www.mantosdoph.com.br" })` retorna `{"code":"undefinedField","typeName":"Mutation","fieldName":"domainCreate"}` — Shopify confirma que o field simplesmente NÃO existe na schema 2026-04 pra esse plano/escopo
4. Tentativa de variante histórica `shopAddDomain(host:)` mesmo erro `undefinedField`
5. **REST `GET /admin/api/2026-04/domains.json` → HTTP 404 "Not Found"** (endpoint não existe)
6. **Type `Domain` existe** (campos host/id/localization/marketWebPresence/sslEnabled/url) mas só via `domain(id:)` (read singular). Sem field list `Shop.domains`, sem input type pra create
7. **Scopes do token:** 77 handles ativos (write_themes, write_online_store_pages, etc) — **não existe scope `write_domains` no leque oferecido pelo Shopify**. Não é falta de permissão, é feature não-exposta

**Conclusão:** Cadastro de domain secundário em Shopify `basic` é **exclusivamente UI Admin** (decisão de produto Shopify, não bug nem scope). Plus tem operação via partner channel mas não na Admin API pública.

**Ação requerida do Pedro (UI manual, ~30s):**
- `https://admin.shopify.com/store/a9dc24-2/settings/domains` → "Connect existing domain" → `www.mantosdoph.com.br`
- Manter primary = apex; secondary `www` com toggle "Redirect all traffic to primary domain" ligado → 301 → canonical
- SSL provisiona auto em 30s-2min via Let's Encrypt

**Smoke test esperado pós-fix Pedro:**
- `curl -sI https://www.mantosdoph.com.br/` → HTTP 301 → location: `https://mantosdoph.com.br/`

**Lições:**
1. **Domain management Shopify = UI-only abaixo de Plus.** Hard limit de produto, não bug
2. **Introspect antes de adivinhar:** `__schema.mutationType.fields` filtrando por substring resolve em 1 query o que 5 tentativas de mutation chutadas não
3. **Scope vs feature:** ter `write_themes`/`write_online_store_pages` não implica `write_domains` — feature pode simplesmente não ser exposta
4. **DNS válido + Shopify Admin sem reconhecer host = SEMPRE cadastro UI faltando.** Cliente fez DNS direito, só precisa do click manual no Admin
5. **Padrão recorrente futuro:** vale tag `requires_admin_ui` no kanban pra ações inerentemente fora do alcance da API

**Arquivos:**
- INTROSPECT: `.claude/tmp/mantos-domain-www/step1b-rest-domains.json` (477 muts, 0 domain)
- TRY-MUT: `.claude/tmp/mantos-domain-www/step1c-try-mutation.json` (erro oficial + scopes + smoke pre-fix)
- DOMAIN-TYPE: `.claude/tmp/mantos-domain-www/step1d-domain-type.json` (Domain type read-only)
- Scripts: `.claude/tmp/mantos-domain-www/step1*.mjs`
- History: `blocks/history/2026-05-20_mantos-ph_cadastrar-www-domain.md`

**Severidade:** atenção (bloqueio operacional, sem violação de regra Lever — pendência transferida ao Pedro via UI)


### 2026-05-20 — Mantos do PH — #colecoes #seo #redirects

**Loja:** Mantos do PH (a9dc24-2.myshopify.com) — UUID 053f7258-95f4-4ca9-81ad-4032b18829ba
**Ação:** Corrigir 2 sitelinks órfãos do Google que retornavam 404 — criar URL Redirects 301 pros handles canônicos existentes.

**Counts:**
- 2 URL Redirects criados (0 pré-existentes)
- 0 coleções criadas (cenário B confirmado — coleção existe com handle diferente)
- 0 produtos alterados
- 0 alterações em coleções existentes

**Olhos:**
- olho-precificacao: N/A (só URL redirects, zero alteração de preço/produto)
- olho-variants-br-en: N/A
- olho-duplicatas: N/A
- olho-smart-collections: confirmado `cabuloso` (smart, disjunctive=false, rule "title contains Cruzeiro") está saudável com 119 prods active — sem catch-all, sem regra OR maluca
- feedback_reorder_active_only: N/A (sem reorder)
- feedback_sao_paulo_catchall_pattern: N/A (sem swap de handle; só redirect)

**Investigação prévia (não bater pronto):**
- `/collections/atletico-mg` 404: handle canônico = `atletico-mineiro` (smart id 342953132227, 66 prods, rule title contains "Atlético Mineiro")
- `/collections/cruzeiro` 404: cenário B — coleção existe com handle `cabuloso` (smart id 330245537987, 119 prods, title "Cruzeiro", template_suffix `cruzeiro`)
- Pré-flight HTTP confirmou: `/atletico-mineiro` 200, `/cabuloso` 200; `/atletico-mg`, `/atletico`, `/cruzeiro` 404
- 0 URL Redirects pré-existentes pros 2 paths (sem duplicação)

**Resultado (smoke test pós-fix):**
- `/collections/atletico-mg` → HTTP **301** → `/collections/atletico-mineiro` OK
- `/collections/cruzeiro` → HTTP **301** → `/collections/cabuloso` OK
- Target `/collections/atletico-mineiro` HTTP 200 OK
- Target `/collections/cabuloso` HTTP 200 OK

**Achados (registrar pra próxima):**
1. **Loja tem 2 coleções de Atlético MG** vivendo lado a lado: `galao` (title "Atlético MG", 66 prods, template_suffix `galao` com promo "Pague 2 Leve 3" no body_html, disjunctive=true, rules: title contains "Atlético MG" OR "Mineiro") e `atletico-mineiro` (title "Atlético Mineiro", 66 prods, sort best-selling, rule simples title contains "Atlético Mineiro"). **Provável duplicata** — vale revisar com Pedro: consolidar numa só (manter `galao` que tem template promo + body_html, deletar `atletico-mineiro`, criar redirect também `/atletico-mineiro` → `/galao`)? Ou inverso? Não fiz nada disso — só registrei. Pedro travou a decisão Atlético MG = redirect pra `atletico-mineiro`, então segui.
2. **Tags Shopify estão bagunçadas** (memory `feedback_filtro_titulo_nao_tag` confirmada na prática): 50+ produtos com tag `cruzeiro` mas título de outros times (Palmeiras, Flamengo, São Paulo, até Atlético Mineiro). Filtragem por título é a única fonte de verdade — e `cabuloso` faz isso certo (rule só por título). Não mexi nas tags porque escopo era só redirects.
3. **GraphQL `collectionByHandle` retornou null pra handle existente** (`atletico-mineiro`) na primeira query — possível diferença de scope da app/publicação. REST `/smart_collections.json?handle=` foi a fonte de verdade. **Lição:** se GraphQL não acha mas HTTP 200 público, fallback pra REST antes de concluir "não existe".
4. **Sem investigação prévia eu teria criado uma coleção `cruzeiro` redundante** — o cenário A (criar smart collection) parecia óbvio com 50+ produtos active, mas `cabuloso` já cobre. Cenário B foi a saída sem inflar catálogo.
5. **Não toquei em DNS/domínio** (memory `feedback_dominio_dns_responsabilidade_cliente`) — URL Redirect é primary-domain native do Shopify, resolve sozinho em `mantosdoph.com.br`.

**Lições gerais:**
1. **Sitelinks órfãos = URL Redirect 301**, não criar coleção nova. Antes de qualquer criação, mapear handle canônico existente. Skill candidata futura: `fix-orphan-sitelinks`.
2. **Cenários de fix de 404:**
   - Handle renomeado → 301 pro novo (caso Atlético MG)
   - Handle diferente do óbvio → 301 pro real (caso Cruzeiro/`cabuloso`)
   - Coleção realmente não existe + tem volume → criar smart (não rodou aqui)
   - Coleção não existe + sem volume → 301 pra `/all` (não rodou aqui)
3. **smart_collection com `template_suffix` customizado** (Mantos PH usa `galao` e `cruzeiro` como suffixes) é sinal de tema dedicado por time — vale checar `templates/collection.galao.json` antes de deletar/renomear, senão quebra layout.

**Arquivos:**
- SNAPSHOT: `.claude/tmp/mantos-sitelinks-fix/step1-snapshot.json`
- DEEP-DIVE: `.claude/tmp/mantos-sitelinks-fix/step1b-atletico-deep.json` (+ probes HTTP, busca handles)
- VERIFY-REST: `.claude/tmp/mantos-sitelinks-fix/step1c-verify-handles.json` (REST custom+smart confirmando os 3 handles)
- APPLY: `.claude/tmp/mantos-sitelinks-fix/step2-apply-redirects.json` (2 URL Redirects criados, 0 userErrors)
- SMOKE: `.claude/tmp/mantos-sitelinks-fix/step3-smoke-test.json` (4/4 OK)
- Scripts: `.claude/tmp/mantos-sitelinks-fix/step1-snapshot.mjs`, `step1b-atletico-deep.mjs`, `step1c-verify-handles.mjs`, `step2-apply-redirects.mjs`, `step3-smoke-test.mjs`
- History: `blocks/history/2026-05-20_mantos-ph_fix-sitelinks-orfaos.md`

**IDs criados:**
- URL Redirect 1: `gid://shopify/UrlRedirect/438855991491` — `/collections/atletico-mg` → `/collections/atletico-mineiro`
- URL Redirect 2: `gid://shopify/UrlRedirect/438856024259` — `/collections/cruzeiro` → `/collections/cabuloso`

**Verificação:**
- https://mantosdoph.com.br/collections/atletico-mg (esperado 301)
- https://mantosdoph.com.br/collections/cruzeiro (esperado 301)

**Severidade:** ok (ação aplicada + olhos sem violação + smoke test 4/4)


