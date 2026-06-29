# Pesquisa de Direcionamento (Targeting Search)

Endpoint de pesquisa unificada para obter descritores de direcionamento com base em uma consulta.

## Leitura
Retorna descritores de direcionamento que correspondem à consulta de pesquisa.

**Endpoint:** `GET /act_{ad_account_id}/targetingsearch`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `q` | string | Consulta de pesquisa. | **Sim** |
| `limit_type` | enum | Limita o tipo de público a recuperar (ex: `interests`, `geo_locations`, `behaviors`). | Não |
| `objective` | enum | Objetivo da campanha (ex: `APP_INSTALLS`, `CONVERSIONS`). | Não |
| `app_store` | enum | Loja de aplicativos (para campanhas de instalação de app). | Não |
| `regulated_categories` | list<enum> | Categorias regulamentadas (ex: `HOUSING`, `EMPLOYMENT`). | Não |
| `allow_only_fat_head_interests` | boolean | Permitir apenas interesses pré-aprovados. | Não |

### Tipos de Limite (`limit_type`)
Uma lista extensa de tipos é suportada, incluindo:
*   `interests`
*   `behaviors`
*   `demographics` (via `education_schools`, `work_positions`, etc.)
*   `geo_locations` (`countries`, `regions`, `cities`, `zips`)
*   `adgroup_id`, `campaign_id`
*   `custom_audiences`
*   `keywords`

### Campos Retornados
A resposta contém uma lista de nós `AdAccountTargetingUnified`.

### Resposta
```json
{
    "data": [],
    "paging": {}
}
```

## Operações Não Suportadas
*   **Criação:** Não suportado neste endpoint.
*   **Atualização:** Não suportado neste endpoint.
*   **Exclusão:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
| **80004** | Muitas chamadas para esta conta de anúncios. |
