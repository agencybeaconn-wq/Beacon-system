# Rótulos de Anúncio (Ad Labels)

Gerenciamento de rótulos (`AdLabel`) para organizar e agrupar objetos de anúncio (campanhas, conjuntos de anúncios, anúncios) na conta.

## Leitura
Recupera uma lista de rótulos de anúncio da conta.

**Endpoint:** `GET /act_{ad_account_id}/adlabels`

### Parâmetros
*   `summary`: Use `summary=total_count` para contagem total ou `summary=insights` para obter métricas agregadas dos objetos rotulados.

### Resposta
Retorna uma lista de nós `AdLabel`.
```json
{
    "data": [],
    "paging": {},
    "summary": {
        "total_count": 5
    }
}
```

## Criação
Cria um novo rótulo de anúncio.

**Endpoint:** `POST /act_{ad_account_id}/adlabels`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `name` | string | Nome do rótulo. | Sim |

### Exemplo de Requisição
```bash
curl -X POST \
  -F "name=My Label" \
  -F "access_token=<ACCESS_TOKEN>" \
  "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adlabels"
```

### Retorno
```json
{
  "id": "123456789"
}
```

## Operações Não Suportadas
*   **Atualização:** Não é possível atualizar rótulos neste endpoint.
*   **Exclusão:** Não é possível excluir rótulos neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
| **80004** | Muitas chamadas para esta conta de anúncios. |
