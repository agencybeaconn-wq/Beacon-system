# Loja da Torcida — Cart drawer mantido, Add to Cart e Checkout vão direto pro Yampi/Shopify

**Data:** 2026-05-12
**Loja:** Loja da Torcida (`xdppna-zt.myshopify.com` → `www.lojadatorcida.com`)
**Tema:** `Tema Lever Rolagem` (id 128963772488)
**Checkout:** Yampi (transparente, mas com setup incompleto na loja)

## Pedido do cliente

Cliente clicava em "Adicionar ao Carrinho" ou "Finalizar Compra" na PDP e era levado pro `/cart` (página intermediária Shopify) em vez de ir direto pro checkout. Eles querem pular o /cart sempre.

## Diagnóstico

A loja tem o script do app Yampi injetado via Shopify Theme App Extension (não está nos arquivos liquid do tema). Esse script:

1. Captura submits de forms Add to Cart e cliques em `a[href="/checkout"]`.
2. Faz `window.location = '/cart'` pra processar o cart pelo endpoint Yampi.
3. Em /cart, faz AJAX pro endpoint Yampi pra pegar `checkout_direct_url` e redirecionar.

Mas `window.yampiCheckoutUrl = ''` (vazio) no HTML servido — setup do Yampi incompleto na loja. Sem URL de checkout, o fluxo trava em /cart.

`settings.cartpanda_endpoint` também `undefined` — snippet `cartxCheckoutSnippet.liquid` existe mas nunca é renderizado.

Tentativa #1 (mudar `<a href="/cart" id="cart-icon-bubble">` → `<a href="/checkout">` sem id) **revertida** porque quebrou o drawer lateral inteiro: cliente perdia a UX de ver os itens antes de finalizar.

## Solução final

### `assets/lever-direct-checkout.js` (novo)

Script de bypass que roda em capture phase, antes do Yampi:

1. **Submit em `form[action*="/cart/add"]`** → `preventDefault` + `stopImmediatePropagation` + POST AJAX em `/cart/add.js` + redirect pra `/checkout`.
2. **Click em `a[href="/cart"]`** (qualquer link pra /cart no tema) → redirect pra `/checkout`.
   - **Exceção**: `#cart-icon-bubble` é ignorado pra permitir que o cart-drawer JS abra o drawer normalmente.
3. **Click em `a[href="/checkout"]`** → `stopImmediatePropagation` (impede Yampi de capturar) mas **sem preventDefault** — deixa o navegador navegar naturalmente pra `/checkout`.

Todos os 3 handlers em capture phase (`true`) pra rodar antes do listener Yampi.

### `layout/theme.liquid`

Script incluído no `<head>` SEM `defer`, antes de `constants.js`, pra garantir que ele registra os listeners antes do Yampi script injetado pelo app.

### `sections/header.liquid`

Mantido original (`<a href="{{ routes.cart_url }}" id="cart-icon-bubble">`). Drawer lateral funcionando normal.

## Validação

Pedro testou e confirmou: drawer abre, Add to Cart vai direto pro checkout, FINALIZAR COMPRA do drawer vai direto pro checkout. Sem `/cart` no meio.

## Backup

`c:/tmp/datorcida-backup-2026-05-12T13-14-28-129Z-theme.liquid` (theme.liquid original)
`c:/tmp/datorcida-backup-2026-05-12T12-22-18-854Z/header.original.liquid` (header original — também revertido pelo /push)

## Causa raiz: snippet Yampi fantasma (corrigido)

Investigação final revelou que a Loja da Torcida **não tem app Yampi instalado** — usa checkout nativo Shopify. O código Yampi vinha de `snippets/YampiSnippet.liquid` (hardcoded no tema, herdado de outra loja Lever clonada). Esse snippet:

1. Capturava submits e clicks
2. POST em `https://api.dooki.com.br/v2/public/shopify/cart` com `shop=xdppna-zt.myshopify.com`
3. Endpoint retornava 404 (loja não cadastrada no Yampi)
4. Script fazia `window.location = '/cart?ref=yampi_buy_button'` como fallback → cliente preso em /cart

**Fix:** comentar o `{%- render 'YampiSnippet' -%}` em `layout/theme.liquid:504`. Snippet em si mantido em `snippets/YampiSnippet.liquid` caso queiram reativar no futuro com app Yampi de verdade.

Sem o snippet fantasma, o fluxo fica limpo:
- Add to Cart → `lever-direct-checkout.js` faz AJAX em `/cart/add` + redirect pra `/checkout`
- `/checkout` → Shopify nativo (já que não tem Yampi)
- Cliente fecha venda normalmente

## Candidato a /code-blocks?

**Sim.** Padrão "Yampi quebrado → bypass via JS de capture phase" pode aparecer em outras lojas que clonam template Lever e instalam Yampi com setup incompleto. O `lever-direct-checkout.js` é genérico (não tem nada hardcoded da Da Torcida) — vale virar bloco quando aparecer 2ª loja com sintoma similar.

## Lições

- Quando integração de app (Yampi/CartPanda) tá quebrada, capture phase + `stopImmediatePropagation` é o jeito mais limpo de bypassar listeners de terceiros sem editar o app.
- "Tirar o carrinho lateral" do briefing inicial era ambíguo — cliente na verdade queria *manter* o drawer (UX de ver itens) e só pular o `/cart` intermediário no fluxo de compra.
- Sempre confirmar visualmente o sintoma exato ("pra onde está indo?") antes de assumir o fix.
