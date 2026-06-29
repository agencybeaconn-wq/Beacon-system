# Agências do Negócio (Business Agencies)

Lista todos os negócios (agências) que têm acesso aos ativos do seu negócio.

## Leitura
**Endpoint:** `GET /{business_id}/agencies`

### Campos Retornados
A resposta contém uma lista de nós `Business`.

Campos adicionais incluídos em cada nó:
*   `adaccount_permissions`: Lista de permissões na conta de anúncios.
*   `page_permissions`: Lista de permissões na página.
*   `productcatalog_permissions`: Lista de permissões no catálogo.
*   `application_permissions`: Lista de permissões no aplicativo.
*   `shared_ca_count`: Contagem de Custom Audiences compartilhadas.

### Resposta
```json
{
    "data": [],
    "paging": {},
    "summary": {
        "total_count": 5
    }
}
```

## Exclusão (Dissociar Agência)
Remove a associação de uma agência com o negócio.

**Endpoint:** `DELETE /{business_id}/agencies`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `business` | string/int | ID do negócio da agência. | **Sim** |

### Resposta
```json
{
    "success": true
}
```

## Operações Não Suportadas
*   **Criação:** Não suportado neste endpoint.
*   **Atualização:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **200** | Erro de permissão. |
