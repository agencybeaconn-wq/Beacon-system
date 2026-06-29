# Negócios Gerenciados pelo Negócio (Business Managed Businesses)

Permite que um negócio agregador gerencie e atualize informações de negócios clientes (managed businesses).

## Atualização (Update)
**Endpoint:** `POST /{business_id}/managed_businesses`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `child_business_external_id` | string | ID externo do negócio filho. |
| `existing_client_business_id` | numeric string | ID do negócio cliente existente fornecido pelo cliente. |
| `name` | string | Nome do negócio cliente gerenciado pelo negócio agregador. |
| `sales_rep_email` | string | Email do representante de vendas do negócio gerenciado. |
| `survey_business_type` | enum | Tipo de negócio pesquisado. <br>Valores: `AGENCY`, `ADVERTISER`, `APP_DEVELOPER`, `PUBLISHER`. |
| `survey_num_assets` | int64 | Número de ativos pesquisados do negócio gerenciado. |
| `survey_num_people` | int64 | Número de pessoas pesquisadas do negócio gerenciado. |
| `timezone_id` | enum | ID do fuso horário do negócio gerenciado (0-480). |
| `vertical` | enum | Vertical do negócio gerenciado. <br>Ex: `ADVERTISING`, `ECOMMERCE`, `RETAIL`, etc. |

### Retorno
Este endpoint suporta *read-after-write* e retornará o objeto atualizado.
```json
{
    "id": "123456789",
    "name": "Nome do Negócio"
}
```

## Operações Não Suportadas
*   **Leitura:** Não suportado neste endpoint.
*   **Criação:** Não suportado neste endpoint.
*   **Exclusão:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **200** | Erro de permissão. |
| **42004** | Falha ao criar/atualizar o negócio cliente em nome do seu cliente. |
