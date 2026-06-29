# Reivindicação de Conversões Personalizadas (Business Claim Custom Conversions)

Permite que um negócio reivindique a propriedade de uma Conversão Personalizada.

## Criação (Reivindicar)
**Endpoint:** `POST /{business_id}/claim_custom_conversions`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `custom_conversion_id` | string | ID da conversão personalizada a ser reivindicada. | **Sim** |

### Resposta
```json
{
    "success": true
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
