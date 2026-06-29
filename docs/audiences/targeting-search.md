# Pesquisa de Direcionamento (Targeting Search)

A API de Pesquisa de Direcionamento (`/search`) permite encontrar IDs válidos para países, cidades, interesses, comportamentos e dados demográficos.

## Endpoint Base
```bash
GET https://graph.facebook.com/v24.0/search
```

## 1. Geografia (`type=adgeolocation`)
Encontre códigos para países, regiões, cidades e CEPs.

### Parâmetros
- **`q`**: Termo de busca (ex: "United", "90210").
- **`location_types`**: Array com tipos de local.
    - `['country']`, `['region']`, `['city']`, `['zip']`, `['geo_market']`, `['electoral_district']`, `['country_group']`.

### Exemplos
**Buscar País (EUA):**
```bash
curl -G \
  -d 'type=adgeolocation' \
  -d 'location_types=["country"]' \
  -d 'q=United States' \
  -d 'access_token=<TOKEN>' \
  https://graph.facebook.com/v24.0/search
```

**Buscar Cidade (Manhattan):**
```bash
curl -G \
  -d 'type=adgeolocation' \
  -d 'location_types=["city"]' \
  -d 'q=Manhattan' \
  ...
```

**Buscar CEP (90210):**
```bash
curl -G \
  -d 'type=adgeolocation' \
  -d 'location_types=["zip"]' \
  -d 'q=90210' \
  ...
```

**Metadados de Localização (`type=adgeolocationmeta`):**
Recuperar detalhes de IDs conhecidos.
```bash
curl -G \
  -d 'type=adgeolocationmeta' \
  -d 'cities=[2418779]' \
  ...
```

**Sugestão de Raio (`type=adradiussuggestion`):**
```bash
curl -G \
  -d 'type=adradiussuggestion' \
  -d 'latitude=37.44' \
  -d 'longitude=-122.17' \
  ...
```

## 2. Interesses (`type=adinterest`)
Buscar interesses por nome.

```bash
curl -G \
  -d 'type=adinterest' \
  -d 'q=baseball' \
  ...
```

### Sugestões (`type=adinterestsuggestion`)
Interesses relacionados a uma lista.
```bash
curl -G \
  -d 'type=adinterestsuggestion' \
  -d 'interest_list=["Basketball"]' \
  ...
```

### Validação (`type=adinterestvalid`)
Verificar se um interesse ainda é válido.
```bash
curl -G \
  -d 'type=adinterestvalid' \
  -d 'interest_list=["Japan", "invalid_keyword"]' \
  ...
```

## 3. Comportamentos e Demografia (`type=adTargetingCategory`)
Navegar por categorias hierárquicas.

- **`class`**: Categoria principal.
    - `interests`, `behaviors`, `demographics`, `life_events`, `industries`, `income`, `family_statuses`, `user_device`, `user_os`.

**Listar Comportamentos:**
```bash
curl -G \
  -d 'type=adTargetingCategory' \
  -d 'class=behaviors' \
  ...
```

## 4. Educação e Trabalho
Busca específica com autocomplete.

- **Escolas:** `type=adeducationschool` (`q=Harvard`)
- **Cursos (Majors):** `type=adeducationmajor` (`q=Computer Science`)
- **Empregadores:** `type=adworkemployer` (`q=Microsoft`)
- **Cargos:** `type=adworkposition` (`q=Engineer`)

## 5. Status da Opção (`type=targetingoptionstatus`)
Verificar se um ID de direcionamento está ativo, obsoleto ou não entregável.

```bash
curl -G \
  -d 'type=targetingoptionstatus' \
  -d 'targeting_option_list=["<ID1>", "<ID2>"]' \
  ...
```
**Status Possíveis:** `NORMAL`, `NON-DELIVERABLE`, `DEPRECATING`.
