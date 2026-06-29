# Conjuntos de Anúncios com Direcionamento Obsoleto (Deprecated Targeting Ad Sets)

Recupera conjuntos de anúncios que estão utilizando opções de direcionamento obsoletas ou em processo de descontinuação.

## Leitura
Retorna uma lista de conjuntos de anúncios afetados por depreciação de direcionamento.

**Endpoint:** `GET /act_{ad_account_id}/deprecatedtargetingadsets`

### Parâmetros
| Parâmetro | Tipo | Descrição | Padrão |
| :--- | :--- | :--- | :--- |
| `type` | string | Tipo de depreciação a consultar. Opções: `deprecating`, `delivery_paused`. | `deprecating` |

### Campos Retornados
A resposta contém uma lista de nós `AdSet`.

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
| **80004** | Muitas chamadas para esta conta de anúncios. |
