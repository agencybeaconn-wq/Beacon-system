# Públicos Semelhantes (Lookalike Audiences)

Alcançam pessoas parecidas com seus clientes existentes (público de origem).

> **Restrições (Setembro 2025):** Públicos que sugerem condições de saúde ou status financeiro serão bloqueados.

## Criação de Público Semelhante

### Parâmetros Principais (`lookalike_spec`)
- **`ratio`**: Porcentagem da população do país (0.01 a 0.20, ou seja, 1% a 20%).
- **`origin_audience_id`**: ID do público semente (Custom Audience, Page, etc.). Mínimo 100 pessoas.
- **`allow_international_seeds`**: Se `true`, busca sementes em outros países se o país principal não tiver dados suficientes.
- **`country`**: **[OBSOLETO NA CRIAÇÃO]** A definição de localização agora é feita no nível do **Conjunto de Anúncios** (`targeting.geo_locations`).

### Exemplo de Criação (Baseado em Custom Audience)
```bash
curl -F 'name=My lookalike audience' \
-F 'subtype=LOOKALIKE' \
-F 'origin_audience_id=<SEED_AUDIENCE_ID>' \
-F 'lookalike_spec={
  "type": "custom_ratio",
  "ratio": 0.01,
  "allow_international_seeds": true
}' \
-F 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/customaudiences
```

## Tipos de Origem

### 1. Público Personalizado
Usa um público existente (site, lista de clientes) como semente.

### 2. Conversões de Campanha/Conjunto de Anúncios
Baseado em pessoas que converteram em campanhas anteriores.
- **`conversion_type`**: `campaign_conversions`.
- **`origin_ids`**: Lista de IDs de campanhas ou conjuntos de anúncios.

```json
"lookalike_spec": {
  "origin_ids": ["<CAMPAIGN_ID>"],
  "starting_ratio": 0.03,
  "ratio": 0.05,
  "conversion_type": "campaign_conversions"
}
```

### 3. Fãs da Página
Baseado em pessoas que curtem sua página.
- **`conversion_type`**: `page_like`.
- **`page_id`**: ID da página.

## Semelhantes Baseados em Valor (Value-Based)
Usa o valor monetário (LTV) dos clientes para encontrar pessoas semelhantes aos seus clientes de **maior valor**.

1. **Criar Custom Audience com Valor:**
   `is_value_based=1` e `customer_file_source="PARTNER_PROVIDED_ONLY"`.
2. **Adicionar Usuários com Valor:**
   Schema inclui `LOOKALIKE_VALUE`.
3. **Criar Lookalike:**
   Usar o ID do público de valor como origem.

## Direcionamento em Anúncios
Como a localização foi removida da criação do Lookalike, você **DEVE** especificar a localização no Conjunto de Anúncios.

```bash
curl -F 'targeting={
  "custom_audiences": [{"id":"<LOOKALIKE_AUDIENCE_ID>"}],
  "geo_locations": {"countries":["US"]}
}' \
...
```

## Status e Manutenção
- **Preenchimento:** Leva de 1 a 6 horas.
- **Inatividade:** Se não usado por 90 dias, `approximate_count` retorna -1.
- **Expiração:** Se não usado por 2 anos, entra em estado `EXPIRING`.
