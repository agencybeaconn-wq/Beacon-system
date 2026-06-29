# Ativos do Instagram Próprios do Negócio (Business Owned Instagram Assets)

Recupera os ativos do Instagram que pertencem a este negócio.

## Leitura
**Endpoint:** `GET /{business_id}/owned_instagram_assets`

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
| **2500** | Erro ao analisar a consulta do gráfico. |
