# Criação de Conta de Anúncios no Negócio (Business Ad Account Creation)

Cria uma nova conta de anúncios diretamente sob um Business Manager.

## Criação
**Endpoint:** `POST /{business_id}/adaccount`

### Parâmetros Obrigatórios
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `name` | string | Nome da conta de anúncios. |
| `currency` | string | Código da moeda (ISO 4217), ex: `BRL`, `USD`. |
| `timezone_id` | int | ID do fuso horário. |
| `end_advertiser` | string | Entidade anunciante (Page ID, App ID ou `NONE`/`UNFOUND`). |
| `media_agency` | string | Agência de mídia (Page ID, App ID ou `NONE`/`UNFOUND`). |
| `partner` | string | Parceiro (Page ID, App ID ou `NONE`/`UNFOUND`). |

### Parâmetros Opcionais
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `funding_id` | string | ID do método de pagamento. |
| `invoice` | boolean | Se deve anexar à linha de crédito do BM (se disponível). |
| `invoice_group_id` | string | ID do grupo de faturas. |
| `invoicing_emails` | list<string> | Emails para envio de faturas. |
| `po_number` | string | Número do pedido de compra (PO). |

### Resposta
```json
{
  "id": "act_<AD_ACCOUNT_ID>",
  "account_id": "<NUMERIC_ID>",
  "business_id": "<BUSINESS_ID>",
  "end_advertiser_id": "...",
  "media_agency_id": "...",
  "partner_id": "..."
}
```

## Operações Não Suportadas
*   **Leitura:** Não suportado neste endpoint.
*   **Atualização:** Não suportado neste endpoint.
*   **Exclusão:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **3979** | Limite de contas de anúncios excedido para o BM. |
| **3980** | Contas existentes em situação irregular (bad standing). |
| **415** | Autenticação de dois fatores necessária. |
| **23007** | Método de pagamento inválido para o tipo de faturamento. |
