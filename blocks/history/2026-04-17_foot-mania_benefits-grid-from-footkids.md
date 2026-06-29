# Bloco: Benefits Grid + Custom Image (page de produto)

## Operação
- **Data:** 2026-04-17
- **Origem:** foot kids (5edf96.myshopify.com) — tema "Tema Lever 07/04" (`185067766040`)
- **Destino:** Foot Mania (fcrn0i-5c.myshopify.com) — tema "Lever | FootMania" (`160723632347`)
- **Idioma:** BR (ambos)
- **Validação:** 100% (`validateAll` sem erros em `sections/main-product.liquid`)
- **Status:** Aplicado — user vai adicionar via theme editor

## Arquivos tocados
| Arquivo | Antes | Depois | Diff |
|---|---|---|---|
| `sections/main-product.liquid` | 149.054 chars (25 blocks, 32 when cases) | 156.300 bytes (27 blocks, 34 when cases) | +7.087 chars, +2 block types, +2 when cases |

## Block types adicionados
1. **`benefits_grid`** — grade 4 benefícios com ícones SVG inline
   - settings: `title_1..title_4`, `desc_1..desc_4` (defaults PT)
   - defaults: "Personalização Exclusiva", "Enviamos Para Todo o Brasil", "1ª Troca Grátis e Fácil", "Qualidade Premium"
   - usa CSS `component-shipping-calculator.css` compartilhado
2. **`custom_image`** — imagem customizada com controle de margem (top/bottom)

## O que NÃO precisou ser copiado (já existia no FM)
Os outros elementos do "bloco circulado" do print **já eram block types no FM** e o user pode adicionar via theme editor:
- `rating` — widget 5/5 estrelas
- `promo_banners` — banner "TODAS AS PEÇAS POR R$X (CADA)", "LEVE 6 ganhe BOLA", "GANHE CHAVEIRO" (3 instâncias distintas na FK)
- `stories_row` — linha de stories
- `image_stories_row` — grid de fotos de clientes

## Razão do escopo mínimo
Diff do schema mostrou que FM já tinha 25/27 block types da FK. Em vez de sobrescrever `main-product.liquid` inteiro (risco de perder customizações do FM), foi feito **merge cirúrgico** apenas dos 2 faltantes. Defaults em PT preservados da FK.

## Backup
`blocks/backups/2026-04-17_foot-mania_sections__main-product.liquid.bak` — versão original do FM antes do patch.

## Próximo passo (user)
1. Abrir theme editor da Foot Mania → página de produto
2. Adicionar blocos na seção "main-product":
   - "Benefícios (Grade)" — o benefits_grid novo
   - "Imagem" (custom_image) — pra banners BOLA DA COPA / CHAVEIRO que tenham imagem
   - "Promo Banners" × 3 (já existia) — um pra cada promoção
   - "Rating" (já existia) — opcional
   - "Stories Row" / "Image Stories Row" (já existiam) — pra customer photos
3. Preencher textos conforme print da FootKids:
   - benefits: "PERSONALIZE DO SEU JEITO", "ENVIO COM RASTREIO PARA TODO O BRASIL", "1ª TROCA GRÁTIS E SEM BUROCRACIA", "QUALIDADE PREMIUM GARANTIDA"
   - promo banners: "TODAS AS PEÇAS POR R$109 (CADA)" / "LEVE 6 ou mais e ganhe BOLA DA COPA 2026" / "GANHE UM CHAVEIRO GRÁTIS na sua compra"

## Lições
- Scope read_publications ausente — import de produtos (mesma sessão) ficou ACTIVE mas sem publish automático.
- `String.replace` com `$` literal em replacement string dispara backreferences — usar função de replacement quando content contém `$NN` (ex: "R$109" causou erro até trocar pra callback).
- CRLF (`\r\n`) do Windows no asset do Shopify obriga normalização antes de `JSON.parse` no schema.

## Candidato?
Possivelmente — `benefits_grid` + `custom_image` são blocos universais úteis. Esperar confirmação do user antes de adicionar em `blocks/candidates/RANKING.md`.
