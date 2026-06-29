# Validação e Limites de Direcionamento

Gerencie a obsolescência de termos de direcionamento e conheça os limites operacionais da API.

## Identificar Termos Obsoletos (Deprecated)
A Meta remove periodicamente opções de direcionamento. Conjuntos de anúncios usando esses termos podem ser pausados ou impedidos de serem editados.

### Endpoint: `/deprecatedtargetingadsets`
Retorna Ad Sets afetados por depreciação.

```bash
curl -G \
  -d 'type=deprecating' \
  -d 'access_token=<TOKEN>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/deprecatedtargetingadsets
```

**Tipos de Status (`type`):**
*   `deprecating` (Padrão): Ad Sets continuam rodando, mas não podem ser duplicados ou editados sem remover o termo obsoleto.
*   `delivery_paused`: Ad Sets foram pausados porque o termo não é mais válido para entrega.

### Filtrar Ad Sets por Estado
Você também pode filtrar a lista geral de Ad Sets pelo campo `adset.targeting_state`.

```bash
GET /act_<ID>/adsets?filtering=[{"field":"adset.targeting_state","operator":"IN","value":["deprecating"]}]
```
**Valores:** `normal`, `deprecating`, `delivery_affected`, `delivery_paused`.

## Limites de Direcionamento
Quantidades máximas permitidas por Ad Set.

| Área | Limite | Recomendado |
| :--- | :--- | :--- |
| **Cidades** | 250 | - |
| **Regiões** | 200 | - |
| **Códigos Postais** | 50.000* | - |
| **Interesses** | Sem limite | 100 |
| **Escolas** | 200 | 100 |
| **Empregadores** | 200 | 100 |
| **Cargos** | 200 | 100 |
| **Formações (Majors)** | 200 | 100 |
| **Custom Locations** | 200 | - |
| **Geo Markets** | 210 | - |
| **Conexões** | 50 | - |

*\*Para mais de 2.500 códigos postais, o sistema cria automaticamente um objeto de conjunto de códigos postais.*

## Restrições de Idade
*   **Mínima:** 13 anos (geral).
*   **Máxima:** 65+ anos.
