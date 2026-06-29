# Páginas Próprias do Negócio (Business Owned Pages)

Recupera todas as páginas do Facebook que pertencem a este negócio.

## Leitura
**Endpoint:** `GET /{business_id}/owned_pages`

### Campos Retornados
A resposta contém uma lista de nós `Page`.
Também suporta o campo `summary` para totais (ex: `summary=total_count`).

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

## Criação (Reivindicar Página)
Permite reivindicar uma Página no Gerenciador de Negócios.

**Endpoint:** `POST /{business_id}/owned_pages`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `page_id` | Page ID | ID da página a ser reivindicada. | **Sim** |
| `entry_point` | string | Ponto de entrada da reivindicação (BusinessClaimAssetEntryPoint). | Não |

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
| **104** | Assinatura incorreta. |
| **190** | Token de acesso OAuth 2.0 inválido. |
| **200** | Erro de permissão. |
| **368** | Ação considerada abusiva ou não permitida. |
| **413** | Senha inválida. |
| **415** | Autenticação de dois fatores necessária. |
| **3944** | Seu Gerenciador de Negócios já tem acesso a este objeto. |
| **3977** | Para reivindicar uma Página, você já deve ser um Administrador dela. |
| **3982** | Você não tem permissões suficientes para importar este ativo. |
| **42001** | Esta Página não pode ser removida porque está vinculada a um perfil comercial do Instagram. |
| **80002** | Muitas chamadas para esta conta (limite de taxa). |
