# Aplicativos Próprios do Negócio (Business Owned Apps)

Gerencia os aplicativos que pertencem a este negócio.

## Leitura
**Endpoint:** `GET /{business_id}/owned_apps`

### Campos Retornados
A resposta contém uma lista de nós `Application`.

### Resposta
```json
{
    "data": [],
    "paging": {}
}
```

## Criação
**Endpoint:** `POST /{business_id}/owned_apps`

### Parâmetros
Este endpoint não possui parâmetros documentados no snippet fornecido.

### Retorno
Este endpoint suporta *read-after-write*.
```json
{
    "access_status": "OWNER"
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
