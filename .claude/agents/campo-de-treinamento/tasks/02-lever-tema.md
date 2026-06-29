# Task 02 — lever-tema CONSERTA TEMA

> Agente: **lever-tema**
> Objetivo: detectar e consertar TODOS os bugs no tema `Campo de treinamento dos AGENTES`.

## Loja-alvo

- **Loja:** `Loja de Desenvolvimento - BR`
- **Tema:** `162148253938` (Campo de treinamento dos AGENTES — unpublished)
- **Tema main publicado (NÃO TOCAR):** `160282804466` (Tema Lever Atualizado 18/03)

## Missão

Boss sabotou o tema `Campo de treinamento dos AGENTES` injetando bugs que violam regras inquebráveis Lever. Sua missão:

1. **Diagnóstico:**
   - Rodar `quality-gate` v4 com `--theme-id=162148253938` pra ver checks FAIL/WARN
   - Rodar `template-lint` pra detectar emoji em texto
   - Ler relatório do `lever-qa baseline` em `tasks/relatorios/lever-qa-baseline-*.md`

2. **Identificar e consertar (bugs esperados — descobrir SOZINHO via diagnóstico, não acreditar cegamente nessa lista):**
   - `snippets/pix-badge.liquid` — quality-gate check #22 vai apontar (ausente OU sem listener variantChange). Recriar/reescrever pra ter listener
   - `snippets/cart-drawer.liquid` — emoji 🎁💰🎉 injetado no topo (template-lint detecta). Remover linha de comentário injetada
   - `snippets/scarcity-badge.liquid` — escassez FAKE via `variant.id | modulo: 10`. Reescrever pra usar `variant.inventory_quantity` REAL
   - `config/settings_data.json` — `bonus_X_enabled` zerados (check #23). Reativar os que aplica

3. **Validação:**
   - Re-rodar `quality-gate` v4 com `--theme-id=162148253938`
   - Confirmar checks #22, #23 PASS
   - Confirmar `template-lint` zera emojis

## Skills disponíveis

- `quality-gate` (com --theme-id)
- `template-lint`
- `lever-theme` (push asset modificado pro tema 162148253938)
- `code-blocks` (puxar `snippets/pix-badge.liquid` de outra loja Lever que já tem)

## Como subir asset modificado pra tema unpublished

Use Shopify REST direto:
```js
import { shReq, API_VERSION } from '../../lib/shopify-api.mjs';
await shReq(shop, token, 'PUT', `/admin/api/${API_VERSION}/themes/162148253938/assets.json`,
  { asset: { key: 'snippets/X.liquid', value: novoConteudo } });
```

OU use `lever-theme push --theme-id=162148253938 snippets/X.liquid`.

## Método (importante — memory feedback_metodo_estudo_antes_de_tentar)

Antes de reescrever qualquer snippet:
1. **Estudar** snippet equivalente em loja Lever que já tem (ex: pix-badge de outra loja conectada — Voltz, Mantos PH, etc) via `code-blocks` ou Shopify Admin API
2. **Traçar 1-3 opções** se o snippet tem variações de implementação
3. **Justificar** a escolha em 1 linha
4. **Aplicar** só depois

## Critério de sucesso

- quality-gate v4 (--theme-id=162148253938) na tua área: #22 PASS, #23 PASS
- template-lint: 0 emojis no tema-alvo
- scarcity-badge: agora usa `inventory_quantity` real (não fake)
- pix-badge.liquid: existe + tem listener `variantChange`
- Salvar relatório em `tasks/relatorios/lever-tema-AAAA-MM-DD.md` com:
  - Bugs encontrados
  - Diff aplicado (resumo por arquivo)
  - quality-gate antes/depois (score)
  - Lições aprendidas pro diário do agente

## Restrição

**NÃO mexer no tema main publicado** (`160282804466`).
**NÃO mexer em produtos/coleções/páginas** — isso é missão de `lever-catalogo` e `lever-deploy`.

## ⚠️ Caso skill faltar / quebrar

Se `code-blocks` ou `lever-theme` não aceitar `--theme-id` ou faltar alguma capability: **reportar pro Boss**. Boss refatora skill. Você NÃO improvisa workaround frágil.
