---
name: configure-theme
description: Configura o tema Lever de uma loja Shopify — contato, announcement bar, milestones, frete, social links — a partir do briefing ou input manual.
argument-hint: [nome do cliente]
---

# Configurar Tema Lever

Configura settings personalizáveis do tema Lever a partir do briefing ou input manual.

## Helpers

`proxy()` (edge function `shopify-admin-proxy`) — pattern em `/shopify` SKILL. `delay = ms => new Promise(r => setTimeout(r, ms))`.

## Processo

### 1. Identificar cliente
```sql
SELECT id, name, shopify_domain, shopify_status FROM agency_clients
WHERE name ILIKE '%NOME%' AND shopify_status = 'connected';
```
Não conectado → parar.

### 2. Tipo da loja (BR ou EN)
- Domínio contém `-en` ou `development-en` → **EN**
- Senão → **BR**

**Afeta onde ficam milestones:**
- **BR**: `config/settings_data.json` → campos raiz do `current`
- **EN**: `templates/cart.json` → `sections.cart-items.settings`

### 3. Encontrar tema Lever
```js
const themes = await proxy({clientId, resource: "themes", method: "list"});
const lever = (themes.data || []).find(t =>
  t.name.toLowerCase().includes('lever') || t.role === 'main'
);
const THEME_ID = lever.id;
```
Se nenhum tem "lever" no nome, usar `role: "main"`.

### 4. Buscar briefing
```sql
SELECT id, answers FROM briefings WHERE client_id = 'UUID' ORDER BY created_at DESC LIMIT 1;
```

Extrair de `answers` (JSON):
- `telefone` ou `contato_telefone`
- `email` ou `contato_email`
- `horario_atendimento` ou `horario`
- `instagram`, `facebook`, `tiktok`
- `ofertas` (ex: "Pague 2 Leve 3")
- `frete_gratis_valor` (ex: "R$ 199,90", "129")
- `marca_nome`

**Sem briefing:** perguntar manualmente cada valor (telefone, email, horário, redes sociais URLs completas, oferta carrinho, valor frete grátis).

### 5. Ler arquivos do tema (paralelo)
```js
const [headerR, footerR, settingsR, cartR] = await Promise.all([
  proxy({clientId, resource: "themes", method: "get_asset", resourceId: THEME_ID,
    params: { "asset[key]": "sections/header-group.json" }}),
  proxy({clientId, resource: "themes", method: "get_asset", resourceId: THEME_ID,
    params: { "asset[key]": "sections/footer-group.json" }}),
  proxy({clientId, resource: "themes", method: "get_asset", resourceId: THEME_ID,
    params: { "asset[key]": "config/settings_data.json" }}),
  proxy({clientId, resource: "themes", method: "get_asset", resourceId: THEME_ID,
    params: { "asset[key]": "templates/cart.json" }})
]);
const header = JSON.parse(headerR.data.asset.value);
const footer = JSON.parse(footerR.data.asset.value);
const settings = JSON.parse(settingsR.data.asset.value);
const cart = JSON.parse(cartR.data.asset.value);
```

### 6. PREVIEW — Mostrar valores atuais vs propostos

Antes de qualquer alteracao, montar uma tabela comparativa e mostrar ao usuario:

```
| Campo              | Valor Atual                          | Valor Proposto                       |
|--------------------|--------------------------------------|--------------------------------------|
| Telefone (header)  | +55 (11) 99999-9999                 | +55 (21) 88888-8888                 |
| Email (header)     | antigo@loja.com                      | novo@loja.com                        |
| Footer subtext     | <p>Seg a Sex: 08h as 18h...</p>     | <p>Seg a Sex: 09h as 17h...</p>     |
| Instagram          | https://instagram.com/antigo         | https://instagram.com/novo           |
| Facebook           | (vazio)                              | https://facebook.com/novo            |
| TikTok             | (vazio)                              | https://tiktok.com/@novo             |
| milestone_1_qty    | 3                                    | 3                                    |
| milestone_1_badge  | "Leve 3"                            | "Leve 3"                            |
| message_0          | "Adicione 3 camisas..."             | "Adicione 3 camisas..."             |
| Frete gratis       | R$199                                | R$129                                |
```

Pedir confirmacao: **"Confirma essas alteracoes? (sim/nao)"**

### 7. Aplicar (após confirmação) — sempre ler→modificar→salvar, NUNCA sobrescrever inteiro

#### 7a. Header (contato)
```js
header.sections.header.settings.support_phone = TELEFONE;
header.sections.header.settings.support_email = EMAIL;
await proxy({clientId, resource: "themes", method: "put_asset", resourceId: THEME_ID,
  payload: { asset: { key: "sections/header-group.json", value: JSON.stringify(header, null, 2) } }});
```

#### 7b. Announcement bar (frete grátis)
```js
const annBlocks = header.sections['announcement-bar']?.blocks || {};
for (const [key, block] of Object.entries(annBlocks)) {
  if (block.settings?.text?.toLowerCase().includes('frete')) {
    block.settings.text = `Frete Gratis nas compras a partir de R$${FRETE_VALOR}`;
  }
}
// Salvar junto com header (mesmo arquivo)
```

#### 7c. Footer (horário + contato)
```js
const footerBlocks = footer.sections.footer?.blocks || {};
for (const [key, block] of Object.entries(footerBlocks)) {
  if (block.type === 'text' && block.settings?.subtext?.includes('@')) {
    block.settings.subtext = `<p>${HORARIO}</p><p>Email: ${EMAIL}</p><p>Whatsapp: ${TELEFONE}</p>`;
  }
}
await proxy({clientId, resource: "themes", method: "put_asset", resourceId: THEME_ID,
  payload: { asset: { key: "sections/footer-group.json", value: JSON.stringify(footer, null, 2) } }});
```

#### 7d. Social links (settings_data.json)
```js
const current = settings.current;
if (INSTAGRAM) current.social_instagram_link = INSTAGRAM;
if (FACEBOOK) current.social_facebook_link = FACEBOOK;
if (TIKTOK) current.social_tiktok_link = TIKTOK;
await proxy({clientId, resource: "themes", method: "put_asset", resourceId: THEME_ID,
  payload: { asset: { key: "config/settings_data.json", value: JSON.stringify(settings, null, 2) } }});
```

#### 7e. Milestones e mensagens

**Gerar milestones a partir da oferta:**

| Oferta           | milestone_1_qty | milestone_1_badge | milestone_2_qty | milestone_2_badge |
|------------------|-----------------|-------------------|-----------------|-------------------|
| Compre 2 Leve 3  | 3               | "Leve 3"          | 6               | "Leve 6"          |
| Compre 3 Leve 4  | 4               | "Leve 4"          | 8               | "Leve 8"          |
| Compre 4 Leve 5  | 5               | "Leve 5"          | 10              | "Leve 10"         |

Regra geral: `milestone_1_qty = LEVE`, `milestone_2_qty = LEVE * 2`.

**Campos:**
```js
const milestones = {
  milestone_1_quantity: M1_QTY,
  milestone_1_badge: `Leve ${M1_QTY}`,
  milestone_1_icon: "star",
  milestone_2_quantity: M2_QTY,
  milestone_2_badge: `Leve ${M2_QTY}`,
  message_0: `Adicione ${M1_QTY} camisas para ganhar uma de brinde!`,
  message_1: `Faltam ${M1_QTY - 1} camisas para ganhar 1 camisa gratis!`,
  message_2: `Falta 1 camisa para ganhar 1 camisa gratis!`,
  message_3: `Parabens, voce aproveitou a promocao Compre ${M1_QTY - 1} Leve ${M1_QTY}!`,
  message_4: `Faltam ${M2_QTY - M1_QTY - 1} camisas para ganhar mais uma camisa gratis!`,
  message_5: `Quase la! Mais 1 camisa e o brinde e garantido.`,
  message_6_plus: `Incrivel! Voce desbloqueou ${Math.floor(M2_QTY / M1_QTY)} camisas gratis!`
};
```

**Regra Lever:** ZERO emojis em mensagens de milestone — usar SEMPRE `milestone_*_icon` (string com nome do icon snippet, ex: "gift", "star", "shirt") que o tema renderiza via SVG. Se input do user/briefing tiver emoji em mensagens, **strip e avisar**.

**Nota:** Para `message_1` ate `message_2`, gerar mensagens intermediarias proporcionais a `M1_QTY`. Se M1_QTY = 4, entao message_1 = "Faltam 3...", message_2 = "Faltam 2...", message_3 = "Falta 1..." e message_4 = parabens. Ajustar os indices conforme necessario.

**Aplicar conforme tipo da loja:**
```js
// --- BR --- milestones em config/settings_data.json → current
for (const [key, val] of Object.entries(milestones)) settings.current[key] = val;
await proxy({clientId, resource: "themes", method: "put_asset", resourceId: THEME_ID,
  payload: { asset: { key: "config/settings_data.json", value: JSON.stringify(settings, null, 2) } }});

// --- EN --- milestones em templates/cart.json → sections.cart-items.settings
const cartItems = cart.sections['cart-items'];
if (cartItems) {
  for (const [key, val] of Object.entries(milestones)) cartItems.settings[key] = val;
  await proxy({clientId, resource: "themes", method: "put_asset", resourceId: THEME_ID,
    payload: { asset: { key: "templates/cart.json", value: JSON.stringify(cart, null, 2) } }});
}
```

#### 7f. Frete (BR apenas)
```js
if (TIPO === 'BR') {
  const cartFooter = cart.sections['cart-footer'];
  if (cartFooter?.blocks) {
    for (const [key, block] of Object.entries(cartFooter.blocks)) {
      if (block.type === 'shipping_calculator') {
        block.settings.option_1_title = `Frete Padrao Gratis (7 a 15 dias)`;
        block.settings.option_2_title = `Frete Expresso - R$27,90 (6 a 9 dias)`;
        break;
      }
    }
    await proxy({clientId, resource: "themes", method: "put_asset", resourceId: THEME_ID,
      payload: { asset: { key: "templates/cart.json", value: JSON.stringify(cart, null, 2) } }});
  }
}
```

### 8. Verificação final
Reler arquivos modificados, confirmar valores aplicados. Reportar **"Tema configurado com sucesso!"** com resumo das alterações.

## Resumo do mapeamento

| Briefing Field         | Arquivo do Tema                | Caminho no JSON                                         |
|------------------------|--------------------------------|---------------------------------------------------------|
| telefone               | sections/header-group.json     | sections.header.settings.support_phone                  |
| email                  | sections/header-group.json     | sections.header.settings.support_email                  |
| email + telefone + hr  | sections/footer-group.json     | sections.footer.blocks.*.settings.subtext               |
| instagram              | config/settings_data.json      | current.social_instagram_link                           |
| facebook               | config/settings_data.json      | current.social_facebook_link                            |
| tiktok                 | config/settings_data.json      | current.social_tiktok_link                              |
| whatsapp               | config/settings_data.json      | current.social_whatsapp_link (requer alteracao em settings_schema.json + locales + social-icons.liquid) |
| ofertas (milestones)   | settings_data.json (BR)        | current.milestone_*, current.message_*                  |
| ofertas (milestones)   | templates/cart.json (EN)       | sections.cart-items.settings.milestone_*, message_*     |
| frete_gratis_valor     | header-group.json              | sections.announcement-bar.blocks.*.settings.text        |
| frete opcoes           | templates/cart.json (BR only)  | sections.cart-footer.blocks.shipping_calculator.settings |

## Erros comuns

- **asset nao encontrado**: Verificar se o tema e realmente o Lever. Listar assets com `list_assets` se necessario.
- **JSON parse error**: O `settings_data.json` pode ser muito grande. Sempre usar `JSON.parse(r.data.asset.value)`.
- **put_asset falha**: Garantir que o `value` e uma string (stringify do JSON), nao um objeto.
- **social links nao aparecem**: Os campos sao `social_instagram_link`, `social_facebook_link`, `social_tiktok_link` (com prefixo `social_` e sufixo `_link`).
- **milestones nao funcionam**: Verificar se estao no local correto (BR vs EN). Em BR ficam no `current` do settings_data, em EN ficam no cart-items.
