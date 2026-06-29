# Atividades da Conta de Anúncios (Ad Account Activities)

Histórico de atividades e alterações realizadas na conta de anúncios.

## Leitura
Recupera uma lista de atividades (`AdActivity`) relacionadas à conta.

**Endpoint:** `GET /act_{ad_account_id}/activities`

### Parâmetros
Este endpoint não possui parâmetros específicos de filtro documentados aqui, mas suporta paginação padrão.

### Resposta
Retorna um objeto JSON contendo uma lista de nós `AdActivity`.

```json
{
    "data": [],
    "paging": {}
}
```

## Operações Não Suportadas
*   **Criação:** Não é possível criar atividades manualmente via API.
*   **Atualização:** Não é possível atualizar registros de atividade.
*   **Exclusão:** Não é possível excluir registros de atividade.

## Códigos de Erro Comuns
| Código | Descrição |
| :--- | :--- |
| **100** | Parâmetro inválido. |
| **190** | Token de acesso inválido. |
| **200** | Erro de permissão. |
| **368** | Ação considerada abusiva ou não permitida. |
| **613** | Limite de taxa excedido. |
| **80004** | Muitas chamadas para esta conta de anúncios (Rate Limit específico). |
