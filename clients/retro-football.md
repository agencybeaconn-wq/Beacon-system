---
client_id: 8bf15616-dd2a-44ac-9ecd-030ba7cb6211
name: Retro Football
shopify_domain: y6s1mq-su.myshopify.com
status: connected
template: lever-br
tags: [client, br, active]
created: 2026-04-13
---

# ⚽ Retro Football

> Dashboard consolidado — tudo sobre a loja em um lugar.

## 🔗 Links rápidos

- [Admin Shopify](https://admin.shopify.com/store/y6s1mq-su)
- [Storefront](https://retrofootballshop.com.br)
- [Preview tema](https://y6s1mq-su.myshopify.com/?preview_theme_id=152427135168)
- Supabase ID: `8bf15616-dd2a-44ac-9ecd-030ba7cb6211`

## 📋 Estado atual

- **Tema ativo**: TEMA LEVER - PROVADOR VIRTUAL (after publish)
- **Integrações**: BK Reviews, Provador Virtual, Yampi? _(confirmar)_
- **Template base**: `lever-br`

## 🔨 Histórico de fixes aplicados

```dataview
LIST
FROM "blocks/history"
WHERE contains(file.content, "Retro Football") OR contains(file.content, "retrofootballshop")
SORT file.ctime DESC
```

## 📝 Notas soltas

- 2026-04-14: Aplicado fix `small--hide` no `product__title` → stars BK Reviews aparecem em mobile + desktop
- Tema duplicado 1x pra draft durante debug (restaurei header-group + footer-group que falharam no clone inicial)

## ✅ Pendências

- [ ] Verificar se tem outras integrações custom (Provador Virtual provavelmente precisa de config própria)
- [ ] Rodar `quality-gate` pra auditoria geral
- [ ] Confirmar que parcelamento e pricing estão corretos

## 🧠 Aprendizados específicos deste cliente

- A loja usa tema Lever customizado "PROVADOR VIRTUAL"
- BK Reviews instalado, mas **sem sync pros metafields nativos** do Shopify — depende 100% do JS do app
- Tem `header-group.json` e `footer-group.json` que podem falhar no `theme-duplicate` (hit rate ~99.5%, restaurar manual se faltar)

---

*Editável diretamente no Obsidian. Claude Code lê esse arquivo e usa como contexto.*
