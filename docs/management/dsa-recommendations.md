# Recomendações DSA (Digital Services Act)

Recupera recomendações de beneficiário e pagador para conformidade com o Digital Services Act (DSA) da União Europeia.

## Visão Geral
Como parte dos requisitos do DSA da UE, anúncios direcionados a qualquer parte da UE devem fornecer valores de string definindo o beneficiário e o pagador do anúncio. Esta API fornece uma lista de strings prováveis baseadas na atividade recente da conta.

> **Nota:** Embora os valores previstos frequentemente correspondam ao que os anunciantes inserem manualmente, não há garantia de correção. Os usuários devem revisar antes de publicar campanhas.

## Leitura
Retorna recomendações de beneficiário e pagador para a conta de anúncios.

**Endpoint:** `GET /act_{ad_account_id}/dsa_recommendations`

### Parâmetros
Este endpoint não possui parâmetros.

### Campos Retornados
A resposta contém uma lista de nós `AdAccountDsaRecommendations`.

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
| **200** | Erro de permissão. |
