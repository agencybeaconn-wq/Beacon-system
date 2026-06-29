# Faturas do Negócio (Business Invoices)

Recupera as faturas mensais enviadas para as entidades legais associadas a um negócio. Retorna objetos do tipo `OmegaCustomerTrx`.

## Leitura
**Endpoint:** `GET /{business_id}/business_invoices`

### Parâmetros de Filtragem
| Parâmetro | Tipo | Descrição | Padrão |
| :--- | :--- | :--- | :--- |
| `invoice_id` | string | Número da fatura (campo `invoice_id` no nó). Se definido, ignora outros filtros. | - |
| `root_id` | int64 | ID interno da transação (campo `id` no nó). Se definido, ignora outros filtros. | - |
| `type` | enum | Tipo de documento: `INV` (Fatura), `CM` (Nota de Crédito), `DM`, `PRO_FORMA`. | - |

### Filtros por Período de Faturamento
O período de faturamento refere-se ao mês de competência (ex: fatura de Junho tem data de faturamento 01/05).
| Parâmetro | Tipo | Descrição | Padrão |
| :--- | :--- | :--- | :--- |
| `start_date` | string (YYYY-MM-DD) | Data inicial (exclusiva). | 1º dia de 6 meses atrás |
| `end_date` | string (YYYY-MM-DD) | Data final (exclusiva). | Data atual |

### Filtros por Data de Emissão
Refere-se à data em que o documento foi gerado.
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `issue_start_date` | string (YYYY-MM-DD) | Data inicial de emissão (inclusiva). | **Sim** (se filtrar por emissão) |
| `issue_end_date` | string (YYYY-MM-DD) | Data final de emissão (exclusiva). | Data atual |

### Campos Retornados
A resposta contém uma lista de nós `OmegaCustomerTrx`.

### Resposta
```json
{
    "data": [],
    "paging": {},
    "summary": {
        "total_count": 12
    }
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
| **104** | Assinatura incorreta. |
| **200** | Erro de permissão. |
