# Pixels de Anúncios (Ads Pixels)

Gerenciamento de Pixels (`AdsPixel`) associados à conta de anúncios.

## Leitura
Recupera uma lista de Pixels associados à conta de anúncios.

**Endpoint:** `GET /act_{ad_account_id}/adspixels`

### Parâmetros
*   `summary`: Use `summary=total_count` para obter a contagem total de objetos.

### Resposta
Retorna uma lista de nós `AdsPixel`.
```json
{
    "data": [],
    "paging": {},
    "summary": { "total_count": 1 }
}
```

## Criação
Cria um novo Pixel para a conta de anúncios.

**Endpoint:** `POST /act_{ad_account_id}/adspixels`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `name` | string | Nome do Pixel. | Sim |

### Exemplo de Requisição
```bash
curl -X POST \
  -F "name=My WCA Pixel" \
  -F "access_token=<ACCESS_TOKEN>" \
  "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adspixels"
```

### Retorno
```json
{
  "id": "123456789"
}
```

## Operações Não Suportadas
*   **Atualização:** Não é possível atualizar pixels neste endpoint.
*   **Exclusão:** Não é possível excluir pixels neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
| **6200** | Um pixel já existe para esta conta. |
| **6202** | Mais de um pixel existe para esta conta. |
| **80004** | Muitas chamadas para esta conta de anúncios. |
