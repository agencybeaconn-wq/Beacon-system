# Padrão de rodapé — lojas Lever

Definido pelo João (2026-05-29). Aplicar em TODA loja nova.

## Ordem fixa das 4 colunas (esquerda → direita)
1. **Shop** — menu principal de categorias (`links` block → menu `main-menu`, title `<strong>Shop</strong>`)
2. **Help** — políticas/ajuda (`links` block → menu `footer`, title `<strong>Help</strong>`)
3. **Contact** — infos de contato (`text` block: email + horário de atendimento)
4. **Sign up** — newsletter / email (`newsletter` block) — **SEMPRE por último**

## Regras
- **Remover** "Download our app". No tema Vaurie/Nord-clone é hardcoded no `sections/footer.liquid`:
  ```
  <div id="appBarFooter">
    <p ...>Download Our App</p>
    {% render 'icon-app-stores' %}
  </div>
  ```
  Apagar esse `div`.
- Manter `trust-icons` (frete grátis / atendimento / pagamento seguro) **acima** da linha de blocos.
- Manter embaixo: copyright + country/locale selector + payment icons.
- Logos de app / faixa de logo rolando: remover (já fora do padrão).

## Como aplicar (footer-group.json → section "footer")
```json
"block_order": ["links_categories", "links", "contact_info", "newsletter"]
```
com:
- `links_categories`: `{ "type":"links", "settings":{ "menu":"main-menu", "show_menu_title":true, "menu_title":"<strong>Shop</strong>", "collapse_on_mobile":true } }`
- `links`: `{ "type":"links", "settings":{ "menu":"footer", "menu_title":"<strong>Help</strong>", ... } }`
- `contact_info`: `{ "type":"text", "settings":{ "title":"Contact", "content":"<p><a href='mailto:…'>…</a></p><p>Mon–Fri …</p>" } }`
- `newsletter`: `{ "type":"newsletter", "settings":{ "content":"<p>Sign up …</p>", "disclaimer_text":"<p>By signing up …</p>" } }`

Ref auto-memory: `feedback_store_footer_standard`.
