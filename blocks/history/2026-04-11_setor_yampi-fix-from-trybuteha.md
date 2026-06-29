# Bloco: Yampi Fix Setor Esportes (Trybuteha → Setor)

## Operacao
- **Data:** 2026-04-11
- **Origem:** Trybuteha (1e5qe2-2m.myshopify.com, tema 158280909037 "Tema Yampi") — Yampi 100% funcional
- **Destino:** Setor Esportes (wbreb0-cs.myshopify.com, tema 153049596094) — Yampi nao funcionava
- **Idioma:** BR
- **Validacao:** 100% — sintaxe Liquid balanceada em todos os arquivos
- **Status:** Aplicado, aguardando teste browser

## Problema original
Setor tinha Yampi configurada (settings, snippet, theme.liquid render) mas o botao FINALIZAR COMPRA no drawer nao funcionava. Tentei varias adaptacoes (button submit, anchor, branches multiplos) sem sucesso. Ao comparar com Trybuteha (que funciona), achei 4 diferencas criticas.

## Diferencas identificadas

| Componente | Trybuteha (funciona) | Setor (nao funcionava) |
|---|---|---|
| `YampiSnippet.liquid` | 367 linhas, versao limpa | 530+ linhas, versao antiga com auto-injecao em forms |
| `theme.liquid` (load Yampi) | UNCONDICIONAL `{% include %}` antes de </body> | CONDICIONAL `{% if checkout_type == 'yampi' %}{% render %}{% endif %}` |
| Cart drawer button | Sem botao no drawer (so VER CARRINHO) | 3 branches yampi/cartpanda/default |
| main-cart-footer | Botao unico `yampi-checkout-btn` com `onclick="yampiClick()"` | 3 branches yampi/cartpanda/default |

## Solucao aplicada

### 1. snippets/YampiSnippet.liquid (Setor)
SUBSTITUIU pela versao limpa de 367 linhas da Trybuteha. Removeu:
- Auto-injecao de `ymp-CrtpageMainFrm` em forms
- Auto-walker que procura `<form action="/cart">` e modifica botoes
- Codigo legacy de checkbox/redirect que dependia de estruturas antigas

Manteve:
- Variaveis JS globais (cartEndpoint, statusEndpoint, shop, shopifyInternalUrl)
- `yampiClick()` — funcao principal que faz POST pra api.dooki.com.br e redireciona
- Loader animado
- UTM tracking helpers
- Listener pra `template.name == 'cart'` que pode auto-redirecionar se skip_cart ativo

### 2. layout/theme.liquid (Setor)
TROCOU o render condicional pelo include UNCONDICIONAL:
```liquid
<!-- Nao remova. Checkout Yampi. -->
{% capture yampi_snippet_content %}{% include 'YampiSnippet' %}{% endcapture %} 
{% unless yampi_snippet_content contains 'Liquid error' %} 
  {% include 'YampiSnippet' %} 
{% endunless %}
<!-- Nao remova. Checkout Yampi. -->
```
Garante que `yampiClick()` SEMPRE esta disponivel globalmente em toda pagina.

### 3. snippets/cart-drawer.liquid (Setor) — ADAPTACAO
Trybuteha NAO tem botao no drawer, mas o usuario quer no Setor. Adaptei criando um botao unico que chama `yampiClick()`:
```html
<button type="button" id="yampi-checkout-btn-drawer" class="cart__checkout-button button"
        onclick="yampiClick()" {% if cart == empty %}disabled{% endif %}
        style="background: #22c55e; color: #000; ...">
  Finalizar Compra
</button>
```

### 4. sections/main-cart-footer.liquid (Setor)
APLICOU exatamente o pattern da Trybuteha — botao unico com `onclick="yampiClick()"` na pagina /cart, sem branches.

## Como yampiClick() funciona (do YampiSnippet)
```js
function yampiClick() {
  showYampiLoader();
  getAjax('/cart.json', function (response) {
    var cartPayload = JSON.parse(response);
    var data = { 
      shop: window.location.host, 
      shopify_internal_domain: shopifyInternalUrl, 
      cart_payload: cartPayload 
    };
    postAjax('https://api.dooki.com.br/v2/public/shopify/cart', JSON.stringify(data), function (response) {
      var resp = JSON.parse(response);
      window.location.href = ymp_getUrlWithUtms(resp.checkout_direct_url);
    });
  });
}
```

1. Mostra loader
2. Pega `/cart.json` (estado atual do carrinho)
3. POST pra `api.dooki.com.br` com shop URL + cart payload
4. Yampi devolve `checkout_direct_url`
5. Redireciona pro checkout

## Backups
Todos os 4 arquivos originais salvos em `blocks/backups/2026-04-11_setor-esportes_*.bak`. Rollback via:
```bash
node .claude/lib/code-blocks-backup.mjs # importar restoreAsset
```

## Verificacao end-to-end (pendente browser test)
1. Preview: `https://wbreb0-cs.myshopify.com/?preview_theme_id=153049596094`
2. Adicionar produto, abrir cart drawer
3. Console: `typeof yampiClick === 'function'` → true
4. Clicar FINALIZAR COMPRA → loader Yampi aparece → redirect pro checkout

## Cuidados / Licoes aprendidas
- **Yampi requer registro no backend (api.dooki.com.br)**: se a loja nao esta na conta Yampi, mesmo com codigo correto a API retorna `checkout_direct_url` vazio. Verificar no painel Yampi se Setor (`wbreb0-cs.myshopify.com`) esta listada.
- **Versao do YampiSnippet importa**: a versao antiga (530+ linhas) com auto-injecao em forms causa conflitos com themes Dawn-based modernos. Preferir a versao limpa de 367 linhas.
- **Load unconditional > render conditional**: usar `{% include %}` no theme.liquid garante que o snippet sempre carrega independente de settings, evitando bugs onde o setting nao foi salvo corretamente.
- **`yampiClick()` e uma funcao global**: pode ser chamada de qualquer lugar (drawer, cart page, popup, link). Nao precisa estar dentro de form especifico.

## Candidato?
Sim — Trybuteha continua sendo o melhor exemplo de Yampi. Setor agora tambem (depois desse fix). Ambas viraram referencia.
