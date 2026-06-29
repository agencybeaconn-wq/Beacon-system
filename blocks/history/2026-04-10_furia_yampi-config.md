# Bloco: Melhor Configuracao Yampi

## Operacao
- **Data:** 2026-04-10
- **Origem:** Furia (furiaimports.myshopify.com)
- **Destino:** Qualquer loja que use Yampi
- **Idioma:** BR
- **Status:** Candidato #1

## O que faz
Toggle no admin do tema pra trocar entre Yampi, CartPanda ou Nativo sem mexer em codigo.

## Lojas com Yampi (auditadas em 2026-04-10)
- **Furia** — MELHOR implementacao (toggle no admin)
- **JGS Sports** — padrao Yampi (include simples)
- **Setor Esportes** — era hardcoded, corrigido pra toggle
- **Triton Sports** — padrao Yampi (include simples)
- **Boutique do Boleiro** — Yampi duplicada + restos CartPanda

As outras 22 lojas NAO usam Yampi.

## Por que Furia e a melhor

| Aspecto | Furia (melhor) | Outras lojas (pior) |
|---|---|---|
| Toggle no admin | Sim — dropdown yampi/cartpanda/nativo | Nao — hardcoded no codigo |
| Botao checkout | href="/checkout" limpo | onclick hardcoded pra /apps/yampi/checkout |
| Troca de checkout | Sem mexer em codigo | Precisa editar theme.liquid |
| Tag body | Presente e correta | Algumas faltando |
| Liquid | render (moderno) | include (deprecado) |
| CartPanda compativel | Sim — mesmo toggle | Nao — snippet desabilitado |

## Como aplicar em outra loja (passo a passo)

### Passo 1 — settings_schema.json
Adicionar secao "Checkout Externo" no array:
```json
{
  "name": "Checkout Externo",
  "settings": [
    {
      "type": "header",
      "content": "Configuração do Checkout"
    },
    {
      "type": "paragraph",
      "content": "Selecione o tipo de checkout que deseja utilizar."
    },
    {
      "type": "select",
      "id": "checkout_type",
      "label": "Tipo de Checkout",
      "options": [
        {"value": "native", "label": "Nativo Shopify"},
        {"value": "yampi", "label": "Yampi"},
        {"value": "cartpanda", "label": "CartPanda"}
      ],
      "default": "native"
    },
    {
      "type": "header",
      "content": "CartPanda"
    },
    {
      "type": "text",
      "id": "cartpanda_endpoint",
      "label": "Endpoint CartPanda",
      "default": ""
    }
  ]
}
```

### Passo 2 — settings_data.json
Adicionar na secao "current":
```json
"checkout_type": "yampi"
```

### Passo 3 — layout/theme.liquid
Procurar qualquer bloco Yampi existente tipo:
```liquid
<!-- Nao remova. Checkout Yampi. -->
{% capture yampi_snippet_content %}{% include 'YampiSnippet' %}{% endcapture %}
{% unless yampi_snippet_content contains 'Liquid error' %}{% include 'YampiSnippet' %}{% endunless %}
<!-- Nao remova. Checkout Yampi. -->
```

Substituir por:
```liquid
{%- comment -%} CHECKOUT EXTERNO GERENCIADO PELO TEMA {%- endcomment -%}
{%- if settings.checkout_type == 'yampi' -%}
  {% render 'YampiSnippet' %}
{%- elsif settings.checkout_type == 'cartpanda' -%}
  {% render 'cartxCheckoutSnippet' %}
{%- endif -%}
{%- comment -%} FIM CHECKOUT EXTERNO {%- endcomment -%}
```

Garantir que `</body>` existe antes de `</html>`.

### Passo 4 — snippets/cart-drawer.liquid
Procurar botao hardcoded:
```html
onclick="event.preventDefault(); window.location.href='/apps/yampi/checkout';"
```

Substituir por:
```html
<a href="/checkout" class="cart__checkout-button button cartx-CrtpageMainFrm" style="width: 100%; display: flex; justify-content: center; align-items: center;">
  FINALIZAR COMPRA
</a>
```

### Passo 5 — sections/main-cart-footer.liquid
Mesmo fix do passo 4 — trocar onclick hardcoded por href="/checkout" com classe cartx-CrtpageMainFrm.

## Cuidados CRITICOS

1. **NUNCA copiar snippets/YampiSnippet.liquid entre lojas** — cada loja tem o SEU snippet com a SUA conta Yampi. Copiar = pagamento vai pra conta errada.
2. O toggle so troca qual snippet carrega — dados de pagamento sao do APP, nao do tema.
3. Precisa do app Yampi INSTALADO na Shopify pra funcionar. Sem app = 404 no /apps/yampi/checkout.
4. Classe `cartx-CrtpageMainFrm` e necessaria pro CartPanda interceptar o botao.
5. Se a loja NAO tem YampiSnippet.liquid, o toggle nao vai funcionar — precisa instalar o app primeiro que cria o snippet.

## Validacao depois de aplicar

- [ ] Admin do tema mostra dropdown "Checkout Externo"
- [ ] Selecionando "Yampi" e clicando "FINALIZAR COMPRA" vai pro checkout Yampi
- [ ] Selecionando "Nativo" vai pro /checkout da Shopify
- [ ] Botao da pagina do carrinho (/cart) tambem funciona
- [ ] Nenhum onclick hardcoded restante no codigo
