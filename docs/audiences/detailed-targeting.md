# Direcionamento Detalhado (Detailed Targeting)

API unificada para pesquisar, validar e obter sugestões de múltiplos tipos de direcionamento (interesses, comportamentos, demografia) de uma só vez.

## Endpoints Principais
Todos os endpoints são relativos a `act_<AD_ACCOUNT_ID>`.

### 1. Pesquisa (`/targetingsearch`)
Busca textual por múltiplos tipos de público.

```bash
curl -G \
  -d "q=harvard" \
  -d "limit_type=education_schools" \
  -d "access_token=<TOKEN>" \
  https://graph.facebook.com/v24.0/act_<ID>/targetingsearch
```

**Parâmetros:**
- `q`: Termo de busca.
- `limit_type`: (Opcional) Filtra tipos específicos (ex: `interests`, `work_employers`, `behaviors`). Se não fornecido, busca em tudo.

### 2. Sugestões (`/targetingsuggestions`)
Obtém recomendações baseadas em um público "semente".

```bash
curl -G \
  -d "targeting_list=[{'type':'interests','id':6003263791114}]" \
  -d "access_token=<TOKEN>" \
  https://graph.facebook.com/v24.0/act_<ID>/targetingsuggestions
```

**Parâmetros:**
- `targeting_list`: Array de objetos `{type, id}` para basear as sugestões.

### 3. Navegação (`/targetingbrowse`)
Retorna a estrutura hierárquica (taxonomia) de categorias para criar menus de navegação (Browse).

```bash
curl -G \
  -d "access_token=<TOKEN>" \
  https://graph.facebook.com/v24.0/act_<ID>/targetingbrowse
```

### 4. Validação (`/targetingvalidation`)
Verifica se IDs de direcionamento ainda são válidos (útil para limpar Ad Sets antigos).

```bash
curl -G \
  -d "targeting_list=[{'type':'interests','id':123}, {'type':'behaviors','id':456}]" \
  -d "access_token=<TOKEN>" \
  https://graph.facebook.com/v24.0/act_<ID>/targetingvalidation
```

**Resposta:**
- `valid`: `true` ou `false`.

## Tipos de Limite (`limit_type`)
Valores comuns para filtrar buscas e sugestões:
- `interests`
- `behaviors`
- `life_events`
- `industries`
- `income`
- `family_statuses`
- `education_schools`, `education_majors`, `education_statuses`
- `work_employers`, `work_positions`
- `relationship_statuses`
