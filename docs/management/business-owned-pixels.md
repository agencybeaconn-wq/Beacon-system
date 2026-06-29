# Pixels Próprios do Negócio (Business Owned Pixels)

Recupera os pixels que pertencem a este negócio.

## Leitura
**Endpoint:** `GET /{business_id}/owned_pixels`

### Parâmetros
Este endpoint não possui parâmetros.

### Campos Retornados
A resposta contém uma lista de nós `AdsPixel`.

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
| **190** | Token de acesso OAuth 2.0 inválido. |
| **200** | Erro de permissão. |
| **270** | Requisição não permitida para apps com nível de acesso de desenvolvimento (deve ser admin do app e da conta de anúncios). |
| **80004** | Muitas chamadas para esta conta de anúncios (limite de taxa). |
