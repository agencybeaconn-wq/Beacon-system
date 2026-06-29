# Auditoria de identidade de cor — pós re-skin/clone de tema

**Regra (João, 2026-05-29):** em TODA implementação de tema (clone, re-skin, nova loja), garantir que a identidade visual esteja aplicada em CADA lugar — nenhum resíduo da paleta antiga. O `color_replacements` do clone NÃO basta sozinho: ele só troca os hexes que você lista, e cores da paleta velha ficam escondidas em lugares que o re-skin não varre.

## Onde as cores escapam (os esconderijos)
1. **`config/settings_data.json`** — os **color schemes** guardam hexes próprios (background/text/button/scheme-N). Re-skin por keyword não pega.
2. **`templates/*.json`** — **settings de bloco/seção** com cor hardcoded (ex: `badge_bg`, `pill_bg`, `bullet_check_color`, `hl_bg`, `text_color`). Cada instância de seção (ex: `vaurie-farewell`, `ai_gen_block`) carrega seus próprios hexes.
3. **`sections/*.liquid` e `snippets/*.liquid`** — defaults de cor no `{% schema %}` e CSS hardcoded (ex: a barra de countdown em `snippets/bundle-offer.liquid`).
4. **⚠️ Formato `rgb()`/`rgba()` (NÃO só hex)** — a MESMA cor pode estar escrita como `rgb(50, 30, 30)` ou `rgba(50, 30, 30, 0.93)` em vez de `#321e1e`. Um sweep só de hex NÃO pega. Converter cada hex da paleta antiga p/ rgb e procurar também: `#321e1e`=`rgb(50, 30, 30)`, `#14213d`(navy)=`rgb(20, 33, 61)`. Bug real Matignon 2026-05-29: o contador "Offer Ends In" continuou marrom depois do sweep de hex porque a cor estava em rgba. Também checar **named colors** (saddlebrown, etc.) e `hsl()`.

## Procedimento (rodar sempre ao fim do re-skin)
1. **Extrair todos os hexes** dos arquivos-chave. Puxar via `graphql_query` o `config/settings_data.json` + `templates/{product,index,collection}.json` (body content). Salvam em arquivo se grandes.
2. **Listar hexes únicos + flag de "fora da paleta"**. Script Python:
   ```python
   import re, collections
   hexes = collections.Counter(re.findall(r"#[0-9a-fA-F]{6}", content))
   def warm(h):  # detecta tons quentes (marrom/verde/bege) — ajustar p/ paleta do cliente
       r,g,b = int(h[1:3],16), int(h[3:5],16), int(h[5:7],16)
       return (r > b+12) and not (abs(r-g)<8 and abs(g-b)<8)
   ```
   Olhar a olho TODOS os hexes não-neutros (não só os "quentes" — o regex de warm falha p/ verde-oliva tipo `#52572e`; revisar a lista inteira).
3. **Montar mapa de substituição** → tudo da paleta antiga vira a nova identidade (escuro→`#14213d`, claros quentes→`#ffffff`, taupe→cinza neutro).
4. **Sweep server-side** com `clone_theme` **mesma origem=destino**, `include_only` nos arquivos com cor + `color_replacements` (mapa). Isso troca em TODOS os arquivos de texto sem reescrever inline e preserva edições.
   - `include_only` típico: `templates/product.json`, `config/settings_data.json`, `templates/index.json`, `templates/collection.json`, `sections/<custom>.liquid`, `snippets/<bundle/countdown/offers>.liquid`, `blocks/ai_gen_block_*.liquid`.
   - **Por que targeted e não full:** clone full (~250-580 arquivos) estoura o gateway (504). Targeted (~10) roda em <2s.
5. **Verificar**: re-puxar os arquivos e `grep` os hexes antigos → tem que dar **0**. Conferir visualmente PDP/home.

## Gotchas
- `clone_theme` **mesma origem=destino** funciona como find/replace in-place server-side (não precisa token local, não reescreve 20KB inline). 39 replacements em 1.8s no caso Matignon.
- `theme.css`/`theme.js` (URL-body) são pulados por `skip_binary` — mas a identidade vive nos schemes/JSON, então quase nunca é problema.
- Caso real Matignon 2026-05-29: 2 marrons (`#321e1e`, `#230f0f`), verde-oliva antigo (`#52572e`, `#40433d`), tijolo/coral (`#a32a1a`, `#e04837`), cremes (`#fbf4f1`/`#faf4f0`/`#f1e4d3`), taupe (`#736960`). O `#321e1e` estava em ~9 settings de bloco no `product.json` + defaults do `vaurie-farewell` + contador `bundle-offer.liquid`.

Ref auto-memory: `feedback_theme_color_identity_audit`. Ver [[footer-standard]].
