# Páginas do Negócio (Business Pages)

Gerencia a associação de Páginas com o Negócio.

## Exclusão (Dissociar Página)
Remove a associação de uma Página com o Negócio.

**Endpoint:** `DELETE /{business_id}/pages`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `page_id` | Page ID | ID da página a ser dissociada. | **Sim** |

### Retorno
```json
{
    "success": true
}
```

## Operações Não Suportadas
*   **Leitura:** Não suportado neste endpoint.
*   **Criação:** Não suportado neste endpoint.
*   **Atualização:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **200** | Erro de permissão. |
| **415** | Autenticação de dois fatores necessária. |
| **3996** | A página não pertence a este Gerenciador de Negócios. |
| **42001** | Esta Página não pode ser removida porque está vinculada a um perfil comercial do Instagram. |
