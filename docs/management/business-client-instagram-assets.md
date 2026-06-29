# Ativos do Instagram de Clientes do Negócio (Business Client Instagram Assets)

Recupera os ativos do Instagram de clientes aos quais este negócio tem acesso.

## Leitura
**Endpoint:** `GET /{business_id}/client_instagram_assets`

### Campos Retornados
A resposta contém uma lista de nós `InstagramBusinessAsset`.

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
| **100** | Parâmetro inválido. |
