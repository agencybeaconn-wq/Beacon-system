# Workflow Guide — Beacon System

Manual cenário-a-cenário do dia a dia. Pra cada situação comum, mostra **exatamente o que digitar no chat** e o que acontece.

> 💡 **Regra geral:** você NÃO precisa digitar `/nome-da-skill`. O Claude identifica sozinho via a "Regra Zero" no [CLAUDE.md](CLAUDE.md). Escreva natural.

---

## 🎯 Cenários mais comuns

### 1. Cliente mandou tabela de preços nova no WhatsApp

**Você digita:**
```
atualiza os preços do cliente Julico Sports

Torcedor: R$209
Jogador: R$249
Retrô: R$239
Infantil: R$239
Agasalho: R$359
Jaqueta: R$389
Moletom: R$289
Short: R$199
Patch: R$30
Patrocínio extra: R$45
Acréscimo 2GG a 4GG: R$10
Nome e número: R$30
Manga longa: R$30
```

**O que acontece:**
1. Claude invoca `/update-prices` automaticamente
2. Parse do texto → array de `{ key, label, value }`
3. `VALIDATE`: cliente existe? Shopify conectada?
4. `DRY-RUN`: busca produtos, calcula preços esperados (categoria + extras)
5. `PREVIEW`: mostra quantos produtos/variantes vão mudar + amostra
6. Aguarda você confirmar ("sim" / "pode aplicar")
7. `EXECUTE`: aplica via `productVariantsBulkUpdate` (GraphQL bulk)
8. `LOG`: append em `.claude/logs/execution.jsonl`

**Duração:** ~3 min pra 1000+ produtos.

---

### 2. Tem bug no tema do cliente ("preço estranho")

**Você digita:**
```
o preço na página do produto do Julico Sports tá estranho, alguns não tão aparecendo o parcelamento
```

**O que acontece:**
1. Claude reconhece que é task de tema → consulta [themes/KNOWLEDGE_BASE.md](themes/KNOWLEDGE_BASE.md)
2. Identifica tópico **"Preço na página de produto"** + **"Parcelamento e Pix"**
3. **Confirma com você antes de abrir arquivos:**
   > "Isso aponta pra `snippets/price.liquid`, `snippets/product-installments.liquid`, `sections/main-product.liquid`. Vou investigar. Tudo bem?"
4. Após seu OK, roda `/lever-theme pull-client "Julico Sports"` pra baixar tema local
5. Lê os arquivos, identifica o problema
6. Propõe a fix
7. Cria `/lever-theme duplicate "Julico Sports"` (draft copy)
8. `/lever-theme draft-sync --apply` pra subir a mudança no draft
9. Te passa a **preview URL** (`https://shop/?preview_theme_id=X`)
10. Você testa no browser
11. Se aprovar: `/lever-theme publish --apply --yes` → draft vira main

**Por que "dev-first":** nunca edita o tema main direto. Sempre em draft copy dentro do próprio shop do cliente.

---

### 3. Cliente reclama "tem algo estranho na loja"

**Você digita:**
```
roda um quality-gate no Julico Sports pra ver o que tá errado
```

**O que acontece:**
1. Claude invoca `/quality-gate` → roda os 14 checks em ~90s:
   - Preços vs banco
   - Variantes esgotadas
   - Produtos sem imagem
   - Coleções vazias
   - SEO metafields
   - Produtos duplicados
   - Coleções obrigatórias (Brasileirão, Copa do Mundo, etc)
   - Menus quebrados
   - Produtos sem categoria
   - Preços zero/null
   - Smart rules vazias
   - Pricing no banco
   - Típos gramaticais (Camisa X Feminino)
   - Compare_at_price bizarro
2. Score 0-100 + breakdown PASS/WARN/FAIL
3. Se houver FAIL críticos, Claude **sugere skills pra corrigir**:
   > "Encontrei 46 produtos duplicados. Quer que eu rode `/shopify` pra identificar e deletar?"
4. Salva no banco (`client_quality_runs`) pra dashboard

---

### 4. Promoção de Black Friday — Pague 2 Leve 3 em vários clientes

**Você digita:**
```
criar promoção pague 2 leve 3 em todos os clientes BR conectados
```

**O que acontece:**
1. Claude lista clientes BR connected
2. Pra cada um, invoca `/create-discount PAGUE2LEVE3`
3. Usa preset pré-configurado (coleções "Todas as Camisas" + "Conjuntos Infantis", 100% off na 3ª peça, não cumulativo)
4. Cria via `discountCodeBxgyCreate` (GraphQL)
5. Aplica em lojas diferentes em paralelo (safe)
6. Te mostra URL admin de cada cupom criado

**Requer:** escopo `write_discounts` no app Shopify de cada cliente.

---

### 5. Cliente novo — do zero até loja funcional

**Você digita:**
```
planeja o deploy completo do cliente novo Santos FC Store
```

**O que acontece:**
1. Claude invoca `/plan` (não executa, só planeja)
2. Verifica estado atual: cliente existe? Shopify conectada? Tem briefing? Tem pricing?
3. Retorna plano numerado mapeado pra skills:
   ```
   1. /deploy-store Santos FC Store — coleções + menus + páginas + tema + produtos
   2. /configure-theme Santos FC Store — settings a partir do briefing
   3. /update-prices Santos FC Store — tabela do briefing
   4. /fix-options Santos FC Store — padronizar tamanhos + PP/5GG
   5. /sort-collections Santos FC Store — ordenar por ano
   6. /quality-gate Santos FC Store — validar antes de entregar
   ```
4. Você executa cada passo confirmando no chat

---

### 6. Quero comparar os temas BR e EN pra ver drift

**Você digita:**
```
roda um diff entre os temas BR e EN, quero ver o que tá diferente
```

**O que acontece:**
1. Claude invoca `/lever-theme diff-br-en`
2. Compara arquivos locais de `themes/lever-br/` vs `themes/lever-en/`
3. Mostra 3 listas:
   - **Diferentes**: mesmos arquivos com conteúdo divergente (ex: sections/header.liquid)
   - **Só no BR**: snippets/features que não foram portadas pro EN
   - **Só no EN**: vice-versa
4. Exemplo real da última run: 46 arquivos diferentes + 10 só no BR (YampiSnippet, shop-the-look, product-installments, custom-badges...) + 4 só no EN

---

### 7. Tema template desatualizado — sincronizar com Shopify

**Você digita:**
```
puxar última versão do tema BR
```

**O que acontece:**
1. Claude invoca `/lever-theme pull br`
2. Baixa todos os 408 arquivos do tema "Tema Lever Atualizado 18/03" na testeloja-9899
3. Atualiza `themes/lever-br/` com as mudanças
4. Você pode commitar no git pra ter histórico

---

### 8. Manutenção semanal (todos os clientes)

**Você roda manualmente uma vez por semana:**
```bash
node .claude/skills/quality-gate/run-weekly.mjs
```

**O que acontece:**
1. Lista todos os clientes connected
2. Roda `/quality-gate` em cada um em paralelo (batches de 3)
3. Salva resultados em `client_quality_runs` (Supabase)
4. Gera relatório markdown em `.claude/logs/weekly-{data}.md` com top 10 piores scores
5. Você abre o dashboard Shopify Manager → aba "Quality" pra ver visualmente

**Dica:** pode virar cron via skill `schedule`: `/schedule weekly run-quality-gate --cron="0 8 * * 1"`

---

## 🆘 Troubleshooting comum

### "Claude não tá invocando a skill automaticamente"
- Veja se o CLAUDE.md tem a "Regra Zero" atualizada
- Tente ser mais específico: "atualizar os preços" em vez de "cola isso"
- Force manualmente: `/update-prices Cliente X` com a tabela

### "Deu erro 429 no meio de um update"
- Regra: nunca rode 2 scripts escrevendo na mesma loja ao mesmo tempo
- Delay mínimo: 500ms entre requests
- Re-rode o script com `--retry-missing` ou similar

### "Tema do cliente quebrou depois de /publish"
- Rollback: o tema anterior virou unpublished mas continua disponível
- Admin Shopify → Themes → Previously published → clicar em Publish
- Ou via API: `PUT /themes/{previousId}.json { role: "main" }`

### "Quality gate tá demorando >2min"
- Normal pra lojas com 1000+ produtos (De Boleiro leva ~90s)
- Check 8 (menus quebrados) é o mais lento porque valida cada URL
- Pra acelerar: rode com `--skip=menus` (TODO: adicionar flag)

### "Script falha com erro de token/scopes"
- Confira se `SHOPIFY_SCOPES` no Supabase inclui `read_discounts,write_discounts`
- Reconecte a loja via OAuth pra token pegar escopos novos
- Ver [supabase/functions/shopify-auth-start/index.ts](supabase/functions/shopify-auth-start/index.ts)

### "Produtos duplicados no Boleiro (quality-gate reportou 46)"
- Bug de import rodado 2x — identifique manualmente no admin Shopify
- Use `/shopify` pra listar/deletar os duplicados:
  `"lista os produtos duplicados do De Boleiro e delete os com menor ID"`

---

## 📅 Checklist semanal de manutenção

```markdown
- [ ] Segunda 8h: rodar `run-weekly.mjs` (quality-gate em todos)
- [ ] Revisar relatório `.claude/logs/weekly-{data}.md`
- [ ] Atacar top 5 piores scores:
  - [ ] Rodar `/quality-gate <cliente>` pra ver detalhes
  - [ ] Corrigir issues críticos com skills apropriadas
- [ ] Sexta: `/lever-theme diff-br-en` pra detectar drift
- [ ] Commitar mudanças nos temas (`themes/lever-br/` e `themes/lever-en/`)
- [ ] Reviewar `client_quality_runs` no dashboard (tendência por cliente)
```

---

## 🔗 Referências rápidas

- **Regra Zero + routing**: [CLAUDE.md](CLAUDE.md)
- **Protocolo de execução**: [.claude/PROTOCOL.md](.claude/PROTOCOL.md)
- **Hub de skills**: [.claude/skills/README.md](.claude/skills/README.md)
- **Tema knowledge base**: [themes/KNOWLEDGE_BASE.md](themes/KNOWLEDGE_BASE.md)
- **Tema arquitetura**: [themes/ARCHITECTURE.md](themes/ARCHITECTURE.md)
- **Matriz de testes**: [.claude/tests/skill-matrix.md](.claude/tests/skill-matrix.md)
- **Logs de execução** (local, gitignored): `.claude/logs/execution.jsonl`

---

## 💬 Dicas pra conversar com o Claude

1. **Seja específico sobre o cliente**: sempre mencione o nome ("do Julico Sports", "da Brasileiríssimo") pra evitar ambiguidade
2. **Cola direto o contexto**: se é uma tabela do WhatsApp, cola inteira — Claude parseia
3. **Pergunte antes de grandes operações**: "pode rodar sort-collections em todos os clientes hoje?" em vez de só pedir
4. **Use linguagem natural pra tema**: descreva o sintoma ("botão não funciona"), não o arquivo ("edita buy-buttons.liquid")
5. **Aprove explícito**: quando Claude pedir confirmação, responda "sim" / "pode" / "aplica" — silêncio não conta
6. **Pergunte pelo status**: "o que tá acontecendo?" / "como tá o quality-gate?" pra ver background tasks

---

Última atualização: **2026-04-10** (Fase 5 concluída)
