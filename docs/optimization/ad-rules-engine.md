# Mecanismo de Regras de Anúncios (Ad Rules Engine)

O Mecanismo de Regras de Anúncios é um serviço centralizado para gerenciar e automatizar ações em anúncios de forma eficiente, eliminando a necessidade de monitoramento manual constante via API.

## Tipos de Regras

### 1. Regras Baseadas em Gatilho (Trigger-based)
Monitoram o estado em tempo real. A regra é avaliada imediatamente quando ocorrem alterações nos metadados ou nos dados de Insights (ex: custo por lead excede um valor).

### 2. Regras Baseadas em Cronograma (Schedule-based)
Verificam o status dos anúncios em intervalos de tempo definidos (ex: diariamente às 8h) para ver se atendem aos critérios.

## Estrutura do Objeto de Regra

As regras são armazenadas na biblioteca de regras da conta de anúncios (`adrules_library`).

### Componentes Principais
- **`name`**: Nome da regra.
- **`evaluation_spec`**: Define **quais objetos** (campanhas, conjuntos, anúncios) serão avaliados e as **condições** lógicas.
- **`execution_spec`**: Define a **ação** a ser executada (ex: pausar, aumentar orçamento) nos objetos que atenderem à avaliação.
- **`status`**: `ENABLED` (ativa) ou `DISABLED` (pausada).

## Criação de Regra (Exemplo Básico)

```bash
curl -X POST "https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/adrules_library" \
  -F 'name=Rule 1' \
  -F 'evaluation_spec={ ... }' \
  -F 'execution_spec={ ... }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

## Gerenciamento
- **Desativar:** Atualize o `status` para `DISABLED`.
- **Reativar:** Atualize o `status` para `ENABLED`.
- **Excluir:** Remova a regra permanentemente se não for mais necessária.
