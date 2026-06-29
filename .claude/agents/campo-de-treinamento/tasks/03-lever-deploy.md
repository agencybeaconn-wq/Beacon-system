# Task 03 — lever-deploy CONSERTA PÁGINAS + CONFIG DE TEMA

> Agente: **lever-deploy**
> Objetivo: recriar páginas legais deletadas + reconfigurar settings de contato/whatsapp do tema.

## Loja-alvo

- **Loja:** `Loja de Desenvolvimento - BR`
- **Tema:** `162148253938` (Campo de treinamento dos AGENTES — unpublished)

## Missão

Boss deletou páginas legais críticas + sabotou settings de contato do tema. Sua missão:

1. **Diagnóstico:**
   - Rodar `quality-gate` v4 com `--theme-id=162148253938`
   - Checks #18, #19, #20, #21 vão estar FAIL/WARN
   - Ler relatório de `lever-qa baseline`

2. **Identificar e consertar:**

   ### Páginas
   - **Check #19** `troca_personalizado_declarada` — Página `politica-de-troca` (ou similar) deletada. Recriar via `create-standard-pages` com texto que cubra:
     - Troca de produto físico padrão
     - **Troca de personalizado em 7 dias** (diferencial Lever vs Nike) com keywords `personalizad/nome/número/estampa`
   - **Check #21** `tracking_page_presente` — Página `rastreamento` deletada. Recriar via `create-standard-pages` com link/embed pra rastreio.

   ### Settings do tema (config/settings_data.json no tema 162148253938)
   - **Check #18** `contact_source_consistency` — `contact_email` foi setado igual ao `shop.email` (admin). Reconfigurar pra email de ATENDIMENTO diferente (ex: `atendimento@<loja>.com` ou pegar do `briefings.answers`)
   - **Check #20** `whatsapp_atendimento_visivel` — Campos `*whatsapp*` removidos. Reconfigurar via `configure-theme` (ou patch direto) pra ter `social_whatsapp` ou `contact_whatsapp` com `wa.me/55XXXXXXXXX`

3. **Validação:**
   - Re-rodar `quality-gate` v4 com `--theme-id=162148253938`
   - Checks #18 (PASS), #19 (PASS), #20 (PASS), #21 (PASS)

## Skills disponíveis

- `quality-gate` (com --theme-id)
- `create-standard-pages`
- `configure-theme` (com --theme-id pra mirar tema unpublished — verificar se a skill aceita; se não, patch direto via Shopify API)
- `preflight-deploy`

## Como subir asset modificado pra tema unpublished

```js
await shReq(shop, token, 'PUT', `/admin/api/${API_VERSION}/themes/162148253938/assets.json`,
  { asset: { key: 'config/settings_data.json', value: JSON.stringify(settingsAtualizado, null, 2) } });
```

## Critério de sucesso

- quality-gate v4 (--theme-id=162148253938) na tua área: #18 PASS, #19 PASS, #20 PASS, #21 PASS
- Páginas `politica-de-troca` e `rastreamento` (ou variantes) existem
- Política de troca cobre personalização (keywords mencionadas)
- Settings tema com `contact_email` ≠ `shop.email` E com `*whatsapp*` configurado
- Salvar relatório em `tasks/relatorios/lever-deploy-AAAA-MM-DD.md`

## Restrição

**Read-only no tema main publicado** (`160282804466`).
**Não mexer em produtos/preços** — isso é `lever-catalogo`.

## ⚠️ Caso skill `configure-theme` não aceite --theme-id

Reportar pra Boss. Boss refatora skill pra aceitar (regra do campo: skill faltando = Boss conserta, agente NÃO improvisa).
