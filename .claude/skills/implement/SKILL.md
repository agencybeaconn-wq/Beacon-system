---
name: implement
description: Executa as demandas de implementação Shopify de um cliente automaticamente — deploy de coleções, páginas, menus, tema, preços — e marca como concluídas no kanban.
argument-hint: "nome do cliente"
---

# Implementar Demandas do Cliente

Busca tasks pendentes do cliente no kanban, executa as automatizáveis via Shopify API, marca como concluídas.

## Helpers

`proxy()` (edge function `shopify-admin-proxy`), `deployStep()` (edge function `store-deployment`), `supabaseRPC(method, path, body)` (REST direto pra `client_tasks`) — pattern em `/shopify` SKILL. Anon key de `.env` `VITE_SUPABASE_ANON_KEY`.

## Processo

### 1. Identificar cliente
```sql
SELECT id, name, shopify_domain, shopify_status FROM agency_clients
WHERE name ILIKE '%NOME%';
```

### 2. Buscar tasks pendentes
```sql
SELECT id, title, status, category, checklist, source
FROM client_tasks
WHERE client_id = 'CLIENT_UUID'
  AND status IN ('todo', 'pending', 'in_progress')
ORDER BY order_position;
```

### 3. Verificar pré-requisitos

Antes de executar QUALQUER task automatizada, verificar:

1. **Shopify conectado**: `shopify_status = 'connected'` — se não, avisar o usuário
2. **Tema importado**: Verificar se existe tema com "lever" no nome na loja — se não, avisar:
   "O tema Lever precisa ser importado manualmente na loja antes de continuar.
   Vá em Shopify Admin > Temas > Importar tema e suba o .zip do Lever."
3. **Task "Conectar Shopify e importar tema" concluída**: Se ainda está pendente, avisar o usuário

Se qualquer pré-requisito falhar, NÃO executar as tasks automáticas. Listar o que precisa ser feito primeiro.

### 4. Executar tasks automatizáveis

Para cada task pendente, verificar se é automatizável pelo título:

```
PRÉ-REQUISITOS (manuais, devem estar concluídas ANTES):
🔧 "Conectar Shopify e importar tema Lever"
   → Manual: instalar app, conectar OAuth, importar .zip

AUTOMATIZÁVEIS (só rodar após pré-requisitos):
✅ "Configurar licença, tema e contato"
   → deployStep: step 'theme' com createLicense + contato + ofertas

✅ "Configurar tema (contato, ofertas, cores)"
   → deployStep: step 'theme' com supportEmail, supportPhone, announcements, milestones
   → Buscar dados do briefing pra preencher

✅ "Importar produtos e configurar preços"
   → deployStep: step 'bulk_products' com produtos da template
   → Se client_pricing existe, aplicar preços

✅ "Importar coleções e menus"
   → deployStep: step 'collections' (batches de 20, com dedup)
   → Criar/atualizar menus via GraphQL menuUpdate

✅ "Criar e adaptar páginas (políticas, FAQ, sobre)"
   → Criar páginas via GraphQL com conteúdo da template
   → Substituir placeholders com dados do briefing

✅ "Configurar promoções no carrinho"
   → Atualizar milestones e mensagens no settings_data.json

✅ "Configurar frete grátis"
   → Atualizar no tema

✅ "Configurar parcelamento"
   → Atualizar no tema

NÃO AUTOMATIZÁVEIS (precisa mão humana):
❌ "Conectar Shopify e importar tema" → manual (pré-requisito)
❌ "Criar logo" → design
❌ "Definir paleta de cores" → design
❌ "Criar banners" → design
❌ "Integrar gateway" → configuração manual
❌ "Automações (Email/WhatsApp)" → setup manual
❌ "Revisão geral" → humano
❌ "Aprovação do cliente" → humano
❌ "Revisão do Briefing" → humano
❌ "Atribuição de ferramentas" → humano
❌ "Pegar acessos ao site" → humano
```

### 5. Marcar tasks como concluídas
```js
// Task concluída
await supabaseRPC('PATCH', 'client_tasks?id=eq.' + taskId,
  { status: 'completed', completed_at: new Date().toISOString() });

// Subtasks concluídas
await supabaseRPC('PATCH', 'client_tasks?id=eq.' + taskId,
  { checklist: checklist.map(c => ({...c, isCompleted: true})) });
```

### 6. Reportar resultado

```
=== IMPLEMENTAÇÃO [NOME DO CLIENTE] ===

✅ Concluídas automaticamente:
  • Importar coleções e menus (173 coleções, 2 menus)
  • Criar e adaptar páginas (6 páginas)
  • Configurar tema (contato, ofertas)
  • Licença: LEVER-XXXX-YYYY

⏳ Pendentes (precisam de ação manual):
  • Criar logo (Design - Felipe)
  • Criar banners (Design - Felipe)
  • Integrar CartPanda (Dev - Pedro)
  • Automações Email/WhatsApp (Gestão - João)
  • Revisão geral (Gestão - João)
  • Aprovação do cliente (Gestão - João)

📊 Progresso: 4/10 concluídas (40%)
```

## Matching de tasks por título

Usar regex pra identificar qual ação executar:

```js
const AUTOMATABLE = {
  /licen[çc]a|importar tema/i: 'deploy_theme',
  /configurar tema|contato.*ofertas|cores/i: 'configure_theme',
  /importar produtos|configurar pre[çc]os/i: 'deploy_products',
  /importar cole[çc][õo]es|menus/i: 'deploy_collections',
  /criar.*p[áa]ginas|pol[íi]ticas|FAQ/i: 'deploy_pages',
  /promo[çc][õo]es.*carrinho|milestones/i: 'configure_promotions',
  /frete gr[áa]tis/i: 'configure_shipping',
  /parcelamento/i: 'configure_installments',
};
```

## Dados necessários

- **Template**: BR (`39d74aff...`) ou EN (`92fa52de...`) — definido pelo `vende_onde` no briefing
- **Briefing**: buscar em `briefings` pelo `client_group_id`
- **Preços**: buscar em `client_pricing` pelo `client_id`
- **Shopify**: verificar `shopify_status = 'connected'`

## Erros comuns

| Erro | Solução |
|---|---|
| Task não encontrada | Verificar client_id e status |
| Shopify não conectado | Pedir pro usuário conectar primeiro |
| Coleções duplicadas | Edge function já previne (dedup automático) |
| Menus duplicados | Usar menuUpdate no existente |
| Tema sem header-group.json | Buscar campos no settings_data.json |

Processe $ARGUMENTS conforme os passos acima.
