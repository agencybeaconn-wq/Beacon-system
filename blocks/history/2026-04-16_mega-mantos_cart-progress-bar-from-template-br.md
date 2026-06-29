# Bloco: Cart Progress Bar v3 (Template BR → Mega Mantos)

## Operação
- **Data:** 2026-04-16
- **Origem:** Template BR (testeloja-9899.myshopify.com) theme=160282804466 — "Tema Lever Atualizado 18/03"
- **Destino:** Mega Mantos (loja-mega-manto.myshopify.com) theme=181274935407 — "Tema Lever / Mega Mantos" (unpublished)
- **Idioma:** BR → BR
- **Validação:** 100% (validateAll OK, warning falso positivo nos renders de icon dentro do case/when)
- **Status:** Aplicado

## Decisão de escopo — merge cirúrgico, não substituição

Pedido do colaborador: "só traz o que agregar, mantém as coisas deles" e "deixa o nosso layout de dentro da camisa que temos".

Cart-drawer atual do Mega Mantos já tem:
- Footer customizado (Subtotal explícito + banner verde de cupom + Total com estilos inline próprios)
- Layout interno do item: "Quantidade: N, Tamanho: X, Personalizar Camisa (Nome e Número): Y" — formato que o cliente quer
- Sem quantity stepper (usa qty fixa) — cliente prefere assim

**Decisão:** NÃO substituir `cart-drawer.liquid`. Só atualizar progress-bar + criar icon-home + desativar chaveiro.

## Arquivos tocados
| Arquivo | Antes | Depois | Diff |
|---|---|---|---|
| snippets/cart-progress-bar.liquid | 14.901 B | 15.953 B | +1.052 |
| snippets/icon-home.liquid | inexistente | 447 B | novo |
| config/settings_data.json | 21.878 B | 18.305 B | bonus_2_enabled: true→false (+ reformatação JSON) |

## Features trazidas do Template BR (v3)
1. **`case milestone_0_icon`** — antes era hardcoded `icon-shirt` no stage 0, agora respeita setting (home/shirt/gift/custom)
2. **`when 'home'` adicionado em milestone_1_icon e milestone_2_icon** — permite usar casinha em qualquer stage
3. **Condicional `and shirt_count >= 1` em bonus_1** — banner Frete Grátis só aparece quando tem item
4. **Condicional `and shirt_count >= goal_1` em bonus_2** — banner do goal 1 só aparece após atingir
5. **`bonus_2_text_max`** — texto alternativo ao atingir goal_2 (11 mensagens dinâmicas)

## NÃO copiado (preservado do Mega Mantos)
- `snippets/cart-drawer.liquid` — intacto (layout interno do item preservado)
- Settings: milestone_1_badge="Leve 3", milestone_1_icon="star", milestone_1_quantity=3, milestone_2_icon="custom", milestone_2_custom_svg, messages 0-6_plus — tudo preservado
- Footer customizado (Subtotal + banner verde cupom + TOTAL + CTAs)

## Ajuste pontual — chaveiro removido
- `settings.bonus_2_enabled = false`
- Motivo: colaborador pediu "tira o chaveiro". Default do schema era `true` + `bonus_2_text = "Você ganhou 1 chaveiro de brinde"`. Cliente não tem brinde de chaveiro na promo — só Frete Grátis (bonus_1) + camisa grátis (milestone_1 via BXGY).

## Backups
- `blocks/backups/2026-04-16_mega-mantos_snippets__cart-progress-bar.liquid.bak`
- `blocks/backups/2026-04-16_mega-mantos_config__settings_data.json.bak`

## Dependências verificadas no destino
- `snippets/icon-shirt.liquid` — existe (692 B) ✓
- `snippets/icon-gift.liquid` — existe (872 B) ✓
- `snippets/icon-home.liquid` — criado nesta operação (447 B) ✓

## Lições
- Ler a demanda com atenção: "agregar" ≠ "substituir". Cart-drawer atual tinha customizações específicas do cliente que substituição teria apagado.
- Ao copiar blocos, checar **defaults do settings_schema.json** — pitfall: o schema sozinho injeta valores (tipo "chaveiro de brinde") em lojas que nunca configuraram o setting.
- Progress-bar v3 é settings-driven — seguro de trocar inteiro porque não carrega conteúdo, só estrutura.

## Candidato?
- Pendente. A v3 do progress-bar já é candidato #1 BR desde 2026-04-13 (Foot Mania → JGS → Template). Esta operação só confirma reuso.

---

## Adendo 2026-04-16 — properties stacked + quantity stepper

Dois ajustes incrementais no cart-drawer.liquid (sem substituir o arquivo):

### (1) CSS properties stacked
Layout interno do item estava condensado numa linha. Injetado bloco CSS antes do `</style>`:
- `.cart-item__properties` — flex column, gap 4px
- `.product-option` — flex baseline
- `dt` cinza #888, `dd` preto #222 em negrito
- `.quantity-line` — divisor inferior sutil
- +876 B (20.901 → 21.777)

### (2) Quantity stepper com regras de exclusão
Pedido: "seletor de quantidade seguindo as regrinhas — não pode em personalizadas nem em promoções".

Injetado (sem substituir nada):
- **CSS stepper** — `.cart-item__quantity-wrapper`, `.cart-qty-btn`, `.cart-qty-input` com estilo minimal (borda 1px, bg #f5f5f5)
- **`assign is_customized`** no bloco `{%- liquid -%}` do item — detecta `Nome`, `Número`, `Numero`, `Patches`, `_pairing_id`
- **Condicional** no quantity-line:
  - `item.final_price > 0 AND is_customized == false` → STEPPER (+/-)
  - caso contrário (gratuito BXGY ou personalizado) → texto estático "Quantidade: N"
- **`<script>` handler** antes de `</cart-drawer>` — listener em `.cart-qty-btn` chama `cartItems.updateQuantity(index, newQty, e)`
- +3.623 B (21.777 → 25.400)

### Backups
- `blocks/backups/2026-04-16b_mega-mantos_snippets__cart-drawer.liquid.bak` (antes do CSS properties)
- `blocks/backups/2026-04-16c_mega-mantos_snippets__cart-drawer.liquid.bak` (antes do stepper)

### Pitfalls preexistentes detectados (NÃO corrigidos — preservação)
- `<a href="/checkout">` no footer custom (pitfall Lever #1) — o colaborador optou por manter layout atual deles
- Classe `button` extra em `.cart__checkout-button button` (pitfall #2)
Flag: se aparecer falha silenciosa de checkout em loja com senha, trocar por `<button type="submit" name="checkout" form="CartDrawer-Form">`.

---

## Adendo 2026-04-16 (3) — BXGY split visual (paid + free rows)

### Problema
Shopify BXGY aplica desconto em N items do MESMO variant agrupados numa única line item (`item.quantity = 3`, `line_level_discount_allocations[].amount = 1 × preço unit`). A v3 do Template BR só tratava o caso "linha inteira grátis" (`item.final_price == 0`), não "qty=3 com 1 grátis". Visual: carrinho mostrava stepper em 3 sem destacar qual era a grátis.

### Solução
Modificação cirúrgica no snippet que:
1. **Calcula** `line_discount_total`, `n_free`, `paid_qty`, `split_passes` no bloco `{%- liquid -%}` do loop de itens
2. **Envolve** toda a `<tr>` em `{% for pass in (1..split_passes) %}` — roda 2x se houver split, 1x caso contrário
3. **Define por pass:** `row_qty` (qty mostrado), `row_is_free` (flag da linha)
4. **Substitui** condicionais `item.final_price == 0` por `row_is_free` na classe da row, no price row, na guard do stepper, na guard do remove button
5. **Usa `row_qty`** no display estático da quantidade e nos `data-qty`/`value` do stepper
6. **Wrap discount labels** em `{% if split_passes == 1 or row_is_free %}` — aparece só na linha grátis quando split, ou na linha única caso contrário
7. **Row grátis quando split_passes==2** ganha classe extra `cart-item--bonus` e id sufixo `-free` (evita colisão com row paga)

### Comportamento
- **3 camisas iguais + BXGY cheapest:** renderiza Row A (qty=2, preço normal, stepper +/-) e Row B (qty=1, badge 🎁 GRÁTIS, preço riscado, label "Promoção X", sem stepper, sem botão remover)
- **3 camisas diferentes + BXGY cheapest:** Shopify já separa em line items; comportamento original se mantém (a linha mais barata fica com `final_price=0`)
- **Sem BXGY ativo:** `n_free=0`, `split_passes=1`, render idêntico ao antes

### Arquivo tocado
| Arquivo | Antes | Depois | Diff |
|---|---|---|---|
| snippets/cart-drawer.liquid | 37.511 B | 39.678 B | +2.167 |

### Backup
- `blocks/backups/2026-04-16e_mega-mantos_snippets__cart-drawer.liquid.bak` (v3 pura, antes do split)

### Script de patch
- `c:/tmp/patch-split.mjs` (reutilizável pra aplicar em outras lojas com v3)

### Candidato?
**Forte candidato #1 BR carrinho-lateral categoria "BXGY split"** — resolve problema real do BXGY nativo Shopify que nenhuma loja BR tratava. Se aprovado, subir pro Template BR e para as demais lojas com v3 (Foot Mania, JGS, Golaço, Template BR).
