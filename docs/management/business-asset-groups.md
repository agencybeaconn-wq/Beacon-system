# Grupos de Ativos de Negócios (Business Asset Groups)

Recupera todos os grupos de ativos de negócios (Business Asset Groups) associados a um negócio.

## Leitura
**Endpoint:** `GET /{business_id}/business_asset_groups`

### Campos Retornados
A leitura desta borda retornará um resultado formatado em JSON contendo:
*   `data`: Uma lista de nós `BusinessAssetGroup`.
*   `paging`: Detalhes de paginação.
*   `summary`: Informações agregadas (ex: `total_count`).

### Exemplo de Resposta
```json
{
    "data": [],
    "paging": {},
    "summary": {
        "total_count": 5
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
| **104** | Assinatura incorreta. |
| **190** | Token de acesso OAuth 2.0 inválido. |
