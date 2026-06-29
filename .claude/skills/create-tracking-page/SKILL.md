---
name: create-tracking-page
description: Cria uma página de rastreio (tracking) numa loja Shopify, powered by 17TRACK e SEM backend. Layout com guia de 3 passos + card de busca + timeline (Placed/Shipped/Delivered). Cliente cola o código de rastreio → widget 17TRACK embutido (status real do carrier) + link deep do 17track. Adiciona a página no menu principal e no footer. Auto-contida no body_html (HTML+CSS+JS). Cor brand-adaptive via var(--color-button) do tema.
argument-hint: [nome do cliente] [--apply] [--handle=tracking] [--contact-handle=contact] [--no-menu] [--no-footer]
---

# create-tracking-page — Página de rastreio (17TRACK, sem backend)

Cria uma página `/pages/tracking` numa loja Shopify para o cliente acompanhar o pedido, e adiciona ao menu principal + footer.

## Quando usar

- Cliente pede "página de rastreio", "tracking", "acompanhar pedido", "página igual a [loja] de rastreio".
- Loja precisa de um ponto self-service de tracking sem instalar app pago.

## O que a página faz

- **Painel esquerdo:** guia "How to Track Your Order" em 3 passos (achar o código → colar e Track → acompanhar em tempo real).
- **Card direito:** input "Order Number or Tracking Code" + botão TRACK.
- **Ao buscar:**
  - **Código de rastreio** (ex: `LP123456789CN`) → badge "Shipped" + timeline Placed✓/Shipped✓/Delivered(active) + **widget 17TRACK embutido** (status real do carrier, client-side) + botão **"Verify on 17TRACK"** (`https://t.17track.net/en#nums=CÓDIGO`).
  - **Número de pedido** (`#1745` ou só dígitos) → badge "Order Confirmed" + nota pedindo o código de rastreio do e-mail + botão Contact (não dá pra resolver nº→status sem backend).
- Timeline visual Placed → Shipped → Delivered. Botão de suporte = "Contact Page" (sem WhatsApp).

## Decisão arquitetural — por que SEM backend (LEIA)

Páginas de tracking "premium" (ex: estilo Jersey Zone) buscam status pelo **número do pedido**, o que exige um **backend com acesso à Admin API** (dashboard Vercel próprio, ou app com scope `read_orders`). A maioria das lojas Lever **não tem isso**, e o token Lever geralmente **não tem `read_orders`**.

Esta skill usa o **widget oficial do 17TRACK** (`https://www.17track.net/externalcall.js` + `YQV5.add`), que resolve o status real **a partir do código de rastreio**, 100% client-side, sem backend. Por isso a página é **tracking-code-cêntrica**: o cliente usa o código que recebeu no e-mail de envio.

Se o cliente exigir lookup automático por **número de pedido**: precisa (a) Shopify Plus + checkout/app extension, ou (b) clonar um backend tipo dashboard Vercel apontando pra loja (token com `read_orders`), ou (c) app de tracking (ParcelPanel/17track) com app proxy. Fora do escopo desta skill.

## Como rodar

```bash
# DRY-RUN (não escreve nada — mostra o que faria)
node .claude/skills/create-tracking-page/create-tracking-page.mjs "GoalKit"

# Aplicar (cria página + adiciona no menu principal + footer)
node .claude/skills/create-tracking-page/create-tracking-page.mjs "GoalKit" --apply

# Opções
--handle=tracking            # handle da página (default: tracking)
--title=Tracking             # título (default: Tracking)
--contact-handle=contact     # handle da página de contato pro botão (default: contact)
--no-menu                    # não adiciona no menu principal
--no-footer                  # não adiciona no footer
```

Idempotente: se a página já existe (mesmo handle), **atualiza** o body_html. Se já está no menu/footer, **não duplica**.

## Detalhes técnicos

- **Página via REST** (`pages.json`) com `body_html` auto-contido (HTML+CSS+JS). Shopify **preserva `<script>`** quando criado via API (o editor visual removeria).
- **Cor brand-adaptive:** o CSS usa `rgb(var(--color-button))` do tema (fallback `37 99 235`) — se adapta à identidade da loja sozinho.
- **Menu/footer** via GraphQL `menuUpdate` (type PAGE, resourceId = page gid), preservando os itens existentes. Alvos: handles `main-menu` e `footer`.
- **Template:** `templates/tracking-widget.html`, com placeholder `{{CONTACT_URL}}` substituído pelo `/pages/<contact-handle>`.

## Regras Lever respeitadas

- **Zero emoji em texto visível** — o template usa só ícones SVG (sem 🚀🎁). Ver `feedback_no_emojis_use_icons`.
- **Sem WhatsApp** no card (só "Contact Page") — decisão de design da skill; ajuste o template se a loja quiser.
- A página é EN por padrão (texto do widget em inglês). Para loja BR, traduzir o template antes (ver dicionário em `code-blocks`).

## Verificação pós-apply

1. Abrir `https://<domínio-público>/pages/tracking` (NÃO o myshopify se tiver senha).
2. Colar um código de rastreio real → confirmar widget 17TRACK carregando + link.
3. Confirmar "Tracking" no menu principal e no footer.

## Lições / origem

- Nasceu da implementação manual na **GoalKit** (2026-06-02), inspirada na página da Jersey Zone Store (que usava backend Vercel próprio — inviável de copiar 1:1). Histórico em `code-blocks/blocks/history/2026-06-02_GoalKit_tracking-page.md`.
- **Read-after-write lag:** o Asset/Pages API pode retornar conteúdo stale logo após o PUT/POST. Re-verificar após ~3s.
