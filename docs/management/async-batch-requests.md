# Requisições em Lote Assíncronas (Async Batch Requests)

Criação de requisições em lote assíncronas para a conta de anúncios. Permite executar múltiplas operações de forma otimizada.

## Criação
Inicia uma requisição em lote assíncrona.

**Endpoint:** `POST /act_{ad_account_id}/async_batch_requests`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `adbatch` | list<Object> | Lista de requisições codificadas em JSON. | Sim |
| `name` | string | Nome da requisição em lote para rastreamento. | Sim |

### Retorno
```json
{
  "id": "123456789"
}
```

## Operações Não Suportadas
*   **Leitura:** Não é possível listar requisições em lote neste endpoint.
*   **Atualização:** Não suportado neste endpoint.
*   **Exclusão:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **194** | Falta parâmetro obrigatório. |
| **2500** | Erro ao analisar a consulta (graph query). |
