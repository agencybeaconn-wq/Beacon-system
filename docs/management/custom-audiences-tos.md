# Termos de Serviço de Públicos Personalizados (Custom Audiences TOS)

Gerenciamento da aceitação dos Termos de Serviço (TOS) para Públicos Personalizados na conta de anúncios.

## Leitura
Recupera o status de aceitação dos Termos de Serviço de Públicos Personalizados.

**Endpoint:** `GET /act_{ad_account_id}/customaudiencestos`

### Parâmetros
Este endpoint não possui parâmetros.

### Campos Retornados
A resposta contém uma lista de nós `CustomAudiencesTOS`.

### Resposta
```json
{
    "data": [],
    "paging": {}
}
```

## Criação (Aceitação)
Aceita os Termos de Serviço para Públicos Personalizados.

**Endpoint:** `POST /act_{ad_account_id}/customaudiencestos`

### Parâmetros
| Parâmetro | Tipo | Descrição | Obrigatório |
| :--- | :--- | :--- | :--- |
| `tos_id` | string | ID dos Termos de Serviço a serem aceitos. | Sim |
| `business_id` | string | ID do Business Manager (se aplicável). | Não |

### Retorno
```json
{
    "success": true
}
```

## Operações Não Suportadas
*   **Atualização:** Não suportado neste endpoint.
*   **Exclusão:** Não suportado neste endpoint.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
