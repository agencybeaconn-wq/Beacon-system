# Direcionamento Flexível (Flexible Targeting)

Permite criar combinações complexas de inclusão e exclusão usando lógica **AND** e **OR** através do campo `flexible_spec`.

## Lógica de Combinação
O Facebook avalia o direcionamento da seguinte forma:

1.  **AND Global:** Critérios fora do `flexible_spec` (Idade, Gênero, Geolocalização) são combinados com `AND` com o `flexible_spec`.
2.  **AND entre Grupos:** Cada objeto dentro da matriz principal `flexible_spec` é combinado com `AND`.
3.  **OR dentro de Grupos:** Dentro de cada objeto, os critérios são combinados com `OR`.

### Estrutura Visual
```
(Idade E Gênero E Local)
AND
(Grupo 1: Interesse A OU Interesse B)
AND
(Grupo 2: Comportamento X OU Status Y)
```

## Campo `flexible_spec`
Matriz de objetos JSON.
*   **Limite Matriz Principal:** 25 grupos.
*   **Limite Matriz Secundária:** 1.000 itens por grupo.

**Campos Suportados:**
`custom_audiences`, `interests`, `behaviors`, `life_events`, `industries`, `income`, `family_statuses`, `user_adclusters`, `work_positions`, `work_employers`, `education_majors`, `education_schools`, `education_statuses`, `college_years`.

## Exemplo Prático

**Objetivo:** Pessoas nos EUA (18-43 anos) QUE:
1.  (Viajam Frequentemente **OU** Gostam de Futebol **OU** Gostam de Filmes)
    **E**
2.  (Gostam de Música **OU** São Recém-casados)

```json
"targeting": {
  "geo_locations": { "countries": ["US"] },
  "age_min": 18,
  "age_max": 43,
  "flexible_spec": [
    {
      // Grupo 1 (OR interno)
      "behaviors": [{"id": 6002714895372, "name": "Frequent Travelers"}],
      "interests": [
        {"id": 6003107902433, "name": "Soccer"},
        {"id": 6003139266461, "name": "Movies"}
      ]
    },
    {
      // Grupo 2 (OR interno)
      "interests": [{"id": 6003020834693, "name": "Music"}],
      "life_events": [{"id": 6002714398172, "name": "Newlywed (1 year)"}]
    }
  ]
}
```
