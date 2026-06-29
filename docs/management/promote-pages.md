# Páginas Promovidas (Promote Pages)

Recupera todas as Páginas do Facebook promovidas por esta conta de anúncios.

## Pré-requisitos
Para utilizar este endpoint, o token de acesso deve ter as seguintes permissões:
*   `pages_show_list`: Para acessar as páginas do usuário.
*   `pages_manage_ads`: Para criar e gerenciar anúncios para as páginas.

## Leitura
Retorna uma lista de páginas associadas à conta de anúncios para promoção.

**Endpoint:** `GET /act_{ad_account_id}/promote_pages`

### Parâmetros
Este endpoint não possui parâmetros.

### Campos Retornados
A resposta contém uma lista de nós `Page`.

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
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
| **80004** | Muitas chamadas para esta conta de anúncios. |
