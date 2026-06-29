# Contas de Anúncios Próprias Pendentes (Business Pending Owned Ad Accounts)

Recupera as contas de anúncios para as quais o negócio solicitou propriedade e ainda estão aguardando aprovação.

## Leitura
**Endpoint:** `GET /{business_id}/pending_owned_ad_accounts`

### Parâmetros
Este endpoint não possui parâmetros.

### Campos Retornados
A resposta contém uma lista de nós `BusinessAdAccountRequest`.
Também suporta o campo `summary` para totais (ex: `summary=total_count`).

### Resposta
```json
{
    "data": [],
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
| **368** | Ação considerada abusiva ou não permitida. |
