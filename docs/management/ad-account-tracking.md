# Rastreamento da Conta de Anúncios (Ad Account Tracking)

Gerencia as especificações de rastreamento (`tracking_specs`) no nível da conta de anúncios.

## Leitura
Recupera os dados de rastreamento associados à conta.

**Endpoint:** `GET /act_{ad_account_id}/tracking`

### Parâmetros
Este endpoint não possui parâmetros.

### Campos Retornados
A resposta contém uma lista de nós `AdAccountTrackingData`.

### Resposta
```json
{
    "data": [],
    "paging": {}
}
```

## Criação (Adicionar Specs)
Adiciona especificações de rastreamento ao nível da conta.

**Endpoint:** `POST /act_{ad_account_id}/tracking`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `tracking_specs` | Object | Especificações de rastreamento a serem adicionadas. | **Sim** |

### Resposta
```json
{
    "success": true
}
```

## Operações Não Suportadas
*   **Atualização:** Não suportado neste endpoint.
*   **Exclusão:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
| **80004** | Muitas chamadas para esta conta de anúncios. |
