# Pixels de Clientes do Negócio (Business Client Pixels)

Recupera os Pixels do Facebook de propriedade de clientes aos quais este negócio tem acesso.

## Leitura
**Endpoint:** `GET /{business_id}/client_pixels`

### Campos Retornados
A resposta contém uma lista de nós `AdsPixel`.

Campos adicionais incluídos em cada nó:
*   `permitted_tasks`: Lista de tarefas atribuíveis a usuários neste ativo.

### Resposta
```json
{
    "data": [],
    "paging": {},
    "summary": {
        "total_count": 2
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
| **190** | Token de acesso OAuth 2.0 inválido. |
| **200** | Erro de permissão. |
| **270** | Acesso não permitido para apps em nível de desenvolvimento. |
