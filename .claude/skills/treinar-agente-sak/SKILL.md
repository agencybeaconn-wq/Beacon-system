---
name: treinar-agente-sak
description: Cria/configura um agente de IA conversacional no SAK (Agentes de IA, app.sak.com.br/agents) treinado nas conversas REAIS de WhatsApp do cliente + nas políticas oficiais do site. Use quando o pedido for "criar/treinar um agente de atendimento no SAK baseado nas conversas", "configurar o Agentes de IA do SAK pra loja X", ou "monta um bot de atendimento igual fizemos pra Bulls/Mantos". Lê conversas via CDP (Chrome de debug), raspa políticas via firecrawl, sintetiza o prompt cobrindo cada objeção, e preenche a UI do SAK.
argument-hint: <cliente / nº do agente>
---

# Treinar Agente SAK

Pipeline pra virar conversa real + política oficial num agente do **Agentes de IA do SAK**. Mesma "voz Lever no zap" da skill `heloisa-reply` (apresentação 1×, sem corporate, 1-3 frases). Exemplo real: agente **Téo** (MANTOSDOPH SPORTS, id 1402) — ver `example-mantos-teo.md` nesta pasta.

## Pré-requisitos

- Chrome de debug com CDP na `:9222`, logado no SAK do cliente + WhatsApp Web do número. Setup do Chrome: ver skill `conectar-sak-whatsapp-cloud-api` (perfil copiado + `--remote-debugging-port`).
- `playwright-core` pra dirigir via CDP (conecta com `chromium.connectOverCDP('http://127.0.0.1:9222')`).
- firecrawl pra raspar o site.

## Fluxo

### 1. Ler conversas (só LIDAS e RESPONDIDAS)
- WhatsApp Web: lista = `#pane-side [role="row"]`; cada chat tem `span[title]` (número/nome).
- **NUNCA abrir não lidas** — abrir marca como lida e manda tique azul pro cliente. Detecta unread por `[aria-label*="não lida"]` na row (ou texto "não lida") e **PULA**.
- Abrir cada chat com **clique REAL do Playwright** (`el.click()` sintético não abre). Extrair `#main .copyable-text[data-pre-plain-text]`; direção por `.message-out` (LOJA) vs `.message-in` (CLIENTE).
- Só conta conversa com **≥1 msg da LOJA** (lida + respondida). Alvo típico: 50.

### 2. Raspar políticas do site (firecrawl)
- `firecrawl_map` no domínio → achar `/pages/` (envios-e-prazos, trocas-e-devolucoes, politica-de-cancelamento-e-reembolso, rastreio, compra-segura, sobre-nos) e o `/agents.md`.
- `firecrawl_scrape` markdown de cada página.

### 3. Analisar
- Frequência de temas nas msgs do CLIENTE (rastreio, taxa, troca, prazo, pagamento, disponibilidade, tamanho).
- Repertório da LOJA: deduplicar msgs (normalizar nº/link) → saudação padrão, política de prazo, "pede nº do pedido ou nome do titular", etc.
- Listar **cada tipo de objeção**.
- **Cruzar site × WhatsApp** e flagar divergências (ex prazo de entrega no site × no atendimento) pro humano decidir antes de aplicar.

### 4. Sintetizar o config
- **Descrição** curta. **Tom** (sliders). **Voz** (regras estilo Bia/heloisa: apresentação 1×, sem travessão/reticências/dois-pontos/parêntese, 1-3 frases, empatia ANTES da regra, **nunca inventa status** — pede nº/nome e escala).
- **Instruções estruturadas**: Quem é / Responsabilidade / Objetivo / Regras (políticas + playbook por objeção + quando escalar + "nunca") / Assuntos proibidos.

### 5. Configurar a UI do SAK
- `/agents` → Criar agente → **Criar Novo**. **Foto é OBRIGATÓRIA** no create (`input[type=file]`, senão POST `/AgentsApi/create` volta 400 "Foto de perfil inválida"). Sobe via `setInputFiles`. Se o agente já existe, **edita** (`/agents/<id>/edit`).
- Aba **Personalidade**: Nome, Descrição, 4 sliders, "Instruções Gerais sobre modo de falar".
- Aba **Instruções**: Quem é (input) / Responsabilidade / Objetivo / Regras / Assuntos proibidos (textareas).

## Gotchas do SAK (críticos)

- **Form React reverte o campo** no re-render. NÃO usar `fill()` simples — usar o setter nativo: `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, v)` + `dispatchEvent(new Event('input'/'change',{bubbles:true}))`. **Sempre verificar com reload** depois do Salvar.
- **Sliders de tom são de 3 posições**: 0 (esquerda), 50 (Neutro), 100 (direita). Valor intermediário snapa pro mais próximo — só use 0/50/100.
- **Botões**: clicar por role ou marcando o elemento visível no DOM, não `getByText` solto (pega busca do topo / botões escondidos).
- **Ativação**: precisa de "Integração de IA" (chave LLM) no SAK pra testar/ativar o agente; e da integração da plataforma (ex Shopify) pra ler pedido/rastreio de verdade. Sem isso, o agente escala status pro humano (o prompt já manda fazer isso).

## Anti-padrões

- Abrir conversa não lida (queima tique azul). Só lidas+respondidas.
- Inventar política — sempre cruzar com o site oficial e flagar divergência.
- Confiar no Salvar sem reload de verificação (o React reverte).
- Slider em valor que não seja 0/50/100.
- Despejar política inteira no agente — o prompt deve mandar responder só o que foi perguntado.

## Aprendizados-fonte

- Sessão 2026-06-03 (Mantos do PH, agente **Téo** id 1402): primeiro uso. 50 conversas lidas+respondidas + 6 páginas do site + agents.md. Rastreio = 55% das dúvidas (≫ produto 35, pagamento/PIX 24, troca/reembolso 24). Descobertas que NÃO apareciam nas conversas: loja **ressarce 50% da taxa alfandegária**, **não troca por erro de tamanho**, **personalizado não cancela/reembolsa**, **taxa não paga = perde reembolso**. Divergência site (5-20 dias) × atendimento (10-25) → cliente escolheu 10-25. Documentados aqui o revert do React (setter nativo) e os sliders de 3 posições.
