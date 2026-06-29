# Direcionamento Básico (Basic Targeting)

Configuração de público baseada em dados demográficos, localização, interesses e comportamentos.

## Estrutura do Objeto `targeting`
O direcionamento é definido no nível do Ad Set, dentro do campo `targeting`.

## 1. Dados Demográficos
- **`genders`**: `[1]` (Masculino), `[2]` (Feminino). Padrão: Todos.
- **`age_min`**: Idade mínima (padrão 18).
- **`age_max`**: Idade máxima (até 65).

```json
"targeting": {
  "genders": [1],
  "age_min": 20,
  "age_max": 35
}
```

## 2. Localização (`geo_locations`)
É obrigatório especificar pelo menos um país (exceto se usar Custom Audience).

### Tipos de Localização
- **`countries`**: Array de códigos ISO (ex: `['US', 'BR']`).
- **`regions`**: Estados/Províncias (ex: `{'key':'3847'}`).
- **`cities`**: Cidades com raio.
    - `key`: ID da cidade.
    - `radius`: Raio (10-50 milhas / 17-80 km).
    - `distance_unit`: `mile` ou `kilometer`.
- **`zips`**: Códigos postais (limite 50.000).
- **`custom_locations`**: Pinos no mapa (Lat/Long ou Endereço).
    - `latitude`, `longitude`.
    - `address_string` (opcional).
    - `radius` (0.63-50 milhas / 1-80 km).
- **`geo_markets`**: Mercados DMA ou Comscore.
- **`country_groups`**: Blocos econômicos/geográficos (ex: `mercosur`, `europe`, `worldwide`).

### Tipos de Localização (`location_types`)
Define quem incluir na área:
- `['home']`: Pessoas que moram lá.
- `['recent']`: Pessoas que estiveram lá recentemente.
- `['home', 'recent']` (Padrão): Ambos.

### Exclusão (`excluded_geo_locations`)
Mesma estrutura de `geo_locations`, mas para excluir áreas.

```json
"targeting": {
  "geo_locations": {
    "countries": ["US"],
    "cities": [{"key": "2420605", "radius": 10, "distance_unit": "mile"}]
  },
  "excluded_geo_locations": {
    "regions": [{"key": "3847"}]
  }
}
```

## 3. Interesses (`interests`)
Baseado em curtidas, atividades e palavras-chave.
- Requer `id` e `name` (opcional).
- Use a **Marketing API Search** para encontrar IDs:
  `GET /search?type=adinterest&q=soccer`

```json
"targeting": {
  "interests": [
    {"id": "6003139266461", "name": "Movies"},
    {"id": "6003397425735", "name": "Tennis"}
  ]
}
```

## 4. Comportamentos (`behaviors`)
Baseado em atividades digitais, viagens, dispositivos, etc.
- Use a **Marketing API Search** para encontrar IDs:
  `GET /search?type=adTargetingCategory&class=behaviors`

```json
"targeting": {
  "behaviors": [
    {"id": "6002714895372", "name": "All frequent travelers"},
    {"id": "6004386044572", "name": "Android Owners (All)"}
  ]
}
```

## Exemplo Completo
```bash
curl -X POST \
  -F 'name="Targeting Example"' \
  -F 'targeting={
    "age_min": 25,
    "age_max": 45,
    "genders": [2],
    "geo_locations": {
      "countries": ["US"],
      "regions": [{"key":"4081"}]
    },
    "interests": [
      {"id": "6003139266461", "name": "Movies"}
    ],
    "behaviors": [
      {"id": "6002714895372", "name": "All frequent travelers"}
    ],
    "publisher_platforms": ["facebook", "instagram"],
    "device_platforms": ["mobile"]
  }' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adsets
```
