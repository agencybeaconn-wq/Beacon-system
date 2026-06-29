# Gerenciamento de Status do Objeto de Anúncio

Os objetos de anúncio (Campanhas, Conjuntos de Anúncios, Anúncios) possuem três estados principais: **Live**, **Arquivado** e **Excluído**.

## Tipos de Status

### 1. Live (Ativo/Pausado)
Objetos publicados e visíveis.
*   **Status Possíveis:** `ACTIVE`, `PAUSED`, `PENDING_REVIEW`, `CREDIT_CARD_NEEDED`, `PREAPPROVED`, `DISABLED`, `PENDING_PROCESS`, `WITH_ISSUES`.

### 2. Arquivado (Archived)
*   **Definição:** Status definido como `ARCHIVED`.
*   **Limite:** Máximo de 100.000 objetos arquivados por tipo (campanha, conjunto, anúncio) por conta.
*   **Restrições:** Apenas `name` e `status` (para `DELETED`) podem ser alterados.
*   **Recuperação:** Requer filtro explícito na API (`effective_status=['ARCHIVED']`).

### 3. Excluído (Deleted)
*   **Definição:** Status definido como `DELETED` ou via HTTP DELETE.
*   **Irreversível:** Não pode voltar para `ARCHIVED` ou `ACTIVE`.
*   **Insights:** Mantidos por 28 dias após a última veiculação.
*   **Restrições:** Nenhum campo pode ser alterado (exceto `name`).
*   **Hierarquia:** Se uma campanha é excluída, filhos não são recuperáveis via bordas da campanha (precisa dos IDs diretos).

## Comparação de Status

| Recurso | Live | Arquivado | Excluído |
| :--- | :--- | :--- | :--- |
| **Existe no DB** | Sim | Sim | Sim |
| **Limite por Conta** | Com limites | 100.000 | Ilimitado |
| **Retorno padrão (sem filtro)** | Sim | Não | Não |
| **Retorno com filtro** | Sim | Sim (se filtro incluir ARCHIVED) | Não (erro se incluir DELETED) |
| **Consulta por ID** | Sim | Sim | Sim |
| **Insights Agregados** | Sim | Sim | Sim |
| **Alteração de Status** | Qualquer válido | Apenas para DELETED | Não pode alterar |

## Gerenciamento via API

### Arquivar um Anúncio
```bash
curl -X POST \
  -d "status=ARCHIVED" \
  -d "access_token=<ACCESS_TOKEN>" \
  https://graph.facebook.com/v24.0/<AD_ID>
```

### Excluir um Anúncio
```bash
curl -X POST \
  -d "status=DELETED" \
  -d "access_token=<ACCESS_TOKEN>" \
  https://graph.facebook.com/v24.0/<AD_ID>
```

### Recuperar Objetos Arquivados
Para listar anúncios arquivados de uma campanha:
```bash
curl -X GET \
  -d 'effective_status=["ARCHIVED"]' \
  -d 'fields="name"' \
  -d 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/<AD_CAMPAIGN_ID>/ads
```

### Boas Práticas
1.  **Limpeza:** Mova objetos de `ARCHIVED` para `DELETED` quando atingir o limite de 100k.
2.  **Insights:** Armazene estatísticas antes de excluir objetos, pois a recuperação via bordas pai (ex: `campaign/insights`) pode não detalhar objetos excluídos corretamente após 28 dias.
