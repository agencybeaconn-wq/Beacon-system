# Pixels do Negócio (Business Adspixels)

Lista os Pixels do Facebook aos quais o negócio tem acesso.

## Leitura
**Endpoint:** `GET /{business_id}/adspixels`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `id_filter` | string | Filtra por ID do pixel. |
| `name_filter` | string | Filtra por nome do pixel (case insensitive). |

### Campos Retornados
A resposta contém uma lista de nós `AdsPixel`.

### Resposta
```json
{
    "data": [],
    "paging": {},
    "summary": {
        "total_count": 10
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
| **200** | Erro de permissão. |
| **270** | Acesso de desenvolvimento não permitido (requer admin do app e da conta). |
| **80004** | Muitas chamadas para esta conta. |
