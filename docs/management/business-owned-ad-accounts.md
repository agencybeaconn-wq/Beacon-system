# Contas de Anúncios Próprias do Negócio (Business Owned Ad Accounts)

Gerencia as contas de anúncios que pertencem a este negócio.

> **Nota Importante:** A partir do final de setembro de 2024, a API `POST /{pixel-id}/shared_accounts` não suportará o compartilhamento de pixels com uma conta de anúncios se a conta empresarial não tiver acesso a ambos. A solução recomendada é compartilhar o pixel ou a conta de anúncios com a conta empresarial primeiro (usando `POST /{pixel-id}/agencies` ou `POST {ad_account}/agencies`) e depois vincular.

## Leitura
**Endpoint:** `GET /{business_id}/owned_ad_accounts`

### Parâmetros
| Parâmetro | Tipo | Descrição |
| :--- | :--- | :--- |
| `search_query` | string | Consulta de pesquisa para filtrar contas. |

### Campos Retornados
A resposta contém uma lista de nós `AdAccount`.
Também suporta o campo `summary` para totais (ex: `summary=total_count`).

### Resposta
```json
{
    "data": [],
    "paging": {},
    "summary": {
        "total_count": 10
    }
}
```

## Criação (Reivindicar Conta)
Permite reivindicar uma conta de anúncios existente para o negócio.

**Endpoint:** `POST /{business_id}/owned_ad_accounts`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `adaccount_id` | string | ID da conta de anúncios a ser reivindicada. | **Sim** |

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
| **415** | Autenticação de dois fatores necessária. |
| **2500** | Erro ao analisar a consulta do gráfico. |
| **2635** | Versão depreciada da API de Anúncios. |
| **3936** | Você já tentou reivindicar esta conta de anúncios. |
| **3944** | Seu Gerenciador de Negócios já tem acesso a este objeto. |
| **3979** | Você excedeu o número de contas de anúncios permitidas. |
| **3980** | Uma ou mais contas de anúncios estão em situação irregular ou em análise. |
| **3994** | Contas pessoais sem histórico de atividade não são elegíveis para migração. |
| **80004** | Muitas chamadas para esta conta de anúncios (limite de taxa). |
