# Grupos de Fontes de Eventos do Negócio (Business Event Source Groups)

Gerencia grupos de fontes de eventos (como pixels) pertencentes a este negócio.

## Leitura
**Endpoint:** `GET /{business_id}/event_source_groups`

### Campos Retornados
A resposta contém uma lista de nós `EventSourceGroup`.

### Resposta
```json
{
    "data": [],
    "paging": {}
}
```

## Criação
**Endpoint:** `POST /{business_id}/event_source_groups`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `name` | string | Nome do grupo de fontes de eventos. | **Sim** |
| `event_sources` | list<string/int> | IDs das fontes de eventos (ex: pixels) associadas a este grupo. | **Sim** |

### Retorno
Este endpoint suporta *read-after-write* e retornará o objeto criado.
```json
{
    "id": "123456789"
}
```

## Operações Não Suportadas
*   **Atualização:** Não suportado neste endpoint.
*   **Exclusão:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **200** | Erro de permissão. |
| **270** | Acesso não permitido para apps em nível de desenvolvimento. |
