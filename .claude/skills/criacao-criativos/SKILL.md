---
name: criacao-criativos
description: Gera 5 variações cirúrgicas de criativos publicitários (Stories 9:16 + Feed 1:1 = 10 imagens) automaticamente via ChatGPT web. Adapta uma arte de referência validada para um time/seleção + loja específica, baixando logo da loja e fotos do produto da Shopify. Prompt cirúrgico estilo "troque X / remova Y / adicione Z" — imagens carregam contexto visual. Status validado em 5 testes (incluindo Arsenal/GoalKit 10/10 em 15.3 min).
argument-hint: [time] [loja-destino] [url-shopify-produto] [--semana=YYYY-MM-DD]
---

# Criação de Criativos — ChatGPT Playwright

Skill que **automatiza a geração de 5 variações de criativos** para o time da Lever. Pega uma arte validada do Drive, adapta para um time/loja específica e gera 5 variações em 2 proporções (9:16 stories e 1:1 feed = **10 imagens**) — tudo via ChatGPT web automatizado com Playwright.

> **Status**: validado em 5 testes reais. Refinado em 2026-05-27 — prompt cirúrgico + variações em eixo único. Ferramenta em `tools/chatgpt-playwright/`.

---

## 🎯 Quando usar

User pede coisas como:
- "Gera criativos do Corinthians para a Brasileiríssimo"
- "Cria variações da camisa do Palmeiras pra Loja da Torcida"
- "Adapta criativo X pro Flamengo / Mantos do PH"
- "Variações de criativo do Arsenal pra GoalKit usando essa URL: ..."

---

## 🧠 Princípio central (refino 2026-05-27)

**Prompts CIRÚRGICOS, não briefing.** A revisão de 2026-05-27 substituiu o template prescritivo de 7 seções (com paleta hardcoded, posicionamento, promoções a evitar etc) por uma lista de **comandos diretos**: "troque X / remova Y / adicione Z". As imagens anexadas carregam o contexto visual — não precisa descrever a paleta do clube em texto se a foto da camisa já tá lá.

**Exemplo (Aston Villa, prompt manual validado pelo Pedro):**

```
Troque essa identidade da arte mantendo fonte e estilo para a camisa do aston villa em anexo.
Troque manto do cruzeiro para aston villa new jersey
Troque o preço para take 3 pay 2
Troque o logo do cruzeiro pelo aston villa
Remova as flechas com oferta.
Adicione de alguma maneira a taça da europa league
Defina a proporção como 9:16
```

ChatGPT pegou paleta vinho/azul claro da foto, integrou a taça da Europa League, manteve a tipografia da referência. Sem briefing, sem hardcode de cores.

---

## 📥 Inputs necessários

Pra cada execução, eu (Claude orquestrador) preciso saber:

1. **Time** (ex: Arsenal, Corinthians, Seleção Brasileira)
2. **Loja destino** (ex: GoalKit, Brasileiríssimo, Mantos do PH)
3. **URL do produto na Shopify** (ex: `https://goalkit-jerseys-2.myshopify.com/products/jersey-arsenal-202526-i-fan`)
4. **Idioma dos criativos** (PT brasileiro ou inglês britânico — perguntar quando a loja for internacional)
5. **Oferta principal** (ex: TAKE 3 PAY 2 / LEVE 5 PAGUE 3 / PIX 5% OFF)
6. **Frete** (ex: FREE SHIPPING WORLDWIDE / Frete grátis Brasil)
7. (Opcional) **Arte de referência específica** do Drive (default: mais recente)

---

## 🔄 Workflow (passo a passo que eu executo)

### Etapa 1: Mapeamento rápido da loja destino

`WebFetch` no `.myshopify.com` ou domínio público da loja. Confirmo com user:
- Logo (URL do CDN)
- Idioma do site
- Métodos de pagamento e frete
- Posicionamento curto

User confirma o briefing curto. Sem encher de detalhes — só o suficiente pra preencher 2-3 variáveis cirúrgicas do V1.

### Etapa 2: Coletar inputs em paralelo

a. **Arte de referência** — Drive:
   - Pasta `Criativos Validados que convertem.`
   - Pegar mais recente OU a especificada pelo user
   - Como o Drive exige login e o `WebFetch` não autentica, **pedir pro user baixar manualmente e colar em `inputs/referencia.{png|jpg}`** (caminho mais rápido validado em Arsenal/GoalKit)

b. **Logo da loja destino** — site público:
   - `WebFetch` no site da loja
   - Extrair URL do logo principal (header ou og:image)
   - Baixar via `curl` pra `inputs/logo-{loja-slug}.png`

c. **Fotos do produto** — Shopify `.json`:
   - Apender `.json` na URL do produto
   - Extrair array `images`
   - Baixar todas via `curl` pra `inputs/{time-slug}-NN.jpg`

### Etapa 3: Limpar `inputs/` antigo e salvar refs

```bash
cd tools/chatgpt-playwright/inputs/
rm -f *.jpg *.png *.jpeg
# ... baixar refs novas
```

### Etapa 4: Olhar a arte de referência e montar o V1 cirúrgico

**Antes de escrever o prompt, EU OLHO A ARTE.** Identifico:
- Que time está exibido (TIME_REFERENCIA)
- Que loja patrocina (LOJA_REFERENCIA — logo no topo)
- Que título/copy tem (pra substituir)
- Que selos no rodapé (pra substituir)
- Que paleta de bordas/background (pra adaptar)
- Que elementos extras (taça? flechas? estrelas? — pra remover ou substituir)

Salvar em `tools/chatgpt-playwright/prompts/{time}-{loja}.txt` no padrão cirúrgico (ver seção "Prompt template" abaixo).

### Etapa 5: Disparar o lote

```bash
cd tools/chatgpt-playwright
node gerar-tudo-num-chat.mjs \
  --base-prompt-file ./prompts/{time}-{loja}.txt \
  --ref ./inputs/referencia.png \
  --ref ./inputs/logo-{loja}.png \
  --ref ./inputs/{time}-01.jpg ... \
  --out-dir ./output/{time}-{loja}-{YYYY-MM-DD}/ \
  --fornecedor {FORNECEDOR_CAMISA} \
  --timeout 300000
```

**Sempre rodar em background** (`run_in_background: true`). Tempo médio: **~15-20 min** para 10 imagens.

### Etapa 6: Reportar resultado

Listar arquivos do output, ler `_resumo.json`, mostrar imagens-chave (V01 9:16 sempre, opcional V02-V05 9:16) e apresentar:
- Quantas completas / parciais / falhas
- Tempo total
- Observações de cascata entre variações (V03/V04/V05 podem herdar detalhes da V03 — flagar)

---

## 📝 Prompt template V1 cirúrgico

Salvar em `prompts/{time}-{loja}.txt`. Padrão (substitua variáveis pelo contexto real):

```
Troque a identidade desta arte mantendo fonte e estilo para a camisa do {TIME_DESTINO} em anexo.

Troque o manto do {TIME_REFERENCIA} pelo {TIME_DESTINO} {TEMPORADA}

Substitua o título "{TITULO_DA_ARTE_REF}" pelo título "{TITULO_ADAPTADO_DESTINO}"

Troque o preço "{PRECO_OU_OFERTA_DA_REF}" pela oferta "{OFERTA_DESTINO}"

Troque o logo {LOJA_REFERENCIA} pelo logo da {LOJA_DESTINO} (segunda imagem em anexo)

Troque os selos do rodapé "{SELOS_REF}" por "{SELOS_DESTINO}"

Adapte a paleta {DESCRICAO_PALETA_REF} para a paleta oficial do {TIME_DESTINO} ({CORES_AQUI}), mantendo o estilo {DESCRICAO_ESTRUTURA_VISUAL}

{LIMPEZA_ESPECIFICA_OPCIONAL — ex: "Remova as flechas com oferta", "Remova as estrelas decorativas"}

Adicione de alguma maneira a taça da {COMPETICAO_RELEVANTE}

TODOS os textos da arte devem estar em {IDIOMA_FINAL}

Defina a proporção como 9:16
```

### Princípios de escrita do prompt

1. **Frases curtas no imperativo** — "Troque X", "Remova Y", "Adicione Z"
2. **Aspas no que vai ser substituído** — `"KIT CASAL — CAMISA MASCULINA E FEMININA"` → `"ARSENAL 2025/26 — NEW JERSEY"`
3. **"De alguma maneira"** quando quiser deixar espaço criativo — ex: "Adicione de alguma maneira a taça da Premier League" (ChatGPT decide COMO)
4. **Idioma em linha separada** quando for diferente de PT — ex: "TODOS os textos da arte devem estar em inglês britânico (British English)"
5. **Última linha sempre é proporção** — "Defina a proporção como 9:16"
6. **Sem markdown, sem bullets** — texto corrido com linhas em branco entre comandos

### Variáveis (eu preencho ao olhar a arte ref + briefing da loja)

| Variável | Como descubro |
|---|---|
| `{TIME_REFERENCIA}` | Olho a arte ref do Drive e identifico (ex: Brasil, Cruzeiro) |
| `{LOJA_REFERENCIA}` | Logo no topo da arte ref (ex: MD = Mantos do PH) |
| `{TIME_DESTINO}` / `{TEMPORADA}` | Input do user (ex: Arsenal 2025/26) |
| `{LOJA_DESTINO}` | Input do user (ex: GoalKit) |
| `{OFERTA_DESTINO}` | Input do user (ex: TAKE 3 PAY 2 / TAKE 5 PAY 3) |
| `{TITULO_DA_ARTE_REF}` | Olho a arte (ex: "KIT CASAL — CAMISA MASCULINA E FEMININA") |
| `{SELOS_REF}` | Olho o rodapé (ex: "Frete grátis | 3X sem juros | 5% off no pix") |
| `{SELOS_DESTINO}` | Input do user / mapeamento de loja (ex: "FREE SHIPPING WORLDWIDE") |
| `{COMPETICAO_RELEVANTE}` | Premier League / Champions League / Libertadores / Copa do Mundo |
| `{IDIOMA_FINAL}` | "português brasileiro" (default) ou "inglês britânico (British English)" |
| `{FORNECEDOR_CAMISA}` | Adidas / Nike / Puma / Umbro / Castore — passado ao script com `--fornecedor` |

---

## 🎨 As 5 variações cirúrgicas (V1-V5)

Hardcoded em `tools/chatgpt-playwright/gerar-tudo-num-chat.mjs`. Cada uma muda **um eixo único** a partir da V1-9:16 (ancorada explicitamente pra não pegar a 1:1 intermediária):

| # | Comando enviado |
|---|---|
| **V1** | Prompt cirúrgico completo (lido de `prompts/{time}-{loja}.txt`) |
| **V2** | `A partir da primeira arte 9:16 que você gerou (a base, não a 1:1), troque o estilo de background. Mantenha proporção 9:16.` |
| **V3** | `A partir da primeira arte 9:16 que você gerou (a base, não a 1:1), deixe a camisa em um mockup 3D padrão site da {FORNECEDOR}. Mantenha proporção 9:16.` |
| **V4** | `A partir da primeira arte 9:16 que você gerou (a base, não a 1:1), troque a fonte da arte e modifique um pouco a paleta de cores. Mantenha proporção 9:16.` |
| **V5** | `A partir da primeira arte 9:16 que você gerou (a base, não a 1:1), troque o estilo e posicionamento de algo. Mantenha proporção 9:16.` |

### Conversão 9:16 → 1:1 (frase TRAVADA — não parafrasear)

Depois de cada variação, o script envia exatamente:

```
Apenas adapte essa arte gerada acima para a proporção 1:1
```

Essa frase foi validada pelo Pedro como ideal — concisa, direta, sem espaço pra ChatGPT recriar a arte. Não enriquecer com "mantenha todos elementos" etc. **Está literal no código.**

### Fluxo final no chat (10 mensagens)

```
1. V1 9:16 (prompt cirúrgico completo + anexos)
2. "Apenas adapte essa arte gerada acima para a proporção 1:1"
3. V2 9:16 (background)
4. "Apenas adapte essa arte gerada acima para a proporção 1:1"
5. V3 9:16 (mockup 3D)
6. "Apenas adapte essa arte gerada acima para a proporção 1:1"
7. V4 9:16 (fonte + paleta)
8. "Apenas adapte essa arte gerada acima para a proporção 1:1"
9. V5 9:16 (estilo + posicionamento)
10. "Apenas adapte essa arte gerada acima para a proporção 1:1"
```

→ Total: **10 imagens**, ~15-20 min.

---

## 🏪 Mapeamento de lojas conhecidas

> **Importante**: a cada execução, fazer `WebFetch` novo pra confirmar dados atualizados. Esse mapeamento é só ponto de partida.

| Loja | Idioma | Frete | Oferta típica | Fornecedor cuidado |
|---|---|---|---|---|
| **GoalKit** (`goalkit-jerseys-2.myshopify.com`) | EN/PT | FREE SHIPPING WORLDWIDE | TAKE 3 PAY 2 / TAKE 5 PAY 3 | Variável |
| **Brasileiríssimo** (`brasileirissimostore.com`) | PT | Internacional USD | LEVE 3 PAGUE 2, LEVE 5 PAGUE 3 | Variável |
| **Loja da Torcida** (`lojadatorcida.com.br`) | PT | Nacional grátis | PIX 5% OFF, 3X sem juros | Variável |
| **Puskas Jersey Store** (`puskasjerseystore.com`) | EN | Free shipping from $25 | BUY 2 GET 3 | Variável |
| **Mantos do PH** (`mantosdoph.com.br`) | PT | Nacional grátis | COMPRE 2 LEVE 3 | Variável |
| **Diário Stores** (`diariostores.com`) | PT | Nacional | confirmar | Variável |
| **Coringão Shop** (`lojacoringaoshop.com`) | PT | Nacional | confirmar | Adidas |

---

## 🎨 Estratégias das 10 variações — ANGLE-DRIVEN

Hardcoded em `tools/chatgpt-playwright/gerar-tudo-num-chat.mjs`. Cada variação tem instrução específica.

> **Upgrade 2026-05-29 (João):** antes as 10 variações eram **cosméticas** (ângulo da camisa, tipografia, layout espelhado) — visualmente parecidas, o Andromeda colapsa em ~1 Entity ID → exploração desperdiçada. Agora cada variação é um **ÂNGULO distinto** (mensagem/emoção/headline diferente), virando um Entity ID separado. V1 segue intocada (controle = arte validada). Base teórica: [[sistema-criativos-meta]] (Lever QI/03-playbooks) — matriz Ângulo × Nível de Consciência (Schwartz). **Ainda não revalidado em run real — primeiro lote serve de teste.**

| # | Ângulo | Nível (Schwartz) | Lidera |
|---|---|---|---|
| V1 | BASE — arte validada adaptada (controle) | 3-4 | clareza |
| V2 | Cutuca a ferida / saudade | 1-2 (frio) | emoção/dor |
| V3 | Desafia o senso comum | 2-3 | crença |
| V4 | Identidade / pertencimento | 2-3 | identity labeling |
| V5 | Prova social / depoimento | 3-4 | justificativa |
| V6 | Oferta direta + urgência real | 4-5 (quente) | CTA |
| V7 | Ancoragem de preço / valor | 3 | crença |
| V8 | Contraste emocional (antes/depois) | 2-3 | emoção (delta) |
| V9 | Curiosidade / loop aberto | 1-2 | curiosidade |
| V10 | "Se você…" (auto-seleção, ajuda o algoritmo) | 2-3 | identificação |

Todas mantêm logo da loja + fotos do produto + cores do time + idioma — **muda só o ângulo/mensagem**. O chat já sabe o time/loja pela V1, então as instruções V2-V10 referenciam "o time"/"a torcida" genericamente (não mais "BRASIL"/"PUSKAS" hardcoded como antes).

Cada variação gera 2 imagens (9:16 stories + 1:1 feed) = **20 imagens totais por execução**.

---

## ⚙️ Arquitetura técnica

### Arquivos em `tools/chatgpt-playwright/`

| Arquivo | Função |
|---|---|
| `package.json` | deps + scripts npm |
| `login.mjs` | Login manual 1x (sessão persiste ~30d) |
| `generate.mjs` | Gera 1 imagem só (debug) |
| `gerar-tudo-num-chat.mjs` | **Orchestrator principal** — 5 vars × 2 proporções num único chat |
| `prompts/{time}-{loja}.txt` | Prompt V1 cirúrgico (gerado dinamicamente) |
| `inputs/` | Refs (gitignored): `referencia.png`, `logo-{loja}.png`, `{time}-NN.jpg` |
| `output/{time}-{loja}-{YYYY-MM-DD}/` | Resultado: `v0X-9x16.png`, `v0X-1x1.png`, `_resumo.json` |
| `.session/` | Cookies ChatGPT (gitignored) |

### Funções críticas no `gerar-tudo-num-chat.mjs`

**`typeAndSend(page, prompt)`** — fix 2026-05-27:
1. Click no editor
2. **`Ctrl+A` + `Delete`** — limpa texto residual (sem isso, prompts de chats anteriores se misturam → "Frankenstein")
3. **Split por `\n`, intercalar `Shift+Enter`** — preserva quebras de linha (`\n` cru é ignorado no ProseMirror do ChatGPT)
4. Click no botão Send (fallback Enter)

**`waitForNewImage(page, preExisting, timeoutMs)`** — detecção robusta:
- Snapshot pré-prompt de todos `<img>` na página
- Filtra **maior imagem nova** (não-data, não-blob, > 400px natural, > 200px display)
- Imune a mudanças de DOM do ChatGPT

### Tempo médio (refinado 2026-05-27)

- 1 imagem (9:16 ou 1:1): 60-120s
- 1 par (9:16 + 1:1): 150-200s
- **5 variações (10 imgs): ~15-20 min total** (era 25-45 min com 10 variações)

---

## 🐛 Issues conhecidos / Roadmap

### ✅ Resolvidos (2026-05-27)
- ~~V10 crasha o browser~~ — cortamos pra 5 variações
- ~~Timeouts 1:1 esporádicos~~ — frase travada concisa "Apenas adapte essa arte gerada acima para a proporção 1:1" não causa mais timeout
- ~~Variações ficam quase idênticas~~ — eixos cirúrgicos (background, mockup 3D, fonte+paleta, estilo+pos) garantem distinção
- ~~Prompt Frankenstein (texto residual misturando)~~ — fix `Ctrl+A+Delete` no `typeAndSend`
- ~~Quebras de linha comidas~~ — fix split + `Shift+Enter` no `typeAndSend`

### 🔴 Críticos abertos
- (nenhum no momento)

### 🟡 Médios abertos
- [ ] **Cascata entre variações** — elementos novos introduzidos na V3 (ex: cadeado no logo GoalKit) propagam pra V4 e V5 mesmo com "primeira arte 9:16". Causa: ChatGPT pode estar lendo elementos das variações intermediárias. Solução candidata: enriquecer V2-V5 com "Mantenha o logo, oferta, idioma e tipografia IDÊNTICOS à primeira arte 9:16 — só altere o eixo específico."
- [ ] **`fallback Enter` ocasional** — o seletor do botão Send às vezes não é encontrado e o script cai em pressionar Enter. Funciona mas vale revisar seletores. Visto em V01 1:1 do run Arsenal/GoalKit.
- [ ] **Refazer só as variações falhas** — flag `--retry-failed` lendo `_resumo.json`
- [ ] **Drive autenticado** — sem MCP do Drive ativo, user precisa baixar manualmente. Investigar instalar MCP Google Drive na sessão Lever.

### 🟢 Melhorias
- [ ] **Mapping de lojas em config JSON** (em vez de hardcoded na skill)
- [ ] **Mapping de times em config JSON** (cores + competição + fornecedor)
- [ ] **Notificação Telegram/Discord** quando terminar
- [ ] **Preview HTML** das 10 imagens lado a lado pra avaliar rápido
- [ ] **Auto-upload pro Drive** da pasta gerada
- [ ] **A/B test stats** — qual variação converteu melhor (integração com Meta Ads MCP)

---

## 📜 Histórico de runs validados

| Data | Combinação | Resultado |
|---|---|---|
| 2026-05-21 | Corinthians + Brasileiríssimo | ✅ 1 arte (3 iterações pra ajustar) |
| 2026-05-22 | Palmeiras + Loja da Torcida | ✅ 1 arte |
| 2026-05-22 | Seleção Brasil + Puskas Jersey | ✅ 1 arte |
| 2026-05-22 | Seleção Brasil + Puskas Jersey | ✅ 16/20 imagens em 42 min (lote 10 variações) |
| 2026-05-27 | **Aston Villa + Mantos do PH** (Pedro manual) | ✅ Validou estilo cirúrgico — referência da nova abordagem |
| 2026-05-27 | **Arsenal + GoalKit** (5 vars novo modelo) | ✅ **10/10 em 15.3 min** — primeiro lote completo no novo padrão |

---

## 🚀 Como invocar (linguagem natural)

User pode falar de várias formas:

```
gera variações de criativo do Arsenal pra GoalKit
URL: https://goalkit-jerseys-2.myshopify.com/products/jersey-arsenal-202526-i-fan
idioma inglês britânico
oferta TAKE 3 PAY 2 / TAKE 5 PAY 3
frete FREE SHIPPING WORLDWIDE
```

```
cria criativos Palmeiras × Loja da Torcida
https://lojadatorcida.com.br/products/camisa-palmeiras-2026-27
```

```
adapta arte da semana pra Brasil na Puskas Jersey usando
https://puskasjerseystore.com/products/brasil-2026-away-longsleeve
```

Eu detecto:
1. Time mencionado
2. Loja destino mencionada
3. URL Shopify
4. (Opcional) Idioma específico
5. (Opcional) Oferta + frete específicos
6. (Opcional) Arte de referência específica

---

## ⚠️ Checklist do orquestrador

1. **Olhar a arte de referência ANTES de escrever o V1** — extrair título, selos, paleta, elementos a remover
2. **Apresentar V1 pro user confirmar** antes de disparar (variáveis preenchidas)
3. **Idioma**: perguntar quando a loja for internacional (default PT)
4. **Limpar `inputs/`** antes de cada execução
5. **Rodar em background** (`run_in_background: true`)
6. **Não fechar a janela do Chromium** — deixar o robô trabalhar
7. **Se uma variação falhar, continuar** — não parar o lote inteiro
8. **Avisar quando terminar** com resumo + mostrar V01 9:16 mínimo
9. **Verificar sessão ChatGPT** — se logout, rodar `npm run login` primeiro
10. **Output nomeado por data** (`{time}-{loja}-{YYYY-MM-DD}`) — sem timestamp epoch, mais legível

---

## 🗂️ Relacionado

- **Tool dir**: `tools/chatgpt-playwright/`
- **Memória do projeto**: `[[project_chatgpt_playwright_criativos]]`
- **Engenharia geral**: `[[CLAUDE.md]]` (regra zero — invocar essa skill quando user pedir criativos)
- **Refino 2026-05-27**: prompt cirúrgico + 5 variações de eixo único + frase travada 1:1
