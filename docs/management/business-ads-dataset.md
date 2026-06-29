# Dataset de Anúncios do Negócio (Business Ads Dataset)

Recupera os Datasets de Anúncios aos quais o negócio tem acesso.

## Leitura
**Endpoint:** `GET /{business_id}/ads_dataset`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `id_filter` | string | Filtra por ID do dataset. |
| `name_filter` | string | Filtra por nome do dataset. |
| `sort_by` | enum | Ordenação: `LAST_FIRED_TIME`, `NAME`. |

### Campos Retornados
A resposta contém uma lista de nós `AdsDataset`.

### Resposta
```json
{
    "data": [],
    "paging": {},
    "summary": {}
}
```

## Operações Não Suportadas
*   **Criação:** Não suportado neste endpoint.
*   **Atualização:** Não suportado neste endpoint.
*   **Exclusão:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **104** | Assinatura incorreta. |
