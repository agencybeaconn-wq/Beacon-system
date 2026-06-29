# shipping-calculator

Calculadora de frete por CEP (Correios) pra mostrar na página de produto ou cart.

## Origem
- **Loja**: Golaço (`smyvkp-2j.myshopify.com`)
- **Extraído em**: 2026-04-11

## O que faz

Bloco com 2 estados:
1. **Input** — campo CEP (mascara `12345-678`) + botão Calcular + link "Não sei meu CEP" apontando pra `buscacepinter.correios.com.br`
2. **Results** — mostra até 4 opções de frete configuradas nos settings do bloco (title + prazo), com botão Recalcular

## Arquivos
```
shipping-calculator.liquid         → snippets/shipping-calculator.liquid
component-shipping-calculator.css  → assets/component-shipping-calculator.css
```

## Settings do bloco (quando usado em section)

| Setting | Tipo | Default |
|---|---|---|
| `title` | text | "Calcule o frete e prazo de entrega" |
| `subtitle` | text | "Simule com seu CEP" |
| `option_1_title` | text | "Frete Padrão Grátis (7 a 15 dias)" |
| `option_2_title` | text | "Frete Expresso - R$27,90 (6 a 9 dias)" |
| `option_3_title` | text | "" |
| `option_4_title` | text | "" |

## Como usar

Dentro de um section (ex: `main-cart-footer.liquid` ou `main-product.liquid`):

```liquid
{% render 'shipping-calculator', block: block, section_id: section.id %}
```

## Pitfalls

- **As opções de frete são texto puro** — não são integradas ao shipping real do Shopify. O cliente só vê os valores que foram escritos nos settings do bloco. É um elemento de confiança/conversão, não um calculador real.
- **Hardcoded link Correios BR** — versão EN precisa trocar por ZIP lookup (ex: `usps.com`)

## i18n
- Status: **BR-only** — link Correios BR, labels em PT
- Pra EN: criar `blocks/shipping-calculator-en/` como variante separada

## Relacionado
- [../cart-page/manifest.md](../cart-page/manifest.md)
