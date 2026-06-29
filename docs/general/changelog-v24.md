# Marketing API v24.0 Changelog
**Lançamento:** 8 de outubro de 2025

Este documento detalha as mudanças introduzidas na versão 24.0 da Marketing API.

## Ad Creative

### Otimização de Destino do Site (Website Destination Optimization)
**Aplica-se a:** v24.0+

Permite que a Meta determine qual página de destino do seu site enviar um cliente, com base na URL com maior probabilidade de resultar em conversão (ex: página inicial, página de produto, coleção).

**Endpoints afetados:**
*   `POST /{ad-account-id}/adcreatives`
*   `GET /{ad-creative-id}/?fields=destination_spec`

### Depreciação de Anúncios no Messenger para Cadastros
**Aplica-se a:** v24.0+

A capacidade de criar anúncios de cadastro que geram leads no Messenger via API está sendo descontinuada. Ainda será possível criar esses anúncios pelo Gerenciador de Anúncios.

**Endpoints afetados:**
*   `POST /{page-id}/messenger_lead_forms`
*   `POST /{ad-account-id}/adcreatives`
*   `GET /{messenger-lead-gen-template-id}`

## Advantage+ Campaigns

### Depreciação de Campanhas Advantage+ Shopping e App (Antigo Fluxo)
**Aplica-se a:** v24.0+

Introdução de um processo novo e unificado para criação de campanhas. A criação, duplicação e atualização de campanhas Advantage+ Shopping e Advantage+ App pelos fluxos antigos não serão mais permitidas. É necessário migrar para o novo fluxo.

**Endpoints afetados:**
*   `POST /{ad-account-id}/campaigns`
*   `POST /{campaign-id}/copies`

## Audiences

### Públicos Personalizados de Arquivo de Clientes (Customer File Custom Audiences)
**Aplica-se a:** v24.0+ (Todas as versões a partir de 6 de janeiro de 2026)

*   Atualizações em públicos personalizados sinalizados falharão.
*   Criação e atualização de públicos Lookalike usando públicos semente sinalizados falharão.

**Endpoints afetados:**
*   `POST {ad-account-id}/customaudiences`
*   `GET {custom-audience-id}`
*   `POST {custom-audience-id}`
*   `POST {custom-audience-id}/users`
*   `POST {custom-audience-id}/usersreplace`
*   `DELETE {custom-audience-id}/users`

### Validação de Tipo de Campo para Lookalike Audience
**Aplica-se a:** v24.0+ (Todas as versões a partir de 6 de janeiro de 2026)

O campo `lookalike_spec` agora é obrigatório e deve corresponder aos tipos válidos. Requisições com subcampos inválidos podem falhar.

**Endpoints afetados:**
*   `POST /{ad-account-id}/customaudiences`

## Budgeting

### Compartilhamento de Orçamento de Conjunto de Anúncios Condicionalmente Obrigatório
**Aplica-se a:** v24.0+

O campo `is_adset_budget_sharing_enabled` agora é obrigatório se você planeja definir um orçamento no nível do conjunto de anúncios. Recomenda-se definir como `true` para ativar essa otimização (compartilha até 20% do orçamento com outros conjuntos).

**Endpoints afetados:**
*   `POST /{ad-account-id}/campaigns`

### Aumento da Flexibilidade do Orçamento Diário
**Aplica-se a:** v24.0+

A flexibilidade do orçamento diário aumentou de 25% para **75%**. Isso significa que o gasto diário pode exceder o orçamento definido em até 75% em dias com melhores oportunidades, mantendo a média semanal.

**Endpoints afetados:**
*   `POST /{ad-account-id}/adsets`
*   `POST /{ad-account-id}/campaigns`
*   `POST /{ad-set-id}`
*   `POST /{campaign-id}`

## Conversions & Campaigns

### Restrições para Conversões Personalizadas e Públicos
**Aplica-se a:** v24.0+ (Todas as versões a partir de 6 de janeiro de 2026)

*   Atualização de conversões personalizadas sinalizadas falhará.
*   Criação e atualização de campanhas usando conversões ou públicos sinalizados falharão.

**Endpoints afetados:**
*   `POST /{custom-conversion-id}`
*   `POST /{ad-set-id}`
*   `POST /{ad-account-id}/adsets`

## Catalog

### Novo Limite de Payload para Batch API
**Aplica-se a:** v24.0+

O payload para a Catalog Items Batch API agora é limitado a **30 MB**. O limite de 5.000 itens por requisição permanece inalterado.

**Endpoints afetados:**
*   `POST /{product-catalog-id}/items_batch`

### Suporte a `allow_upsert` no Endpoint de Product Item
**Aplica-se a:** v24.0+

O endpoint de criação de produto agora suporta a flag `allow_upsert`, permitindo atualizar itens existentes além de criar novos.

**Endpoints afetados:**
*   `POST /{product-catalog-id}/products`

## Placements

### Gasto Limitado em Posicionamentos Advantage+
**Aplica-se a:** v24.0+

Permite alocar até **5%** do gasto em posicionamentos específicos que você normalmente excluiria, usando o parâmetro `placement_soft_opt_out`. Funciona com objetivos de Vendas e Cadastros.

**Endpoints afetados:**
*   `POST /{ad-account-id}/adsets`
*   `POST /{ad-set-id}`
*   `GET /{ad-set-id}?fields=placement_soft_opt_out`

### Depreciação do Posicionamento Facebook Video Feeds
**Aplica-se a:** v24.0+

A entrega de anúncios no Feed de Vídeo do Facebook será interrompida. Tentar criar ou atualizar campanhas com esse posicionamento gerará erro. O posicionamento recomendado como substituto é o **Facebook Reels**.

**Endpoints afetados:**
*   `POST /{ad-account-id}/adsets`
*   `POST /{ad-set-id}`

## Targeting

### Direcionamento Detalhado (Detailed Targeting)
**Aplica-se a:** v24.0+ (Todas as versões a partir de 6 de janeiro de 2026)

Alguns interesses de direcionamento detalhado estão sendo combinados em agrupamentos relevantes. Opções antigas não serão suportadas para novas campanhas. Campanhas criadas antes de 8 de outubro de 2025 rodarão até 15 de janeiro de 2026.

**Endpoints afetados:**
*   `POST /{ad-account-id}/adsets`
*   `POST /{ad-set-id}`
*   `POST /{ad-set-id}/copies`
*   `GET /{ad-account-id}/delivery_estimate`
*   `GET /{ad-set-id}/delivery_estimate`
*   `GET /{ad-account-id}/reachestimate`
*   `GET /{ad-account-id}/targetingsearch`
*   `GET /{ad-account-id}/targetingsuggestions`
*   `GET /{ad-account-id}/targetingvalidation`
*   `GET /search`
