# Estimativa de Alcance (Reach Estimate)

Recupera uma estimativa do tamanho do público com base em uma especificação de direcionamento para a conta de anúncios.

## Leitura
Retorna um intervalo estimado de usuários (`users_lower_bound` e `users_upper_bound`).

**Endpoint:** `GET /act_{ad_account_id}/reachestimate`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `targeting_spec` | Object | Especificação de direcionamento (ex: geo_locations, age_min). | **Sim** |
| `object_store_url` | string | URL do app na loja (para campanhas de app mobile). | Não |

### Campos Retornados
A resposta contém um nó `AdAccountReachEstimate`.

### Exemplo de Resposta
```json
{
    "data": {
        "users_lower_bound": 10000,
        "users_upper_bound": 15000
    }
}
```

### Limitações
*   Estimativas para públicos personalizados podem não estar disponíveis para certas empresas.

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
| **613** | Limite de taxa excedido. |
| **2641** | Localização restrita incluída ou excluída. |
| **80004** | Muitas chamadas para esta conta de anúncios. |
