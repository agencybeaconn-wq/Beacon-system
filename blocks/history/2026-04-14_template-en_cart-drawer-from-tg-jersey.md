# Cart Drawer EN + Personalization + Progress Bar (TG Jersey → Template EN)

## Operação
- **Data:** 2026-04-14
- **Origem:** TG Jersey (store-tg-jersey.myshopify.com) theme=157588324582 "LEVER EVER TG JERSEYS"
- **Destino:** Loja de Desenvolvimento - EN (loja-de-estruturacao-e-desenvolvimento-en.myshopify.com) theme main=129577091130 "Tema Lever Inglês Atualizado 23/03"
- **Idioma:** EN
- **Status:** Aplicado ao vivo (PUT 200 em todos)

## Arquivos propagados (5)
| Arquivo | Origem | Status |
|---|---|---|
| snippets/cart-drawer.liquid | TG (EN, derivado da JGS) | PUT 200 |
| snippets/cart-progress-bar.liquid | TG (defaults goal_1=3, goal_2=5, badges GET 3/GET 5) | PUT 200 |
| snippets/icon-home.liquid | TG | PUT 200 |
| snippets/customization-inputs.liquid | TG (property keys EN + fixes) | PUT 200 |
| assets/cart-progress-bar.js | TG (reescrito — lê data-goal-1/2, mensagens EN dinâmicas) | PUT 200 |

## Features propagadas
- Cart drawer EN completo com ícone de presente (substituiu "You are saving")
- Progress bar com milestones settings-driven (goal_1=3/goal_2=5 default)
- Badges "GET 3" / "GET 5"
- Discount labels condicionais
- Qty selector hide em itens personalizados (Customize=Yes) e free
- Mensagens dinâmicas: "🔥 N more jerseys to unlock Get 3!", "🎉 Get 3 unlocked! N more for Get 5!", etc.
- Offset visual +3% na barra pra cobrir visualmente a bolinha alcançada

## Fixes críticos propagados (do trabalho da TG)
1. Detector de opção "Customize" em customization-inputs (antes só matchava `personalizar` PT)
2. Fetch URL do cart-drawer render: era `routes.root + '?sections='` (homepage) → agora `routes.root + 'cart?sections='`
3. Property keys EN: `properties[Name]`, `properties[Number]`, `properties[Position]`
4. JS cart-progress-bar reescrito — bug original lia `data-goal` inexistente, usava default 5, marcava TODOS markers como is-reached (count >= 0 sempre true)

## NÃO sobe
- Settings específicas (milestone_X_quantity, message_X, bonus_X_text) — cada loja configura no theme editor
- patch-script.liquid — não foi modificado nesta sessão

## Lições
- TG validada ao vivo primeiro → propagar pro Template EN depois. Esse é o caminho correto quando o cliente é mais urgente/pressionado.
- Template EN estava desatualizado (tinha cart-drawer antigo), agora nivelado com a TG.

## Candidato?
Já é Template EN. Próximos clientes EN devem receber estes arquivos via /code-blocks.
