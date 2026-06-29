# cart-progress-bar

Barra de progresso de milestones para o carrinho — pattern **sliding window 2 estágios**.

## Origem
- **Loja**: Golaço (`smyvkp-2j.myshopify.com`)
- **Extraído em**: 2026-04-11
- **Versão**: v1 (candidato canônico BR)

## O que faz
Mostra uma barra de progresso no topo do cart drawer (e opcionalmente na cart page) que:

1. Conta **camisas no carrinho** (excluindo patches soltos detectados por `item.properties['Posição']` ou por `title contains 'patch'` — com whitelist de palavras camisa/jersey/manto/retrô/kit)
2. Divide em **2 estágios**:
   - Stage 1: 0 → `goal_1` (ex: 0 → 3 camisas → "Leve 3")
   - Stage 2: `goal_1` → `goal_2` (ex: 3 → 5 camisas → "Leve 5")
3. **Sliding window**: quando atinge `goal_1`, a barra "reseta" e começa a contar o progresso até `goal_2`
4. Mostra **11 mensagens dinâmicas** baseadas no total de camisas (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10+)
5. Renderiza **bônus visuais** (frete grátis, camisa brinde) que aparecem quando atingem thresholds

## Arquivos
```
cart-progress-bar.liquid    → snippets/cart-progress-bar.liquid
cart-progress-bar.js        → assets/cart-progress-bar.js
cart-progress-bar.css       → assets/cart-progress-bar.css
```

## Settings necessários no tema (`config/settings_schema.json` → grupo "Cart / Milestones")

| Setting | Tipo | Default | Descrição |
|---|---|---|---|
| `milestone_1_quantity` | number | 3 | Qty de camisas pra atingir milestone 1 |
| `milestone_1_badge` | text | "Leve 3" | Texto do badge |
| `milestone_1_icon` | select | gift | Ícone (gift/shirt/home/trophy/star/ball/custom) |
| `milestone_1_custom_svg` | html | "" | SVG custom (se icon=custom) |
| `milestone_2_quantity` | number | 5 | Qty pra milestone 2 |
| `milestone_2_badge` | text | "Leve 5" | |
| `milestone_2_icon` | select | gift | |
| `milestone_2_custom_svg` | html | "" | |
| `milestone_0_icon` | select | home | Ícone inicial (left edge) |
| `message_0` ... `message_9` | richtext | — | 10 mensagens por qty |
| `message_10_plus` | richtext | — | Mensagem pra qty ≥ 10 |
| `bonus_1_enabled` | checkbox | true | Mostrar bônus 1 (frete) |
| `bonus_1_text` | richtext | "Você ganhou Frete Grátis" | |
| `bonus_1_icon_svg` | html | — | |
| `bonus_2_enabled` | checkbox | true | Mostrar bônus 2 (camisa brinde) |
| `bonus_2_text` | richtext | "Você ganhou 1 camisa de brinde" | |
| `bonus_2_icon_svg` | html | — | |

## Dependências
- Snippets Dawn: `icon-home`, `icon-shirt`, `icon-gift` (o snippet usa `{% render 'icon-X' %}` com fallback SVG inline)
- CSS: `cart-progress-bar.css` (incluído nesta pasta)
- JS: `cart-progress-bar.js` (incluído nesta pasta)
- Eventos: escuta `cart:updated | cart:item-added | cart:item-removed | change` + MutationObserver

## Como aplicar numa loja (script deploy-store)

```js
// 1. Upload dos assets
await uploadAsset(theme, 'assets/cart-progress-bar.js', readFile('blocks/cart-progress-bar/cart-progress-bar.js'));
await uploadAsset(theme, 'assets/cart-progress-bar.css', readFile('blocks/cart-progress-bar/cart-progress-bar.css'));

// 2. Upload do snippet
await uploadAsset(theme, 'snippets/cart-progress-bar.liquid', readFile('blocks/cart-progress-bar/cart-progress-bar.liquid'));

// 3. Injetar settings no config/settings_schema.json
//    (ver JSON de schema em /blocks/cart-progress-bar/settings_schema.json — TODO)

// 4. Popular defaults em config/settings_data.json current.*
//    (via mergeSettings({...milestoneDefaults, ...briefingOverrides}))

// 5. Renderizar no cart-drawer.liquid / main-cart-items.liquid
//    {% render 'cart-progress-bar' %}
```

## Pitfalls conhecidos

- **Hard-code PT** em mensagens default — se loja for EN, sobrescrever no deploy
- **Custom SVGs gigantes** nos settings (>3KB cada) — impacta settings_data.json mas não runtime
- **Observação do DOM** pode conflitar com temas que re-renderizam muito — testar
- **Não funciona** se `cart_type != drawer` sem ajustar a integração na cart page

## Internacionalização (i18n)

Status: **pending** — strings estão em PT hard-coded no liquid (via settings.message_*). Pra loja EN, o script deploy precisa passar overrides EN nos settings.

Exemplo de overrides EN:
```json
{
  "milestone_1_badge": "Get 3",
  "milestone_2_badge": "Get 5",
  "message_0": "<p>🛒 Add <strong>3 shirts</strong> and pay for <strong>2!</strong></p>",
  "bonus_1_text": "You got <strong>Free Shipping</strong>",
  "bonus_2_text": "You got <strong>1 free shirt</strong>"
}
```

## Relacionado no Obsidian
- [blocos/cart-progress-bar](../../../Inteligencia lever/Lever QI/Shopify/blocos/cart-progress-bar.md)
- [blocos/_ranking](../../../Inteligencia lever/Lever QI/Shopify/blocos/_ranking.md)
- [lojas/golaco](../../../Inteligencia lever/Lever QI/Shopify/lojas/golaco.md)
