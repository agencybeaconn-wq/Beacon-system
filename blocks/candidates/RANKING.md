# Ranking de Candidatos

Separado por Template. BR nao vai pra EN. EN nao vai pra BR.

---

# TEMPLATE BR

Categorias: carrinho lateral, personalizacao, colecoes, produto, tema geral

## CARRINHO LATERAL

### Cart drawer completo (9 features + sanitize + bugfix)
| # | Origem | Data | Notas | Arquivo |
|---|---|---|---|---|
| 1 | Foot Mania | 2026-04-13 | Base Golaço (TG Jerseys) + fix 3 `<a>/<button>` malformados + remove green hardcoded + sanitize Yampi/Cartpanda + bonus_2_text sem `<p>` + subtotal removido (TOTAL com compare-at) + milestones settings-driven (home/gift/gift) + 11 mensagens dinâmicas por shirt_count | [cart-drawer.md](../history/2026-04-13_footmania_cart-drawer-from-golaco.md) |
| 2 | Golaço | 2026-04-11 | TG Jerseys traduzido BR com 9 features, iOS safe-area, Yampi compat | [cart-drawer-from-tg.md](../history/2026-04-11_golaco_cart-drawer-from-tg.md) |

## COLECOES

### Atribuicao de patches por competicao
| # | Origem | Data | Notas | Arquivo |
|---|---|---|---|---|
| 1 | Golaco | 2026-04-08 | 27 patches BR, 49 colecoes, 155 regras, fix Serie A | [patches-br.md](../history/2026-04-08_golaco_patches-br.md) |

### Barra de progresso (milestones / Buy 2 Get 3)
| # | Origem | Data | Notas | Arquivo |
|---|---|---|---|---|
| 1 | JGS + TG Jerseys | 2026-04-10 | Dual promo (Buy 2 Get 3 + Buy 3 Get 5), filtro por tag, exclui patches/shorts | Extraido de tmp_rewrite_progress.cjs + tmp_upload_progress_bar.cjs |

### Melhor configuracao Yampi
| # | Origem | Data | Notas | Arquivo |
|---|---|---|---|---|
| 1 | Furia | 2026-04-10 | Toggle no admin (yampi/cartpanda/nativo), sem hardcode, ref pra qualquer loja que use Yampi | [yampi-config.md](../history/2026-04-10_furia_yampi-config.md) |

### BK Reviews stars desktop (small--hide auto-inject)
| # | Origem | Data | Notas | Arquivo |
|---|---|---|---|---|
| 1 | Retro Football | 2026-04-14 | Adiciona classe `small--hide` no `<div class="product__title mobile-hidden-original">` desktop. JS do BK auto-injeta stars apos cada h1 (mobile + desktop). Sem div estatico, sem app block | [bk-reviews-stars-desktop.md](../history/2026-04-14_retro_bk-reviews-stars-desktop.md) |

---

# TEMPLATE EN

Categorias: carrinho lateral, personalizacao, colecoes, produto, tema geral

## COLECOES

### Atribuicao de patches por competicao
| # | Origem | Data | Notas | Arquivo |
|---|---|---|---|---|
| 1 | TG Jerseys | 2026-04-08 | 28 patches EN, 68 colecoes, 208 regras | [patches-en.md](../history/2026-04-08_tg-jerseys_patches-en.md) |

## PRODUTO

### BK Reviews stars desktop (small--hide auto-inject)
| # | Origem | Data | Notas | Arquivo |
|---|---|---|---|---|
| 1 | Retro Football | 2026-04-14 | Mesmo fix do BR, aplicado em lever-en/sections/main-product.liquid linha 333 | [bk-reviews-stars-desktop.md](../history/2026-04-14_retro_bk-reviews-stars-desktop.md) |
