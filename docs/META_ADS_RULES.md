# LADS.AI - META ADS API RULES & PAYLOADS (v20.0+)

Este documento é a FONTE ÚNICA DE VERDADE para criação de campanhas no projeto.
Sempre consulte este arquivo antes de gerar payloads para a Graph API.

---

## 0. ANDROMEDA STRATEGY INTELLIGENCE (2024+)

O sistema LADS AI atua como um **Arquiteto de Campanhas Andromeda**, priorizando:

### Configurações Advantage+ (Padrão)
- `targeting_automation: { advantage_audience: 1 }` - Sempre ativo por padrão
- `bid_strategy: 'LOWEST_COST_WITHOUT_CAP'` - Para campanhas de escala/CBO
- `age_max: 65` - Fixo quando Advantage+ está ativo (regra do Meta)

### Estruturas Hierárquicas
O sistema suporta estruturas complexas aninhadas:
```
Campaign
├── AdSet 1 (targeting A)
│   ├── Ad 1 (creative X)
│   ├── Ad 2 (creative Y)
│   └── Ad 3 (creative Z)
├── AdSet 2 (targeting B)
│   └── Ad 1 (creative X)
└── AdSet 3 (targeting C)
    └── Ad 1 (creative X)
```

### Protocolo de Identidade
Antes de criar campanhas, a IA DEVE:
1. Verificar se `page_id` está no contexto
2. Chamar `get_ad_account_identities` se não encontrar
3. Selecionar automaticamente se houver apenas 1 página
4. Perguntar ao usuário se houver múltiplas opções

---

## 1. Estrutura de Criação (Hierarquia)
1. Criar Campanha (`POST /act_{id}/campaigns`)
2. Criar AdSet (`POST /act_{id}/adsets`) usando o ID da Campanha.
3. Criar Ad (`POST /act_{id}/ads`) usando o ID do AdSet e o hash do Criativo.

---

## 2. Criação Básica de Anúncios

Criar anúncios usando a API de Marketing envolve uma abordagem sistemática que inclui configurar campanhas, conjuntos de anúncios e criativos do anúncio. Este documento fornece orientações detalhadas sobre a criação programática desses componentes, além de exemplos de código para ilustrar o processo de implementação.

### 2.1. Pontos de Extremidade para Criação de Anúncio

A API de Marketing oferece uma variedade de pontos de extremidade que servem como ferramentas essenciais para que os desenvolvedores criem, gerenciem e analisem campanhas de anúncios. Os principais pontos de extremidade para criação são `campaigns`, `adsets` e `ads`. Entender esses pontos de extremidade e as respectivas funcionalidades é importante para desenvolvedores iniciantes e experientes que buscam otimizar as estratégias de publicidade.

#### 2.1.1. O Ponto de Extremidade `campaigns`

O ponto de extremidade `campaigns` é usado para criar e gerenciar as campanhas publicitárias. Ele permite que os usuários definam os objetivos gerais para os esforços de marketing, como reconhecimento da marca ou conversões.

**Exemplo de solicitação da API:**

```bash
curl -X POST \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns \
  -F 'name=My Campaign' \
  -F 'objective=LINK_CLICKS' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

#### 2.1.2. O Ponto de Extremidade `adsets`

O ponto de extremidade `adsets` organiza anúncios dentro de campanhas com base em critérios específicos de direcionamento e alocação de orçamento. Isso permite um controle mais detalhado sobre o direcionamento do público e os gastos.

**Exemplo de solicitação da API:**

```bash
curl -X POST \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets \
  -F 'name=My Ad Set' \
  -F 'campaign_id=<CAMPAIGN_ID>' \
  -F 'daily_budget=1000' \
  -F 'targeting={"geo_locations":{"countries":["US"]}}' \
  -F 'access_token=<ACCESS_TOKEN>'
```

#### 2.1.3. O Ponto de Extremidade `ads`

O ponto de extremidade `ads` é onde os anúncios reais são criados, permitindo que você defina elementos do criativo e os vincule ao conjunto de anúncios apropriado.

**Exemplo de solicitação da API:**

```bash
curl -X POST \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/ads \
  -F 'name=My Ad' \
  -F 'adset_id=<AD_SET_ID>' \
  -F 'creative={"creative_id": "<CREATIVE_ID>"}' \
  -F 'status=ACTIVE' \
  -F 'access_token=<ACCESS_TOKEN>'
```

---

## 3. Criar uma Campanha de Anúncios

O primeiro passo para lançar uma campanha de anúncios é criar a campanha usando a API.

Para criar uma campanha de anúncios, envie uma solicitação POST ao ponto de extremidade `/act_<AD_ACCOUNT_ID>/campaigns` com os parâmetros-chave, incluindo `name`, `objective` e `status`.

**Exemplo de solicitação da API:**

```bash
curl -X POST \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/campaigns \
  -F 'name=My Campaign' \
  -F 'objective=LINK_CLICKS' \
  -F 'status=PAUSED' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### 3.1. Parâmetros Necessários

| Nome | Descrição |
|------|-----------|
| `name` | O nome da campanha. |
| `objective` | O objetivo da campanha, por exemplo, `LINK_CLICKS`. |
| `status` | O status inicial da campanha, geralmente definido como `PAUSED` ao ser criado pela primeira vez. |

---

## 4. Criar um Conjunto de Anúncios

Depois de criar sua campanha, o próximo passo é criar um conjunto de anúncios para fazer parte dela. O conjunto de anúncios contém as informações de lances, direcionamento e orçamento da sua campanha.

Para criar um conjunto de anúncios dentro da sua campanha, envie uma solicitação POST ao ponto de extremidade `/act_<AD_ACCOUNT_ID>/adsets`. Os parâmetros importantes incluem o `name` do conjunto de anúncios, a `campaign_id` associada, as especificações de `targeting` e os detalhes do `daily_budget`.

**Exemplo de solicitação da API:**

```bash
curl -X POST \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets \
  -F 'name=My Ad Set' \
  -F 'campaign_id=<CAMPAIGN_ID>' \
  -F 'daily_budget=1000' \
  -F 'targeting={"geo_locations":{"countries":["US"]}}' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### 4.1. Parâmetros Necessários

| Nome | Descrição |
|------|-----------|
| `campaign_id` | A identificação da campanha à qual o conjunto de anúncios pertence. |
| `daily_budget` | O orçamento diário especificado em centavos. |
| `targeting` | O público-alvo baseado em localizações geográficas. |

---

## 5. CAMPANHA (Campaign) - Payload Avançado

**Payload Blindado para Vendas (Sales):**

```json
{
  "name": "Nome da Campanha",
  "objective": "OUTCOME_SALES",
  "status": "PAUSED",
  "special_ad_categories": ["NONE"],
  "buying_type": "AUCTION",
  "daily_budget": 5000, // Opcional (Ativa CBO se enviado)
  "bid_strategy": "LOWEST_COST_WITHOUT_CAP"
}
```

---

## 6. CONJUNTO DE ANÚNCIOS (Ad Set) - Regras Críticas

### Regra de Ouro: Advantage+ Audience
Para evitar erros de validação, usamos a automação de público.

*   **Obrigatório:** `targeting_automation: { advantage_audience: 1 }`
*   **Consequência:** Você **NÃO PODE** definir `age_max`. O teto deve ser sempre 65+.
*   `age_min`: Pode ser alterado (ex: 18, 25).

### Regra de Geolocalização (Geo)
Nunca envie strings soltas. Use objetos formatados.

*   **Cidade:** `{ cities: [{ key: "ID_DA_CIDADE", radius: 40, distance_unit: "kilometer" }] }`
*   **Estado:** `{ regions: [{ key: "ID_DO_ESTADO" }] }`
*   **País:** `{ geo_locations: { countries: ["BR"] } }`

### Regra de Conversão (Pixel)
Se o objetivo é Vendas (`OFFSITE_CONVERSIONS`), o Pixel é obrigatório.

*   `optimization_goal`: "OFFSITE_CONVERSIONS"
*   `billing_event`: "IMPRESSIONS"
*   `destination_type`: "WEBSITE"
*   `promoted_object`: `{ "pixel_id": "ID_DO_PIXEL", "custom_event_type": "PURCHASE" }`

### Regra de Posicionamento (Placements)
**NÃO ENVIE** `facebook_positions` ou `instagram_positions`. Deixe vazio para ativar **Advantage+ Placements** (Automático). Isso evita erros de compatibilidade de formato.

---

## 7. Payload de Exemplo (Targeting Completo)
Use este modelo para montar o objeto `targeting`:

```json
"targeting": {
  "geo_locations": {
    "cities": [{ "key": "2680434", "radius": 40, "distance_unit": "kilometer" }] 
  },
  "age_min": 25,
  "age_max": 65, // Travado em 65 por causa do Advantage+
  "genders": [1], // 1=Homem, 2=Mulher
  "interests": [{ "id": "600312345...", "name": "Futebol" }],
  "targeting_automation": { "advantage_audience": 1 }
}
```

---

## 8. Ferramentas de Análise Inteligente (Lads AI)

O Lads AI possui duas ferramentas poderosas para análise estratégica:

### 8.1. get_historical_performance (Histórico)

**Objetivo:** Buscar dados históricos agregados por dia para análise de tendências.

**Parâmetros:**
- `accountId` (obrigatório): ID da conta de anúncios
- `campaignId` (opcional): ID da campanha específica. Se não fornecido, retorna dados de todas as campanhas
- `days` (opcional, padrão: 7): Número de dias para buscar histórico (7, 30, etc)
- `entityType` (opcional, padrão: 'CAMPAIGN'): Tipo de entidade ('CAMPAIGN', 'ADSET', 'AD')

**Retorno:**
- Dados agregados por dia (Spend, ROAS, CPA, Conversions)
- Resumo com totais e médias do período
- Análise de tendências e padrões

**Uso:** Quando o usuário pedir para analisar tendências, comparar períodos ou ver histórico.

### 8.2. scan_for_anomalies (Detecção Proativa)

**Objetivo:** Escanear automaticamente todas as campanhas detectando riscos e oportunidades.

**Parâmetros:**
- `accountId` (obrigatório): ID da conta de anúncios

**Lógica:**
- Compara a performance de HOJE com a média dos últimos 3 dias
- Detecta automaticamente:
  - **RISK:** Aumentos de CPA, quedas de ROAS, quedas de conversão
  - **OPPORTUNITY:** Melhorias de ROAS, reduções de CPA, aumento de conversões

**Severidade:**
- `CRITICAL`: Mudanças ≥ 50%
- `HIGH`: Mudanças ≥ 30%
- `MEDIUM`: Mudanças ≥ 20%

**Uso Proativo:** A IA deve executar esta ferramenta automaticamente no início de cada conversa (se o usuário não especificar outra ação) para alertar sobre problemas/oportunidades.

---

## 9. Mapeamento de Erros Comuns
*   **Error 100 (1870227):** Falta `targeting_automation`.
*   **Error 100 (1870189):** `age_max` definido abaixo de 65 com Advantage+ ligado.
*   **Error 100 (1487851):** Formato de Geo incorreto (faltou encapsular em `cities` ou `regions`).
*   **Error 100 (2490408):** Falta `promoted_object` (Pixel) para objetivo de conversão.

---

## 10. Histórico de Atualizações

### [Data Atual] - Ferramentas de Análise Inteligente
- **get_historical_performance**: Nova Edge Function para buscar dados históricos agregados por dia
  - Suporta análise de tendências (7, 30 dias)
  - Agregação por campanha, conjunto ou anúncio
  - Retorna ROAS, CPA, Spend, Conversions diários
  
- **scan_for_anomalies**: Nova Edge Function para detecção proativa de riscos e oportunidades
  - Compara performance de hoje vs últimos 3 dias
  - Detecta anomalias automaticamente (CPA alto, ROAS baixo, melhorias)
  - Classifica severidade: CRITICAL, HIGH, MEDIUM
  
- **Integração ao lads-brain**: Adicionadas como tools disponíveis para a IA
- **System Prompt atualizado**: IA instruída a usar `scan_for_anomalies` proativamente no início de conversas
- **Documentação**: Seção 8 criada explicando as ferramentas de análise

### [Data Atual] - Documentação de Criação de Conjunto de Anúncios (Ad Set)
- Adicionada seção detalhada sobre criação de conjuntos de anúncios
- Documentado processo passo-a-passo: `POST /act_<AD_ACCOUNT_ID>/adsets`
- Tabela de parâmetros necessários: `campaign_id`, `daily_budget`, `targeting`
- Explicação sobre informações de lances, direcionamento e orçamento

### [Data Atual] - Documentação de Criação de Campanha
- Adicionada seção detalhada sobre criação de campanhas com parâmetros necessários
- Documentado processo passo-a-passo: `POST /act_<AD_ACCOUNT_ID>/campaigns`
- Tabela de parâmetros obrigatórios: `name`, `objective`, `status`

### [Data Atual] - Criação Básica de Anúncios
- Documentação dos três endpoints principais: `campaigns`, `adsets`, `ads`
- Adicionados exemplos de código em cURL para cada endpoint
- Estabelecida estrutura hierárquica de criação (Campaign → AdSet → Ad)

