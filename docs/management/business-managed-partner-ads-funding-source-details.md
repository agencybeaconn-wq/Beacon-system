# Detalhes da Fonte de Financiamento de Anúncios de Parceiros Gerenciados (Business Managed Partner Ads Funding Source Details)

Recupera detalhes sobre fontes de financiamento de anúncios de parceiros gerenciados pelo negócio.

## Leitura
**Endpoint:** `GET /{business_id}/managed_partner_ads_funding_source_details`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `year_quarter` | string | Filtra por ano e trimestre (ex: "2023_Q1"). |

### Campos Retornados
A resposta contém uma lista de nós `FundingSourceDetailsCoupon`.

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
| **200** | Erro de permissão. |
